# electron/
> L2 | 父级: ../AGENTS.md

## 成员清单
ipc-validation.js: Electron IPC 纯参数校验，约束 PTY、拖入、监听和更新请求
file-watch-service.js: 文件监听领域服务，维护多目录 FSWatcher 集合并转发真实变更
main.js: Electron 主进程编排入口，装配窗口、菜单、领域服务、IPC 与应用生命周期，将 Cmd/Ctrl+T、Cmd/Ctrl+Shift+T、Cmd/Ctrl+W 映射为新建终端、启动 Codex、关闭终端，并仅在真实前台任务存在时确认退出
preload.js: contextBridge 安全桥接层，向渲染进程暴露终端、文件、剪贴板、拖拽、截图、更新与新建终端/启动 Codex/关闭终端事件的受控接口
power-service.js: 合盖运行状态服务，以用户意图和终端数量驱动系统休眠开关并处理失败回退
pty-service.js: PTY 领域服务，管理终端创建、输入、尺寸、当前目录、前台进程检测、运行任务统计、事件与销毁
quit-service.js: 应用退出守卫，以 PTY 真实前台任务统计决定直接退出或显示确认框，并阻止重复退出检查
system-file-service.js: 系统文件领域服务，处理图片/文件剪贴板和拖入文件安全落盘与复制

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
