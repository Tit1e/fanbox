/**
 * [INPUT]: 依赖 Git 面板、通用弹窗、上下文菜单和磁盘透视四个 Svelte 界面岛适配器
 * [OUTPUT]: 对外统一导出 Git、弹窗、上下文菜单与磁盘透视服务
 * [POS]: src-ui 的浏览器构建入口，保证多个界面岛共享一份 Svelte 运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { createGitPanel } from './git-panel.js';
export { createDialogService } from './dialog-service.js';
export { createContextMenuService } from './context-menu-service.js';
export { createDiskPanelService } from './disk-panel-service.js';
