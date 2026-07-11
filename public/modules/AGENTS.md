# modules/
> L2 | 父级: ../AGENTS.md

## 成员清单
command-palette.js: 全局命令面板控制器，提供文件名模糊搜索、内容搜索和结果导航
editors.js: Monaco 与 Milkdown Crepe 编辑器适配工厂，集中处理加载、主题、语言和资源释放
file-follow.js: Agent 文件跟随控制器，管理目标选择、实时代码/Markdown/HTML 渲染和变化反馈
file-browser.js: 文件浏览控制器，管理目录导航、列表渲染、选择、拖放与键盘移动
file-actions.js: 文件动作控制器，管理文本编辑、文件变更、开发工具面板和上下文菜单
icons.js: 文件类型与界面 SVG 图标工厂，提供富图标、通用图标和终端文件链接规则
image-editor.js: Canvas 图片编辑控制器，提供标注、打码、缩放、格式转换和安全保存
lifecycle.js: 应用生命周期控制器，完成界面初始化、首批数据加载和版本更新提示绑定
preview.js: 文件预览与布局控制器，管理内容预览、动作栏、分栏尺寸和全屏状态
sidebar.js: 侧边栏领域控制器，管理根目录树、收藏列表与 Codex 项目会话操作
terminal.js: 终端领域控制器，管理多标签 PTY、Codex 状态、文件拖放和停靠布局
ui-controller.js: 界面编排控制器，管理全局事件、主题、尺寸拖拽、终端设置和首次引导

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
