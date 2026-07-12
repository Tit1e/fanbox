/**
 * [INPUT]: 依赖 Node.js 测试库与 electron/quit-service.js 的注入式退出守卫
 * [OUTPUT]: 验证无终端、空闲终端、运行任务快照保存、取消确认和重复退出请求
 * [POS]: tests/electron 的应用退出安全边界单元测试，不启动真实 Electron
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createQuitGuard } = require('../../electron/quit-service');

const settle = () => new Promise((resolve) => setImmediate(resolve));
const event = () => ({ prevented: 0, preventDefault() { this.prevented++; } });

function harness({ terminals = 1, running = 0, response = 0, countRunningTasks } = {}) {
  const calls = { quit: 0, dialog: [] };
  const app = { quit() { calls.quit++; } };
  const dialog = { async showMessageBox(win, options) { calls.dialog.push({ win, options }); return { response }; } };
  const ptyService = {
    count: () => terminals,
    countRunningTasks: countRunningTasks || (async () => running),
  };
  const guard = createQuitGuard({ app, dialog, ptyService, getWindow: () => null, translate: (zh) => zh });
  return { guard, calls };
}

test('没有终端时当前退出事务直接放行', () => {
  const { guard, calls } = harness({ terminals: 0 });
  const e = event();
  guard.handleBeforeQuit(e);
  assert.equal(e.prevented, 0);
  assert.equal(guard.isQuitting(), true);
  assert.equal(calls.quit, 0);
});

test('全部为空闲终端时不弹窗并重新发起退出', async () => {
  const { guard, calls } = harness({ terminals: 2, running: 0 });
  const e = event();
  guard.handleBeforeQuit(e);
  await settle();
  assert.equal(e.prevented, 1);
  assert.equal(calls.dialog.length, 0);
  assert.equal(calls.quit, 1);
  assert.equal(guard.isQuitting(), true);
});

test('存在运行任务时弹窗，取消后保留应用并允许再次检查', async () => {
  const { guard, calls } = harness({ terminals: 3, running: 2, response: 0 });
  const first = event();
  guard.handleBeforeQuit(first);
  await settle();
  assert.equal(calls.quit, 0);
  assert.equal(calls.dialog.length, 1);
  assert.match(calls.dialog[0].options.message, /2 个终端任务/);
  assert.equal(guard.isChecking(), false);
  guard.handleBeforeQuit(event());
  await settle();
  assert.equal(calls.dialog.length, 2);
});

test('确认退出后只发起一次新的退出事务', async () => {
  const { guard, calls } = harness({ terminals: 1, running: 1, response: 1 });
  guard.handleBeforeQuit(event());
  await settle();
  assert.equal(calls.dialog.length, 1);
  assert.equal(calls.quit, 1);
  assert.equal(guard.isQuitting(), true);
});

test('确认退出后保存仍在运行且已追踪到命令的任务', async () => {
  const saved = [];
  const guard = createQuitGuard({
    app: { quit() {} },
    dialog: { async showMessageBox() { return { response: 1 }; } },
    ptyService: {
      count: () => 2,
      runningTaskSnapshots: async () => [
        { cwd: '/tmp/a', command: 'codex' },
        { cwd: '/tmp/b', command: '' },
      ],
    },
    recoveryStore: { merge: (items) => saved.push(...items) },
  });
  guard.handleBeforeQuit(event());
  await settle();
  assert.deepEqual(saved, [{ cwd: '/tmp/a', command: 'codex' }]);
});

test('已确认有任务但确认框失败时不会静默退出', async () => {
  const calls = { quit: 0 };
  const guard = createQuitGuard({
    app: { quit() { calls.quit++; } },
    dialog: { async showMessageBox() { throw new Error('dialog failed'); } },
    ptyService: { count: () => 1, countRunningTasks: async () => 1 },
  });
  guard.handleBeforeQuit(event());
  await settle();
  assert.equal(calls.quit, 0);
  assert.equal(guard.isQuitting(), false);
  assert.equal(guard.isChecking(), false);
});

test('任务检查期间的重复退出请求不会重复检查或弹窗', async () => {
  let resolveCount;
  let checks = 0;
  const pending = new Promise((resolve) => { resolveCount = resolve; });
  const { guard, calls } = harness({ countRunningTasks: () => { checks++; return pending; } });
  const first = event(), second = event();
  guard.handleBeforeQuit(first);
  guard.handleBeforeQuit(second);
  assert.equal(first.prevented, 1);
  assert.equal(second.prevented, 1);
  assert.equal(checks, 1);
  resolveCount(0);
  await settle();
  assert.equal(calls.dialog.length, 0);
  assert.equal(calls.quit, 1);
});
