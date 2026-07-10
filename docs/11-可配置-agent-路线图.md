<!--
[INPUT]: 依赖社区 issue #38、当前 enabledAgents/agents 配置和 Agent 项目发现、整理引擎边界
[OUTPUT]: 对外提供可配置 Agent 已落地范围与剩余专属能力的适配原则
[POS]: docs 的 Agent 扩展路线图，区分通用启动配置与项目发现、整理等专属能力
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->
# 可配置 Agent 路线图（#38 建议一）

> 来源：社区 issue [#38](https://github.com/alchaincyf/fanbox/issues/38) 建议一。
> 状态：通用启动入口已在 v2.4.0 落地；项目记忆与续会话已移除，项目发现和整理引擎仍需要逐个 Agent 适配。

## 当前边界

FanBox 已经能从 `~/.fanbox/config.json` 读取启用项和自定义 Agent，并在终端顶栏动态生成启动入口。仍然与具体 Agent 耦合的部分是：

- Agent 项目发现：分别扫描 Claude Code 与 Codex 的会话目录。
- AI 整理引擎：当前只适配已验证的本地 CLI。

## 配置形态

内置 Agent 由应用提供稳定的 id、名称、命令和安装提示；高级用户可以在 `~/.fanbox/config.json` 的 `agents` 数组中覆盖同 id 项或追加新入口。启动配置只描述“如何启动”，不假装能统一所有会话格式。

```json
{
  "enabledAgents": ["claude", "codex", "pi"],
  "agents": [
    { "id": "pi", "label": "Pi AI", "cmd": "pi" },
    { "id": "aider", "label": "Aider", "cmd": "aider" }
  ]
}
```

## 难点：纯配置覆盖不了项目发现与整理引擎

`cmd` 和 `label` 是普通字符串，配置即可。但专属能力不能靠猜：

- Claude Code 与 Codex 用不同的本地会话格式记录项目路径，项目发现需要分别解析。
- AI 整理依赖 CLI 支持稳定的非交互启动参数和提示词输入方式。
- 第三方 Agent 可能没有公开且稳定的项目记录或终端 CLI。

因此，没有适配器的 Agent 只提供启动入口；项目发现和整理引擎必须在验证行为后单独接入。

## 适配纪律

1. 自定义 Agent 默认只获得启动入口，不推断额外能力。
2. 项目发现适配必须有稳定的本地项目路径证据。
3. 整理引擎适配必须验证真实 CLI 的参数、退出状态和错误输出。
4. 社区新增适配器时必须附真实样本和回归验证，避免上游变化静默损坏。

## 不做

- 不为只提供桌面应用、没有终端 CLI 的产品伪造终端能力。
- 不把不同 Agent 的项目记录格式硬塞进一份臃肿配置。
- 不恢复项目记忆、会话考古或一键续会话入口。
