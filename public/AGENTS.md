# public/
> L2 | 父级: ../AGENTS.md

## 成员清单
app.js: 原生 ES Module 渲染层主入口，编排文件管理、Git 查看、预览编辑、内嵌 xterm、选择性命令恢复、Codex 项目会话与全局交互
i18n-dict.js: 中文源文案到英文的静态词典与动态规则集合，导出 CODEXBOX_DICT 和 CODEXBOX_DICT_RULES
i18n.js: MutationObserver 国际化运行层，处理界面翻译和语言切换
index.html: 单页应用文件区、预览区与终端区 DOM 骨架及本地 vendor 脚本加载顺序
styles/: 按级联顺序拆分的主题、布局、预览、弹层、终端与文件跟随样式
modules/: 渲染层原生 ES Modules，按图标、状态、文件、预览、终端与文件跟随职责拆分
generated/: 由 build/svelte-ui.mjs 生成的 Svelte 离线浏览器模块
assets/: 渲染层使用的 Codex 图标等静态资源，入口图标为 codex.svg
vendor/: xterm、Monaco、Milkdown、highlight.js 等离线浏览器依赖

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
