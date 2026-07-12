/**
 * [INPUT]: 依赖 Node.js 测试库、临时目录与 electron/shell-integration.js
 * [OUTPUT]: 验证 zsh 隔离配置生成、原配置复用、命令标记解析和分片处理
 * [POS]: tests/electron 的 Shell 顶层命令追踪单元测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { createZshIntegration, consumeShellMarkers } = require('../../electron/shell-integration');

test('生成隔离 zsh 配置并继续加载用户原配置', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexbox-shell-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = createZshIntegration(root, { ZDOTDIR: '/tmp/my-zdotdir' });
  const rc = fs.readFileSync(path.join(result.dir, '.zshrc'), 'utf8');
  assert.equal(result.originalZdotdir, '/tmp/my-zdotdir');
  assert.match(rc, /CODEXBOX_ORIGINAL_ZDOTDIR\/\.zshrc/);
  assert.match(rc, /add-zsh-hook preexec/);
  assert.match(rc, /add-zsh-hook precmd/);
});

test('命令标记跨数据块解析且不进入终端可见输出', () => {
  const state = { carry: '' };
  const markers = [];
  const command = 'npm run dev -- --host';
  const marker = `\x1b]777;codexbox;start;${Buffer.from(command).toString('base64')}\x07`;
  const first = consumeShellMarkers(state, `prompt${marker.slice(0, 18)}`, (item) => markers.push(item));
  const second = consumeShellMarkers(state, `${marker.slice(18)}output\x1b]777;codexbox;end\x07`, (item) => markers.push(item));
  assert.equal(first + second, 'promptoutput');
  assert.deepEqual(markers, [{ type: 'start', command }, { type: 'end' }]);
});
