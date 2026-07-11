# electron/
> L2 | 父级: ../AGENTS.md

## 成员清单
ipc-validation.js: Electron IPC 纯参数校验，约束 PTY、拖入、监听和更新请求
file-watch-service.js: 文件监听领域服务，维护多目录 FSWatcher 集合并转发真实变更
main.js: Electron 主进程编排入口，装配窗口、菜单、领域服务、IPC 与应用生命周期，正式版使用 CodexBox 用户数据目录并隔离开发环境
preload.js: contextBridge 安全桥接层，向渲染进程暴露终端、文件、剪贴板、拖拽、截图与更新受控接口
pty-service.js: PTY 领域服务，管理终端创建、输入、尺寸、当前目录、事件与销毁
system-file-service.js: 系统文件领域服务，处理图片/文件剪贴板和拖入文件安全落盘与复制

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
