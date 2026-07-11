/**
 * [INPUT]: 依赖 Svelte mount、CodexProjects.svelte、目录 API 与侧边栏交互回调
 * [OUTPUT]: 对外提供 createCodexProjectsService，暴露 render/setActive
 * [POS]: src-ui 的 Codex 项目列表适配层，连接原生侧边栏控制器与 Svelte 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mount } from 'svelte';
import CodexProjects from './CodexProjects.svelte';

export function createCodexProjectsService({ target, api, navigate, makeDraggable, openMenu, folderIcon }) {
  let host = null;
  const ensure = () => host ||= mount(CodexProjects, { target, props: {
    navigate,
    makeDraggable,
    openMenu,
    folderIcon,
    listDirectories: async (path) => {
      const data = await api('/api/list?path=' + encodeURIComponent(path));
      return (data.entries || []).filter((entry) => entry.isDir && !entry.hidden);
    },
  } });
  return {
    render: (projects, activePath) => ensure().render(projects, activePath),
    setActive: (path) => ensure().setActive(path),
  };
}
