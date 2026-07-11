/**
 * [INPUT]: 依赖 Svelte mount 与 DialogHost.svelte
 * [OUTPUT]: 对外提供 createDialogService，暴露 inputDialog 和 confirmDialog Promise 接口
 * [POS]: src-ui 的通用弹窗适配器，为现有原生控制器隐藏 Svelte 组件生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { mount } from 'svelte';
import DialogHost from './DialogHost.svelte';

export function createDialogService() {
  let host = null;
  const ensure = () => {
    if (!host) host = mount(DialogHost, { target: document.body });
    return host;
  };
  return {
    inputDialog: (...args) => ensure().inputDialog(...args),
    confirmDialog: (...args) => ensure().confirmDialog(...args),
  };
}
