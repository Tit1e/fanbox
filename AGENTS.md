# CodexBox - Codex 的本地桌面驾驶舱
Electron 33.4.11 + Node.js >=18 + xterm.js 6.0.0 + node-pty 1.1.0 + 原生 HTML/CSS/JavaScript

<directory>
assets/ - README 与宣传页使用的产品截图和横幅
build/ - macOS 应用图标、权限与签名资源
docs/ - 产品、架构、验收与故障记录
electron/ - Electron 主进程、预加载安全桥接和桌面系统能力
experiments/ - 可独立执行的回归验证与技术实验
public/ - 浏览器渲染层、样式和本地 vendor 资源
server/ - 本地服务领域模块，承载配置、路径和 Codex 会话能力
src-vendor/ - vendor 浏览器包的 esbuild 源入口
tests/ - Node 内置自动化测试，覆盖服务端高风险逻辑
</directory>

<config>
package.json - CodexBox 桌面入口、依赖版本、测试检查和构建发布脚本
package-lock.json - npm 依赖锁文件
port-config.js - 正式/开发端口常量、合法范围及 CODEXBOX_PORT/CODEXBOX_DEV_PORT 环境隔离的唯一真源
server.js - 本地 HTTP 文件服务、带快照确认与运行态保护的 Codex 项目会话归档/删除、codexbox CLI 入口，按 --dev 选择端口模式
build/entitlements.mac.plist - macOS 签名和 hardened runtime 权限
</config>

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
