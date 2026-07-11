/**
 * [INPUT]: 依赖 happy-dom 测试环境与 public/modules 控制器工厂
 * [OUTPUT]: 验证渲染层控制器公开方法契约完整且工厂可独立装配
 * [POS]: tests/frontend 的架构回归测试，防止拆分后导出遗漏或工厂初始化失败
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom, loadRendererModule } from './dom-environment.mjs';

const { createCommandPalette } = await loadRendererModule('command-palette');
const { createEditors } = await loadRendererModule('editors');
const { createEffects } = await loadRendererModule('effects');
const { createFileActionsController } = await loadRendererModule('file-actions');
const { createFileBrowserController } = await loadRendererModule('file-browser');
const { createFileFollowController } = await loadRendererModule('file-follow');
const { createIcons } = await loadRendererModule('icons');
const { createImageEditor } = await loadRendererModule('image-editor');
const { createPreviewController } = await loadRendererModule('preview');
const { createSidebarController } = await loadRendererModule('sidebar');
const { createTerminalController } = await loadRendererModule('terminal');
const { createUiController } = await loadRendererModule('ui-controller');

const noop = () => {};
const asyncNoop = async () => {};

function dependencyBag(overrides = {}) {
  const state = {
    cwd: '/workspace', home: '/home/test', sep: '/', entries: [], favorites: [], recentOpened: [],
    theme: 'warm', history: [], visible: [], previewW: 0, previewH: 0,
  };
  return new Proxy({ state, follow: { timers: {}, recentChanges: [] }, runtime: {}, $: () => null, ...overrides }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'api' || key === 'apiPost' || key === 'guardDirty' || key === 'confirmDialog') return asyncNoop;
      return noop;
    },
  });
}

test('所有渲染层控制器工厂可独立装配并保持公开接口', () => {
  const dom = installDom();
  try {
    const deps = dependencyBag();
    const icons = createIcons(deps.state);
    assert.equal(typeof icons.iconSvg, 'function');
    assert.equal(typeof createEditors(deps.state).mona.load, 'function');
    assert.equal(typeof createEffects(deps.state, deps.$).kindFromName, 'function');
    assert.equal(typeof createCommandPalette(deps).choose, 'function');
    assert.equal(typeof createFileActionsController(deps).refresh, 'function');
    assert.equal(typeof createFileBrowserController(deps).navigate, 'function');
    assert.equal(typeof createFileFollowController(deps).setFileFollow, 'function');
    assert.equal(typeof createImageEditor(deps).enterImageEdit, 'function');
    assert.equal(typeof createPreviewController(deps).openPreview, 'function');
    assert.equal(typeof createSidebarController(deps).loadCodexProjects, 'function');
    assert.equal(typeof createTerminalController(deps).openInDir, 'function');
    assert.equal(typeof createUiController(deps).bindEvents, 'function');
  } finally {
    dom.cleanup();
  }
});
