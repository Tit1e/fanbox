# tests/electron/
> L2 | 父级: ../AGENTS.md

## 成员清单
ipc-validation.test.js: PTY、监听目录、拖入文件与更新参数安全契约测试
file-watch-service.test.js: 真实临时目录上的 FSWatcher 集合切换、非法目录拒绝与清理测试
packaging-hook.test.js: macOS 发布包 node-pty spawn-helper 可执行权限与缺失产物阻断测试
power-service.test.js: 注入系统命令验证合盖运行意图、生效、失败回退和退出恢复
preload-contract.test.js: preload 暴露频道与主进程注册频道一致性测试
pty-service.test.js: 注入假 PTY 验证终端生命周期、命令标记、运行快照、路径解码和前台进程组识别
quit-service.test.js: 注入应用、弹窗、PTY 快照与恢复仓储验证空闲直退、保存、取消和请求去重
shell-integration.test.js: 临时目录中的 zsh 隔离配置生成、用户配置复用与分片命令标记解析测试
terminal-recovery-store.test.js: 临时目录中的恢复记录去重、隐私过滤、目录状态与一次性取出测试
system-file-service.test.js: 临时目录中的拖入落盘、同名避让、目录边界和图片剪贴板测试

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
