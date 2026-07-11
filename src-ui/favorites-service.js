/**
 * [INPUT]: 依赖 Svelte mount、FavoritesList.svelte、目录 API 与收藏交互回调
 * [OUTPUT]: 对外提供 createFavoritesService，暴露 render/setActive
 * [POS]: src-ui 的收藏列表适配层，连接原生收藏业务与 Svelte 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mount } from 'svelte';
import FavoritesList from './FavoritesList.svelte';

export function createFavoritesService({ target, api, navigate, openFile, remove, makeDraggable, folderIcon, fileIcon }) {
  let host = null;
  const ensure = () => host ||= mount(FavoritesList, { target, props: {
    navigate, openFile, remove, makeDraggable, folderIcon, fileIcon,
    listDirectories: async (path) => {
      const data = await api('/api/list?path=' + encodeURIComponent(path));
      return (data.entries || []).filter((entry) => entry.isDir && !entry.hidden);
    },
  } });
  return {
    render: (favorites, activePath) => ensure().render(favorites, activePath),
    setActive: (path) => ensure().setActive(path),
  };
}
