# src-ui/
> L2 | 父级: ../AGENTS.md

## 成员清单
GitPanel.svelte: Svelte 5 Git 状态界面岛，声明式渲染分支汇总，并通过 body portal 定位增删行与变更文件弹层
DialogHost.svelte: Svelte 5 通用弹窗宿主，串行处理输入和确认请求、键盘操作、焦点与遮罩取消
ContextMenu.svelte: Svelte 5 上下文菜单宿主，管理动作列表、视口定位、外部点击、窗口失焦与 Escape 关闭
DiskPanel.svelte: Svelte 5 磁盘透视界面岛，管理异步加载、错误态、占用条和目录下钻
context-menu-service.js: 上下文菜单适配入口，向原生控制器保留 popupMenu/closeContextMenu 接口
disk-panel-service.js: 磁盘透视适配入口，连接 du API、路径工具与 Svelte 组件
dialog-service.js: 通用弹窗适配入口，向原生控制器暴露 Promise 接口并隐藏 Svelte 挂载生命周期
git-panel.js: Git 面板适配入口，连接现有 HTTP/Diff 领域能力与 Svelte 组件生命周期
index.js: Svelte 界面统一构建入口，导出 Git 面板和通用弹窗并共享运行时

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
