/**
 * [INPUT]: 依赖 Node.js 测试库与 electron/pty-service.js 的注入式终端服务
 * [OUTPUT]: 验证 PTY 生命周期、事件转发、顶层命令标记、前台进程与运行任务快照
 * [POS]: tests/electron 的终端领域服务单元测试，不启动 Electron 或真实 shell
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createPtyService, decodeLsofPath, foregroundProcessByPid } = require('../../electron/pty-service');

test('PTY 服务管理完整生命周期并转发数据与退出事件', async () => {
  const sent = [];
  const counts = [];
  let terminal;
  const pty = { spawn(shell, args, options) {
    terminal = {
      pid: 42,
      writes: [],
      sizes: [],
      write(value) { this.writes.push(value); },
      resize(cols, rows) { this.sizes.push([cols, rows]); },
      kill() { this.killed = true; },
      onData(handler) { this.dataHandler = handler; },
      onExit(handler) { this.exitHandler = handler; },
    };
    terminal.options = options;
    return terminal;
  } };
  const foregroundPids = [];
  const service = createPtyService({
    pty,
    send: (...args) => sent.push(args),
    onCountChange: (count) => counts.push(count),
    foregroundProcess: async (pid) => { foregroundPids.push(pid); return { ok: true, running: true }; },
  });
  assert.equal(service.spawn({ id: 'term_1', cwd: process.cwd(), cols: 90, rows: 30 }).ok, true);
  assert.deepEqual(service.spawn({ id: 'term_1', cwd: process.cwd() }), { ok: false, error: '终端 ID 已存在' });
  service.input({ id: 'term_1', data: 'pwd\n' });
  service.resize({ id: 'term_1', cols: 120, rows: 40 });
  terminal.dataHandler('hello');
  assert.deepEqual(terminal.writes, ['pwd\n']);
  assert.deepEqual(terminal.sizes, [[120, 40]]);
  assert.deepEqual(sent[0], ['pty:data', { id: 'term_1', data: 'hello' }]);
  assert.deepEqual(await service.hasForegroundProcess({ id: 'term_1' }), { ok: true, running: true });
  assert.deepEqual(foregroundPids, [42]);
  terminal.exitHandler({ exitCode: 0 });
  assert.deepEqual(counts, [1, 0]);
  assert.deepEqual(sent[1], ['pty:exit', { id: 'term_1', exitCode: 0 }]);
});

test('前台进程查询拒绝非法或不存在的终端', async () => {
  const service = createPtyService({ pty: null });
  assert.deepEqual(await service.hasForegroundProcess({ id: '../bad' }), { ok: false, running: false });
  assert.deepEqual(await service.hasForegroundProcess({ id: 'missing' }), { ok: false, running: false });
});

test('运行任务统计只计算确认存在前台进程的终端', async () => {
  let nextPid = 40;
  const pty = { spawn() {
    const terminal = {
      pid: ++nextPid,
      write() {}, resize() {}, kill() {}, onData() {}, onExit() {},
    };
    return terminal;
  } };
  const service = createPtyService({
    pty,
    foregroundProcess: async (pid) => {
      if (pid === 42) return { ok: true, running: true };
      if (pid === 43) return { ok: false, running: false };
      if (pid === 44) throw new Error('ps failed');
      return { ok: true, running: false };
    },
  });
  for (let index = 1; index <= 4; index++) {
    assert.equal(service.spawn({ id: `term_${index}`, cwd: process.cwd() }).ok, true);
  }
  assert.equal(await service.countRunningTasks(), 1);
  service.killAll();
  assert.equal(await service.countRunningTasks(), 0);
});

test('运行任务快照包含 Shell 集成捕获的原始顶层命令', async () => {
  let terminal;
  const pty = { spawn() {
    terminal = { pid: 71, write() {}, resize() {}, kill() {}, onData(handler) { this.dataHandler = handler; }, onExit() {} };
    return terminal;
  } };
  const service = createPtyService({
    pty,
    foregroundProcess: async () => ({ ok: true, running: true }),
    cwdLookup: async () => '/tmp/codexbox-project',
  });
  service.spawn({ id: 'tracked', cwd: process.cwd() });
  const encoded = Buffer.from('npm run dev').toString('base64');
  terminal.dataHandler(`\x1b]777;codexbox;start;${encoded}\x07`);
  assert.deepEqual(await service.runningTaskSnapshots(), [{ running: true, cwd: '/tmp/codexbox-project', command: 'npm run dev', title: 'codexbox-project' }]);
  terminal.dataHandler('\x1b]777;codexbox;end\x07');
  assert.equal((await service.runningTaskSnapshots())[0].command, '');
});

test('前台进程组区别于 Shell 进程组时识别为运行中', async () => {
  const idle = await foregroundProcessByPid(42, (file, args, options, cb) => cb(null, ' 42 42\n'));
  const running = await foregroundProcessByPid(42, (file, args, options, cb) => cb(null, ' 42 99\n'));
  const unknown = await foregroundProcessByPid(42, (file, args, options, cb) => cb(new Error('ps failed'), ''));
  assert.deepEqual(idle, { ok: true, running: false });
  assert.deepEqual(running, { ok: true, running: true });
  assert.deepEqual(unknown, { ok: false, running: false });
});

test('lsof 路径解码恢复 UTF-8 中文目录', () => {
  assert.equal(decodeLsofPath('/tmp/\\xe4\\xb8\\xad\\xe6\\x96\\x87'), '/tmp/中文');
});
