/**
 * [INPUT]: 依赖 Git 面板和通用弹窗两个 Svelte 界面岛适配器
 * [OUTPUT]: 对外统一导出 createGitPanel 与 createDialogService
 * [POS]: src-ui 的浏览器构建入口，保证多个界面岛共享一份 Svelte 运行时
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export { createGitPanel } from './git-panel.js';
export { createDialogService } from './dialog-service.js';
