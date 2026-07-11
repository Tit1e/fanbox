/**
 * [INPUT]: 依赖 Node.js 测试库与 electron/pty-service.js 的注入式终端服务
 * [OUTPUT]: 验证 PTY 生命周期、事件转发、重复 ID 和输入尺寸边界
 * [POS]: tests/electron 的终端领域服务单元测试，不启动 Electron 或真实 shell
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createPtyService, decodeLsofPath } = require('../../electron/pty-service');

test('PTY 服务管理完整生命周期并转发数据与退出事件', () => {
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
  const service = createPtyService({ pty, send: (...args) => sent.push(args), onCountChange: (count) => counts.push(count) });
  assert.equal(service.spawn({ id: 'term_1', cwd: process.cwd(), cols: 90, rows: 30 }).ok, true);
  assert.deepEqual(service.spawn({ id: 'term_1', cwd: process.cwd() }), { ok: false, error: '终端 ID 已存在' });
  service.input({ id: 'term_1', data: 'pwd\n' });
  service.resize({ id: 'term_1', cols: 120, rows: 40 });
  terminal.dataHandler('hello');
  assert.deepEqual(terminal.writes, ['pwd\n']);
  assert.deepEqual(terminal.sizes, [[120, 40]]);
  assert.deepEqual(sent[0], ['pty:data', { id: 'term_1', data: 'hello' }]);
  terminal.exitHandler({ exitCode: 0 });
  assert.deepEqual(counts, [1, 0]);
  assert.deepEqual(sent[1], ['pty:exit', { id: 'term_1', exitCode: 0 }]);
});

test('lsof 路径解码恢复 UTF-8 中文目录', () => {
  assert.equal(decodeLsofPath('/tmp/\\xe4\\xb8\\xad\\xe6\\x96\\x87'), '/tmp/中文');
});
