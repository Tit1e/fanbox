/**
 * [INPUT]: 依赖 Svelte mount/flushSync、FileList.svelte 与文件图标/格式化能力
 * [OUTPUT]: 对外提供 createFileListService，暴露 render/setSelection/setCursor/measureColumns
 * [POS]: src-ui 的主文件列表适配层，连接文件浏览控制器与 Svelte 组件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { flushSync, mount } from 'svelte';
import FileList from './FileList.svelte';

export function createFileListService({ target, iconSvg, iconColorFor, formatSize, formatTime, favoriteIcon, emptyIcon }) {
  const host = mount(FileList, { target, props: { iconSvg, iconColorFor, formatSize, formatTime, favoriteIcon, emptyIcon } });
  return {
    render(model, actions) { flushSync(() => host.render(model, actions)); },
    setSelection(path) { flushSync(() => host.setSelection(path)); },
    setCursor(index) { flushSync(() => host.setCursor(index)); },
    measureColumns() {
      if (target.querySelector('.list')) return 1;
      const items = target.querySelectorAll('.item');
      if (!items.length) return 1;
      const top = items[0].offsetTop;
      let count = 0;
      for (const item of items) { if (item.offsetTop === top) count++; else break; }
      return Math.max(1, count);
    },
  };
}
