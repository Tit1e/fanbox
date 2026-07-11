/**
 * [INPUT]: 依赖 happy-dom 与侧边栏控制器
 * [OUTPUT]: 验证 Codex 项目菜单的归档、删除、确认与运行态保护调用链
 * [POS]: tests/frontend 的 Codex 会话危险操作回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, loadRendererModule } from './dom-environment.mjs';

const { createSidebarController } = await loadRendererModule('sidebar');

const PROJECT = { name: 'Demo', path: '/workspace/demo', lastActive: Date.now() };

function createHarness(responses = {}) {
  const calls = [];
  let menuItems = [];
  const state = { cwd: '/workspace/demo', favorites: [], entries: [] };
  const controller = createSidebarController({
    $: (selector) => document.querySelector(selector),
    api: async (path) => {
      calls.push(['api', path]);
      return { projects: [PROJECT] };
    },
    apiPost: async (path, body) => {
      calls.push(['post', path, body]);
      if (path.endsWith('/inspect')) return responses.inspect || { ok: true, total: 2, running: 0, snapshot: 'snap-1' };
      return responses.mutate || { ok: true, succeeded: 2 };
    },
    state,
    svgWrap: () => '<svg></svg>',
    SVG: { folder: '', file: '' },
    escapeHtml: (value) => String(value),
    dirOf: () => '/workspace',
    navigate: () => {},
    makeDraggablePath: () => {},
    openPreview: () => {},
    renderFiles: () => {},
    toggleFav: () => {},
    toast: (message, error) => calls.push(['toast', message, !!error]),
    confirmDialog: async (message) => {
      calls.push(['confirm', message]);
      return responses.confirm !== false;
    },
    popupMenu: (_event, items) => { menuItems = items; },
    codexProjects: { render: () => {}, setActive: () => {} },
  });
  return { controller, calls, getMenuItems: () => menuItems };
}

async function openProjectMenu(harness) {
  await harness.controller.loadCodexProjects();
  harness.controller.showCodexProjectMenu(new window.MouseEvent('contextmenu', { cancelable: true }), PROJECT);
  return harness.getMenuItems();
}

test('归档项目会话先检查快照、请求确认，再提交归档', async () => {
  const dom = installDom('<ul id="roots-list"></ul><ul id="favs-list"></ul><ul id="codex-projects-list"></ul>');
  try {
    const harness = createHarness();
    const items = await openProjectMenu(harness);
    assert.deepEqual(items.map((item) => item.label), ['归档', '删除']);
    await items[0].fn();
    assert.deepEqual(harness.calls.filter((call) => call[0] === 'post'), [
      ['post', '/api/codex-projects/inspect', { path: PROJECT.path, action: 'archive' }],
      ['post', '/api/codex-projects/archive', { path: PROJECT.path, snapshot: 'snap-1' }],
    ]);
    assert.match(harness.calls.find((call) => call[0] === 'confirm')[1], /归档.*2 条会话/);
  } finally {
    dom.cleanup();
  }
});

test('删除项目会话使用删除端点并保留快照', async () => {
  const dom = installDom('<ul id="roots-list"></ul><ul id="favs-list"></ul><ul id="codex-projects-list"></ul>');
  try {
    const harness = createHarness();
    const items = await openProjectMenu(harness);
    await items[1].fn();
    assert.deepEqual(harness.calls.filter((call) => call[0] === 'post').at(-1), [
      'post', '/api/codex-projects/delete', { path: PROJECT.path, snapshot: 'snap-1' },
    ]);
    assert.match(harness.calls.find((call) => call[0] === 'confirm')[1], /永久删除.*不可恢复/);
  } finally {
    dom.cleanup();
  }
});

test('运行中的 Codex 会话阻止归档且不弹确认', async () => {
  const dom = installDom('<ul id="roots-list"></ul><ul id="favs-list"></ul><ul id="codex-projects-list"></ul>');
  try {
    const harness = createHarness({ inspect: { ok: true, total: 2, running: 1, snapshot: 'snap-1' } });
    const items = await openProjectMenu(harness);
    await items[0].fn();
    assert.equal(harness.calls.some((call) => call[0] === 'confirm'), false);
    assert.equal(harness.calls.filter((call) => call[0] === 'post').length, 1);
    assert.match(harness.calls.find((call) => call[0] === 'toast')[1], /正在运行/);
  } finally {
    dom.cleanup();
  }
});
