/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs 中的 Svelte 通用弹窗服务
 * [OUTPUT]: 验证输入、确认、终端恢复选择、键盘操作、焦点和请求串行行为
 * [POS]: tests/frontend 的 Svelte DialogHost 回归测试，保护所有文件与终端确认流程
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setup() {
  const moduleUrl = new URL(`../../public/generated/ui.mjs?dialog=${Date.now()}-${Math.random()}`, import.meta.url);
  const { createDialogService } = await import(moduleUrl);
  return createDialogService();
}

test('输入弹窗自动聚焦，并用 Enter 返回清理后的文本', async () => {
  const dom = installDom();
  try {
    const dialogs = await setup();
    const result = dialogs.inputDialog('重命名', '旧名称', '输入新名称');
    await settle();
    const input = document.querySelector('.input-field');
    assert.equal(document.activeElement, input);
    assert.equal(input.value, '旧名称');
    input.value = '  新名称  ';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(await result, '新名称');
    await settle();
    assert.equal(document.querySelector('.input-overlay'), null);
  } finally { dom.cleanup(); }
});

test('确认弹窗支持 Escape 取消', async () => {
  const dom = installDom();
  try {
    const dialogs = await setup();
    const result = dialogs.confirmDialog('确定关闭？');
    await settle();
    assert.equal(document.querySelector('.input-title').textContent, '确定关闭？');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await result, false);
  } finally { dom.cleanup(); }
});

test('并发弹窗请求串行展示且分别完成', async () => {
  const dom = installDom();
  try {
    const dialogs = await setup();
    const first = dialogs.confirmDialog('第一个');
    const second = dialogs.inputDialog('第二个', '初始值');
    await settle();
    assert.equal(document.querySelector('.input-title').textContent, '第一个');
    document.querySelector('.primary').click();
    assert.equal(await first, true);
    await settle();
    assert.equal(document.querySelector('.input-title').textContent, '第二个');
    document.querySelector('.ghost-btn').click();
    assert.equal(await second, null);
  } finally { dom.cleanup(); }
});

test('终端恢复弹窗默认选择有效目录并支持选择性恢复', async () => {
  const dom = installDom();
  try {
    const dialogs = await setup();
    const result = dialogs.recoveryDialog([
      { id: 'a', command: 'codex', cwd: '/tmp/a', available: true },
      { id: 'b', command: 'npm run dev', cwd: '/missing', available: false },
    ]);
    await settle();
    const checks = [...document.querySelectorAll('.recovery-list input')];
    assert.equal(checks[0].checked, true);
    assert.equal(checks[1].disabled, true);
    document.querySelector('.recovery-actions .ghost-btn:not(.danger)').click();
    assert.deepEqual(await result, { action: 'restore', ids: ['a'] });
  } finally { dom.cleanup(); }
});

test('关闭终端恢复弹窗会保留记录而不是清除', async () => {
  const dom = installDom();
  try {
    const dialogs = await setup();
    const result = dialogs.recoveryDialog([{ id: 'a', command: 'codex', cwd: '/tmp/a', available: true }]);
    await settle();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(await result, null);
  } finally { dom.cleanup(); }
});
