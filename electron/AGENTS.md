# electron/
> L2 | 父级: ../AGENTS.md

## 成员清单
main.js: Electron 主进程入口，管理 CodexBox 窗口、原生菜单、node-pty 会话、文件/剪贴板/更新 IPC 与应用生命周期，正式版沿用旧 FanBox 用户数据目录并隔离开发环境
preload.js: contextBridge 安全桥接层，向渲染进程暴露终端、文件、剪贴板、拖拽、截图与更新受控接口

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
