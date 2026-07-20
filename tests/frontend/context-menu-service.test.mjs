/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs 中的 Svelte 上下文菜单服务
 * [OUTPUT]: 验证菜单渲染、视口定位、普通点击打开、动作执行、外部点击与 Escape 关闭
 * [POS]: tests/frontend 的 Svelte ContextMenu 回归测试，覆盖文件、侧边栏和终端菜单共用行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setup() {
  const moduleUrl = new URL(`../../public/generated/ui.mjs?menu=${Date.now()}-${Math.random()}`, import.meta.url);
  const { createContextMenuService } = await import(moduleUrl);
  return createContextMenuService();
}

test('菜单在视口内定位并保留分隔线和危险项', async () => {
  const dom = installDom();
  try {
    const menus = await setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 300 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 200 });
    let prevented = 0;
    menus.popupMenu({ clientX: 500, clientY: 400, preventDefault: () => { prevented++; } }, [
      { label: '打开', fn() {} },
      { sep: true },
      { label: '删除', danger: true, fn() {} },
    ]);
    await settle();
    const menu = document.querySelector('#context-menu');
    assert.equal(prevented, 1);
    assert.equal(menu.style.left, '292px');
    assert.equal(menu.style.top, '192px');
    assert.equal(menu.querySelectorAll('.ctx-item').length, 2);
    assert.equal(menu.querySelectorAll('.ctx-sep').length, 1);
    assert.equal(menu.querySelector('.danger').textContent, '删除');
  } finally { dom.cleanup(); }
});

test('点击菜单项先关闭菜单再执行动作', async () => {
  const dom = installDom();
  try {
    const menus = await setup();
    let menuVisibleDuringAction = true;
    menus.popupMenu({ clientX: 10, clientY: 10, preventDefault() {} }, [{
      label: '执行',
      fn: () => { menuVisibleDuringAction = !!document.querySelector('#context-menu'); },
    }]);
    await settle();
    document.querySelector('.ctx-item').click();
    await settle();
    assert.equal(menuVisibleDuringAction, false);
    assert.equal(document.querySelector('#context-menu'), null);
  } finally { dom.cleanup(); }
});

test('普通点击打开菜单不会被同一次点击关闭', async () => {
  const dom = installDom('<button id="menu-trigger">设置</button>');
  try {
    const menus = await setup();
    document.querySelector('#menu-trigger').onclick = (event) => menus.popupMenu(event, [{ label: '编辑运行命令', fn() {} }]);
    document.querySelector('#menu-trigger').click();
    await settle();
    assert.equal(document.querySelector('#context-menu .ctx-item')?.textContent, '编辑运行命令');
  } finally { dom.cleanup(); }
});

test('外部点击和 Escape 都会关闭菜单', async () => {
  const dom = installDom();
  try {
    const menus = await setup();
    const open = () => menus.popupMenu({ clientX: 10, clientY: 10, preventDefault() {} }, [{ label: '打开', fn() {} }]);
    open();
    await settle();
    document.body.click();
    await settle();
    assert.equal(document.querySelector('#context-menu'), null);
    open();
    await settle();
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    assert.equal(document.querySelector('#context-menu'), null);
  } finally { dom.cleanup(); }
});
