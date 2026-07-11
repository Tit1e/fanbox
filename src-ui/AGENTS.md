# src-ui/
> L2 | 父级: ../AGENTS.md

## 成员清单
GitPanel.svelte: Svelte 5 Git 状态界面岛，声明式渲染分支汇总，并通过 body portal 定位增删行与变更文件弹层
DialogHost.svelte: Svelte 5 通用弹窗宿主，串行处理输入和确认请求、键盘操作、焦点与遮罩取消
dialog-service.js: 通用弹窗适配入口，向原生控制器暴露 Promise 接口并隐藏 Svelte 挂载生命周期
git-panel.js: Git 面板适配入口，连接现有 HTTP/Diff 领域能力与 Svelte 组件生命周期
index.js: Svelte 界面统一构建入口，导出 Git 面板和通用弹窗并共享运行时

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
