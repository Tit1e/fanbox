# tests/frontend/
> L2 | 父级: ../AGENTS.md

## 成员清单
controller-contracts.test.mjs: 渲染层控制器工厂的公开接口契约测试
context-menu-service.test.mjs: Svelte 上下文菜单测试，覆盖视口定位、危险项、动作执行与关闭路径
codex-projects.test.mjs: Svelte Codex 项目列表测试，覆盖活动高亮、目录展开、导航与菜单转发
dialog-service.test.mjs: Svelte 通用弹窗测试，覆盖输入、确认、焦点、键盘与请求串行
disk-panel.test.mjs: Svelte 磁盘透视测试，覆盖汇总、路径显示、目录下钻与关闭
dom-environment.mjs: happy-dom 全局环境安装与清理辅助工具，覆盖原生控制器和 Svelte 运行时 DOM 构造器
editor-guard.test.mjs: 自动保存、未保存确认、预览关闭与编辑器资源释放测试
file-follow.test.mjs: 文件跟随启停、终端绑定与手动导航接管测试
git-panel.test.mjs: Svelte Git 状态栏汇总、非仓库提示、变更文件弹层与 Diff 跳转测试
navigation.test.mjs: 文件浏览排序过滤与命令面板导航测试
release-panel.test.mjs: Svelte 发布向导测试，覆盖状态检查、版本递增、选项提交与终端启动
sidebar.test.mjs: Codex 项目会话归档、删除和运行态保护业务测试
terminal-close.test.mjs: 终端快捷键测试，覆盖收起面板后新建、快捷启动 Codex、前台进程关闭确认、界面 busy 误判回归和桌面事件绑定

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
