/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs 中的 Svelte Codex 项目列表服务
 * [OUTPUT]: 验证项目渲染、活动高亮、目录懒加载、导航与右键菜单转发
 * [POS]: tests/frontend 的 Svelte CodexProjects 回归测试，保护侧边栏项目交互
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Codex 项目列表渲染活动项并支持展开、导航和菜单', async () => {
  const dom = installDom('<ul id="codex-projects-list" class="nav-list"></ul>');
  try {
    const calls = [];
    const { createCodexProjectsService } = await import(new URL(`../../public/generated/ui.mjs?projects=${Date.now()}`, import.meta.url));
    const service = createCodexProjectsService({
      target: document.querySelector('#codex-projects-list'),
      api: async (url) => {
        calls.push(['api', url]);
        return { entries: [{ name: 'src', path: '/repo/src', isDir: true, hidden: false }, { name: '.git', path: '/repo/.git', isDir: true, hidden: true }] };
      },
      navigate: (path) => calls.push(['navigate', path]),
      makeDraggable: (_node, path) => calls.push(['drag', path]),
      openMenu: (_event, project) => calls.push(['menu', project.path]),
      folderIcon: '<svg data-folder></svg>',
    });
    service.render([{ name: 'Repo', path: '/repo', lastActive: Date.now() }], '/repo');
    await settle();
    const project = document.querySelector('li[data-path="/repo"]');
    assert.equal(project.classList.contains('active'), true);
    assert.equal(project.querySelector('.when').textContent, '刚刚');
    project.querySelector('.twirl').click();
    await settle();
    assert.match(calls.find((call) => call[0] === 'api')[1], /path=%2Frepo/);
    assert.equal(document.querySelectorAll('li[data-path="/repo/src"]').length, 1);
    project.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    assert.deepEqual(calls.find((call) => call[0] === 'menu'), ['menu', '/repo']);
    project.click();
    assert.deepEqual(calls.find((call) => call[0] === 'navigate'), ['navigate', '/repo']);
    service.setActive('/repo/src');
    await settle();
    assert.equal(document.querySelector('li[data-path="/repo/src"]').classList.contains('active'), true);
  } finally { dom.cleanup(); }
});
