/**
 * [INPUT]: 依赖 Svelte mount/unmount、GitPanel.svelte、Git HTTP API 与现有 Diff 打开能力
 * [OUTPUT]: 对外提供 createGitPanel，维持 Git 前台加载、静默刷新、并发保护和文件动作边界
 * [POS]: src-ui 的 Git 面板适配器，连接现有原生控制器体系与 Svelte 界面岛
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mount, unmount } from 'svelte';
import GitPanel from './GitPanel.svelte';

export function createGitPanel({ $, api, ic, kindFromName, showDiff, toast }) {
  let data = null;
  let loading = false;
  let requestId = 0;
  let pendingDirectory = null;
  let component = null;
  let mountedTarget = null;

  function ensureMounted() {
    const target = $('#git-status-slot');
    if (!target) return null;
    if (component && mountedTarget !== target) {
      unmount(component);
      component = null;
    }
    if (!component) {
      mountedTarget = target;
      component = mount(GitPanel, {
        target,
        props: {
          icon: ic('gitbranch', 'currentColor', 12),
          onFile: openFile,
        },
      });
    }
    return component;
  }

  function render() {
    ensureMounted()?.update({ data, loading });
  }

  async function openFile(file) {
    if (file.binary) { toast('二进制文件不支持内容比较'); return; }
    close();
    await showDiff({
      path: file.path,
      name: file.name,
      kind: kindFromName(file.name),
      deleted: file.deleted,
      size: 0,
      mtime: 0,
    });
  }

  function open() { ensureMounted()?.open(); }
  function close() { component?.close(); }

  async function load(directory, { silent = false } = {}) {
    if (!directory || (loading && pendingDirectory === directory)) return;
    const id = ++requestId;
    pendingDirectory = directory;
    loading = true;
    if (!silent) { data = null; close(); }
    render();
    try {
      const result = await api('/api/git?path=' + encodeURIComponent(directory));
      if (id !== requestId) return;
      data = result;
    } catch {
      if (id !== requestId) return;
      data = { available: false, isRepo: false };
    } finally {
      if (id === requestId) { loading = false; pendingDirectory = null; render(); }
    }
  }

  return { load, refresh: (directory) => load(directory, { silent: true }), render, open, close, current: () => data };
}
