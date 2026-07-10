# public/
> L2 | 父级: ../AGENTS.md

## 成员清单
app.js: 渲染层主入口，编排文件管理、预览编辑、内嵌 xterm、文件变更时间轴、Codex 与全局交互
i18n-dict.js: 中文源文案到英文的静态词典与动态规则集合，导出 FANBOX_DICT 和 FANBOX_DICT_RULES
i18n.js: MutationObserver 国际化运行层，处理界面翻译和语言切换
index.html: 单页应用文件区、预览区与终端区 DOM 骨架及本地 vendor 脚本加载顺序
style.css: 三套主题、布局、文件变更回放、组件和响应式样式
assets/: 渲染层使用的 Codex 图标等静态资源，入口图标为 codex.svg
vendor/: xterm、Monaco、Milkdown、highlight.js 等离线浏览器依赖

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
