/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs 中的 Svelte 收藏列表服务
 * [OUTPUT]: 验证收藏空态、目录/文件渲染、活动高亮、打开与移除动作
 * [POS]: tests/frontend 的 Svelte FavoritesList 回归测试，保护侧边栏收藏交互
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('收藏列表区分目录和文件并转发打开与移除动作', async () => {
  const dom = installDom('<ul id="favs-list" class="nav-list"></ul>');
  try {
    const calls = [];
    const { createFavoritesService } = await import(new URL(`../../public/generated/ui.mjs?favorites=${Date.now()}`, import.meta.url));
    const service = createFavoritesService({
      target: document.querySelector('#favs-list'), api: async () => ({ entries: [] }),
      navigate: (path) => calls.push(['navigate', path]),
      openFile: (favorite) => calls.push(['open', favorite.path]),
      remove: (favorite) => calls.push(['remove', favorite.path]),
      makeDraggable: (_node, path) => calls.push(['drag', path]),
      folderIcon: '<svg data-folder></svg>', fileIcon: '<svg data-file></svg>',
    });
    service.render([], '/repo');
    await settle();
    assert.match(document.querySelector('.nav-empty').textContent, /悬停文件/);
    service.render([
      { name: 'Repo', path: '/repo', isDir: true },
      { name: 'note.md', path: '/repo/note.md', isDir: false },
    ], '/repo');
    await settle();
    assert.equal(document.querySelector('li[data-path="/repo"]').classList.contains('active'), true);
    document.querySelector('li[data-path="/repo/note.md"]').click();
    assert.deepEqual(calls.find((call) => call[0] === 'open'), ['open', '/repo/note.md']);
    document.querySelector('li[data-path="/repo/note.md"] .unfav').click();
    assert.deepEqual(calls.find((call) => call[0] === 'remove'), ['remove', '/repo/note.md']);
  } finally { dom.cleanup(); }
});
