# src-ui/
> L2 | 父级: ../AGENTS.md

## 成员清单
GitPanel.svelte: Svelte 5 Git 状态界面岛，声明式渲染分支汇总，并通过 body portal 定位增删行与变更文件弹层
DialogHost.svelte: Svelte 5 通用弹窗宿主，串行处理输入和确认请求、键盘操作、焦点与遮罩取消
ContextMenu.svelte: Svelte 5 上下文菜单宿主，管理动作列表、视口定位、外部点击、窗口失焦与 Escape 关闭
DiskPanel.svelte: Svelte 5 磁盘透视界面岛，管理异步加载、错误态、占用条和目录下钻
ReleasePanel.svelte: Svelte 5 发布向导界面岛，管理版本、说明、发布选项、校验与提交状态
CodexProjects.svelte: Svelte 5 Codex 项目列表界面岛，管理项目渲染、活动目录与相对时间
ProjectDirectory.svelte: Codex 项目列表的递归目录节点，懒加载子目录并提供导航、拖拽和顶层菜单入口
codex-projects-service.js: Codex 项目列表适配入口，连接目录 API、侧边栏动作与 Svelte 组件
FavoritesList.svelte: Svelte 5 收藏列表界面岛，渲染目录/文件收藏并复用递归目录节点
favorites-service.js: 收藏列表适配入口，连接目录 API、导航预览与收藏移除动作
RootsList.svelte: Svelte 5 快速入口界面岛，复用递归目录节点渲染根目录树
roots-service.js: 快速入口适配层，连接根目录数据、目录 API 与导航拖拽动作
FileList.svelte: Svelte 5 主文件列表界面岛，声明式渲染网格/列表、缩略图、变更热度、收藏和选择状态
file-list-service.js: 主文件列表适配层，同步提交视图模型并提供选择、游标和网格列数接口
context-menu-service.js: 上下文菜单适配入口，向原生控制器保留 popupMenu/closeContextMenu 接口
disk-panel-service.js: 磁盘透视适配入口，连接 du API、路径工具与 Svelte 组件
release-panel-service.js: 发布向导适配入口，连接检查/准备 API、提示与终端命令执行
dialog-service.js: 通用弹窗适配入口，向原生控制器暴露 Promise 接口并隐藏 Svelte 挂载生命周期
git-panel.js: Git 面板适配入口，连接现有 HTTP/Diff 领域能力与 Svelte 组件生命周期
index.js: Svelte 界面统一构建入口，导出全部界面岛服务并共享运行时

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
