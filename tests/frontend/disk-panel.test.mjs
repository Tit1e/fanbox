/**
 * [INPUT]: 依赖 happy-dom 与 public/generated/ui.mjs 中的 Svelte 磁盘透视服务
 * [OUTPUT]: 验证磁盘汇总、目录下钻、路径显示和 Escape 关闭
 * [POS]: tests/frontend 的 Svelte DiskPanel 回归测试，保护 du 只读工作流
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installDom } from './dom-environment.mjs';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('磁盘透视展示汇总并支持目录下钻', async () => {
  const dom = installDom();
  try {
    const calls = [];
    const { createDiskPanelService } = await import(new URL(`../../public/generated/ui.mjs?disk=${Date.now()}`, import.meta.url));
    const service = createDiskPanelService({
      api: async (url) => {
        calls.push(url);
        return { ok: true, total: 2048, more: false, items: [{ name: 'src', size: 1024, isDir: true }, { name: 'a.txt', size: 512, isDir: false }] };
      },
      formatSize: (size) => `${size}B`,
      parentOf: (path) => path.slice(0, path.lastIndexOf('/')) || '/',
      separatorOf: () => '/',
      homeOf: () => '/home/test',
    });
    await service.diskPanel('/home/test/project');
    await settle();
    assert.equal(document.querySelector('.disk-title').textContent, '磁盘占用 · ~/project');
    assert.equal(document.querySelector('.disk-total').textContent, '共 2048B');
    assert.equal(document.querySelectorAll('.disk-row').length, 3);
    document.querySelector('.disk-row.is-dir').click();
    await settle();
    assert.match(calls[1], /%2Fhome%2Ftest%2Fproject%2Fsrc/);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    assert.equal(document.querySelector('.disk-overlay'), null);
  } finally { dom.cleanup(); }
});
