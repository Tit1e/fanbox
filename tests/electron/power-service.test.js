/**
 * [INPUT]: 依赖 Node.js 测试库与 electron/power-service.js 的注入式合盖状态服务
 * [OUTPUT]: 验证用户意图、终端数量、系统命令失败和退出恢复的状态转换
 * [POS]: tests/electron 的电源状态单元测试，不执行 sudo 或修改系统休眠设置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createLidGuard } = require('../../electron/power-service');

test('合盖运行只在用户开启且存在终端时生效', () => {
  const commands = [];
  const persisted = [];
  const guard = createLidGuard({
    platform: 'darwin',
    setDisableSleep: (value) => { commands.push(value); return true; },
    persist: (value) => persisted.push(value),
  });
  guard.restore(true, 0);
  assert.deepEqual(guard.state(), { intent: true, active: false });
  guard.refresh(1);
  assert.deepEqual(guard.state(), { intent: true, active: true });
  guard.refresh(2);
  guard.refresh(0);
  assert.deepEqual(commands, [true, false]);
  assert.deepEqual(persisted, []);
});

test('系统命令失败会关闭意图并持久化安全状态', () => {
  const persisted = [];
  const guard = createLidGuard({ platform: 'darwin', setDisableSleep: () => false, persist: (value) => persisted.push(value) });
  guard.setIntent(true, 1);
  assert.deepEqual(guard.state(), { intent: false, active: false });
  assert.deepEqual(persisted, [true, false]);
});

test('退出时只恢复已生效的系统休眠状态', () => {
  const commands = [];
  const guard = createLidGuard({ platform: 'darwin', setDisableSleep: (value) => { commands.push(value); return true; } });
  guard.setIntent(true, 1);
  guard.shutdown();
  guard.shutdown();
  assert.deepEqual(commands, [true, false]);
  assert.deepEqual(guard.state(), { intent: true, active: false });
});
