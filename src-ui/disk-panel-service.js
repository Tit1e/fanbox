/**
 * [INPUT]: 依赖 Svelte mount、DiskPanel.svelte、磁盘 HTTP API 和路径/大小工具
 * [OUTPUT]: 对外提供 createDiskPanelService，暴露 diskPanel(directory) 入口
 * [POS]: src-ui 的磁盘透视适配器，为原生控制器隐藏 Svelte 生命周期和数据协议
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mount } from 'svelte';
import DiskPanel from './DiskPanel.svelte';

export function createDiskPanelService({ api, formatSize, parentOf, separatorOf, homeOf }) {
  let host = null;
  const ensure = () => {
    if (!host) host = mount(DiskPanel, {
      target: document.body,
      props: {
        loadData: (path) => api('/api/du?path=' + encodeURIComponent(path)),
        formatSize,
        parentOf,
        childOf: (path, name) => {
          const separator = separatorOf();
          return (path.endsWith(separator) ? path.slice(0, -separator.length) : path) + separator + name;
        },
        displayPath: (path) => homeOf() && path.startsWith(homeOf()) ? '~' + path.slice(homeOf().length) : path,
      },
    });
    return host;
  };
  return { diskPanel: (directory) => ensure().open(directory) };
}
