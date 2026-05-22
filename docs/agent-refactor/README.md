# Agent 模式重构方案总览

## 背景

当前 CodeInsights 的 Agent 模式已经接入 `@anthropic-ai/claude-agent-sdk`，但应用层仍承担了大量 Agent 编排细节：事件模型转换、权限调度、Teams 自动恢复、消息兼容持久化、工作区能力注入、工具活动重建等。它已经不是简单的 Chat UI，但也还没有形成一个清晰的 Claude Code 运行时平台边界。

happyclaw 的核心理念更明确：不重新实现 Agent 能力，直接复用完整 Claude Code CLI 运行时。应用只负责入口、隔离、配置、路由、事件可视化和宿主能力桥接。

本目录给出 CodeInsights Agent 模式的重构方案。目标不是把 happyclaw 的 SaaS、IM Bot、Docker、计费和多用户后台整体搬进 Electron，而是迁移它的架构原则。

## 方案文档

- [现状与差距](./current-state-and-gap.md)
- [目标架构](./target-architecture.md)
- [迁移路线](./migration-plan.md)
- [行为基线清单](./baseline-checklist.md)
- [事件契约](./event-contract.md)
- [Runtime Manifest](./runtime-manifest.md)
- [第一批实现 PR 拆分](./implementation-prs.md)
- [开发进度跟踪清单](./development-checklist.md)
- [下次启动 Codex 提示词](./next-session-prompt.md)

## 阅读路径

建议按四层阅读：

1. 先读本文，确认重构方向和不做什么。
2. 再读 [现状与差距](./current-state-and-gap.md)，对照当前代码找到职责过载、事件双轨和 runtime 不对齐的位置。
3. 然后读 [目标架构](./target-architecture.md) 与 [迁移路线](./migration-plan.md)，确认模块边界和阶段顺序。
4. 实现前读 [行为基线清单](./baseline-checklist.md)、[事件契约](./event-contract.md)、[Runtime Manifest](./runtime-manifest.md) 和 [第一批实现 PR 拆分](./implementation-prs.md)，把阶段拆成可验证 PR。
5. 后续迭代按 [开发进度跟踪清单](./development-checklist.md) 更新状态、验证结果和回滚记录。
6. 重新启动 Codex 会话时，可使用 [下次启动 Codex 提示词](./next-session-prompt.md) 恢复上下文并继续飞书阻塞项或后续稳定化阶段。

## 当前进度

- 阶段 0-12 已完成并提交，阶段 13 的 Runner v2 证据补齐与收尾补强也已完成到可审计状态。
- 阶段 13 关键提交：`328b3c96`、`46e62a75`、`acc769f1`、`b3d0517e`、`6171f164`、`10356a3a`；文档交接同步提交：`353c5c53`。
- 阶段 14 默认化评估计划已建立并提交：`02199299 docs(agent): 建立阶段14 Runner v2 默认化评估计划`。
- 阶段 14A Agent Runner v2 默认化已完成并提交：`88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化`。未设置 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2` 时默认走 Runner v2，显式 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 可回到旧主循环。
- 阶段 14B Pipeline Runner v2 默认化已完成并提交：`be82e53d feat(agent): 完成阶段14B Pipeline Runner v2 默认化`。未设置 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2` 时默认走 Pipeline Runner v2，显式 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0` 可回到 Pipeline legacy adapter。
- 阶段 14C Channels v2 默认化已按用户指示排除飞书真实入口阻塞后完成代码侧评估。未设置 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2` 时默认走 Channels v2，显式 `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0` 可回到旧 Feishu bridge 路径。
- 阶段 15 Agent Runner 链路手动切换已完成实现与聚焦验证。Agent 输入区底部工具栏可在后续发送前选择 `Runner v2` 或 `Legacy`，并通过 settings 持久化；`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0` 仍硬回滚旧主循环。
- 当前版本：`@codeinsights/shared@0.1.41`，`@codeinsights/electron@0.0.99`。
- 默认 Agent 对话、默认 Pipeline Claude 节点和默认 Channels v2 入口现在均走 v2 路径，三者均保留显式 env 关闭回滚。
- 阶段 13 已补齐 Runner v2 代码侧等价证据：自动重试、typed error 持久化、catch error SDKMessage 持久化、`sdk_message` UI 推送、重复 `run_started/sdk_session` 去重、Plan Mode 退出、Watchdog、Teams auto-resume。
- 阶段 13 已补齐真实 Electron Runner v2 交互：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- Pipeline 深水位真实 UI run 已完成：session `342a6f0f-bea1-40eb-9396-378685bfaadc` 已到 developer / reviewer / tester / committer draft，写入完整 `patch-work` 与 `patch-set`，并复验 Git guard、HEAD / refs / index / config 和 tester evidence。
- 阶段 14B 默认 Pipeline 深水位真实 UI run 已完成：session `a70c02d0-ff2f-4283-b121-cd963771fd9f` 已到 explorer / planner / developer / reviewer / tester / committer，最终 completed；显式关闭回滚 session `1112d7fc-ab4b-4e4b-bedf-193533a7daec` 日志确认走 legacy adapter。
- Codex Pipeline runner 已完成收尾补强：支持 `CODEX_HOME/auth.json`，API key 模式隔离继承的 `CODEX_HOME`，strict schema 递归校验所有 object schema，Git snapshot 清理宿主 `GIT_*` 并 fail closed，clean-env 单测通过。
- 阶段 14 分批策略已写入 checklist：14A 已完成 Agent Runner v2 默认化；14B 已完成 Pipeline Runner v2 默认化；14C 已按用户指示不以飞书真实入口为阻塞完成 Channels v2 默认化。

## 仍未完成

- 飞书入口和飞书群聊 MCP 仍受本机缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 阻塞，不能伪造通过；阶段 14C 不声明真实飞书入口已通过。
- 如果后续需要声明飞书真实可用，仍需补真实飞书入口和群聊 MCP 验证。
- 后续旧路径清理仍必须保留明确回滚点，并重新跑完整聚焦验证与真实 Electron 交互复核。
- 删除旧路径、旧 adapter 或旧兼容逻辑只能作为默认开启稳定后的后续阶段，不能在当前状态直接清理。

本方案不是 UI 视觉改造，也不是一次性删除旧 Agent。它是把当前 Agent 模式从“Electron 主进程里一个很厚的 Orchestrator”收敛成“可复用的本地 Claude Code runtime”。

## 重构原则

1. **Claude Code 原生优先**
   Agent 执行、工具、SubAgent、MCP、Plugin、Skill、session resume 尽量交给 Claude Code / Claude Agent SDK。CodeInsights 不再扩大自研 Agent runtime。

2. **Runner 边界清晰**
   Electron 主进程不再直接承载所有 Agent 编排细节。新增本地 `Agent Runtime Runner` 边界：主进程负责调度和 IPC，Runner 负责调用 SDK、处理原生事件、维护 SDK session 语义。

3. **Shared Event Contract 单一真相源**
   把 Agent 流式事件定义收敛到 `@codeinsights/shared`。Renderer 只消费稳定事件，不再依赖主进程临时兼容转换。

4. **本地优先，不引入数据库**
   继续使用 `~/.codeinsights/` 下的 JSON / JSONL / workspace files。不要引入 SQLite 或 SaaS 账户体系。

5. **工作区能力通过 Claude 原生机制暴露**
   MCP、Skills、Plugins、CLAUDE.md、settings.json 需要与 Claude Code 原生发现机制对齐。应用层负责物化和配置，不把能力硬编码进 prompt。

6. **权限默认保守**
   happyclaw 在容器/多租户边界下大量使用 `bypassPermissions`。CodeInsights 是本地桌面应用，必须保留 `safe / ask / allow-all / plan` 等用户可见权限策略，不能简单跳过权限。

7. **客户端 UI 默认不变，显式确认后例外**
   本次 Agent 模式重构主体是运行时、事件、存储和渠道边界重构，不是客户端界面改版。除非用户另行确认，任何阶段都不得改变 Electron 客户端的布局、视觉样式、文案、入口位置、按钮行为和交互流程。阶段 15 的 Runner 链路切换按钮属于用户明确确认后的例外。

## 不照搬项

- 不照搬多用户 SaaS 认证、邀请码、RBAC、计费、钱包和管理后台。
- 不把 IM JID 路由作为 Agent 核心会话模型；飞书/钉钉/微信只作为外部入口适配层。
- 不默认引入 Docker 作为本地桌面 Agent 的执行依赖。
- 不迁移 SQLite/WAL/migration 模型，继续使用本地配置文件。
- 不把 happyclaw 的 IM-first streaming card 设计强塞到 Electron 主 UI。
- 不借重构名义修改客户端 UI 视觉、布局、文案或交互入口。

## 预期结果

重构完成后，CodeInsights 的 Agent 模式应变成：

- 一个本地桌面 Claude Code cockpit。
- 每个工作区都有清晰的 Claude runtime 根目录。
- 每个会话可恢复、可回退、可分叉，但语义尽量贴近 Claude Code session。
- MCP / Skill / Plugin 由 workspace runtime 物化，SDK 原生加载。
- Renderer 通过统一事件流展示 Claude Code 执行过程。
- 飞书等外部渠道可以复用同一运行时，而不是另开一套 Agent 逻辑。

## 最终交付物

架构层交付物：

- `AgentRuntimeService`：统一会话调度、队列、停止、权限挂起、事件广播。
- `AgentRuntimeRunner`：唯一 Claude Agent SDK 调用入口，输出可重放事件。
- `WorkspaceRuntimeRegistry`：把 CodeInsights workspace 映射为 Claude runtime root、session cwd 和能力清单。
- `RuntimeMaterializer`：物化 MCP、Skills、Plugins、CLAUDE.md、settings.json。
- `AgentChannel`：Electron、飞书、后续 Telegram 等入口共享同一运行时。

契约层交付物：

- `AgentStreamEnvelope` / `AgentRuntimeEvent` 作为唯一实时事件协议。
- `AgentRuntimeManifest` 记录每个 workspace/session 的 runtime path、配置版本和能力快照。
- `AgentRunResult` 记录 SDK session、usage、stop reason、错误分类和 transcript 索引。

验证层交付物：

- 事件 fixture：覆盖文本、工具、权限、AskUser、MCP、错误、停止、resume。
- runner fixture：用 mock SDK stream 验证事件序列和中止行为。
- migration fixture：旧 JSONL session 能继续打开、resume、fork、rewind。

## 取舍规则

后续实现时，每个改动都按下面规则判断是否应该进入 Agent runtime：

| 问题 | 判断标准 | 推荐归属 |
| --- | --- | --- |
| Claude Code 已原生支持吗 | 支持时优先传给 SDK，不在应用层重写 | Runner / SDK options |
| 是否涉及 Electron UI 状态 | 只影响展示和交互，不进入 SDK 语义 | Renderer / Jotai |
| 是否是 CodeInsights 宿主能力 | 例如记忆、文件面板、通知、Pipeline 控制 | 内置 MCP bridge |
| 是否是渠道格式差异 | 飞书卡片、微信短文本、Electron timeline | Channel Adapter |
| 是否需要持久恢复 | session metadata、event log、runtime manifest | Local Store |
| 是否影响权限 | 写文件、执行命令、网络、外部路径、MCP side effect | Permission Service + Runner callback |

## UI 不变约束

除用户明确确认的 UI 暴露阶段外，后续实现必须满足：

- `AgentView`、`AgentHeader`、`AgentMessages`、`AgentInput`、权限横幅、AskUser 横幅、右侧文件面板的可见布局不变。
- 不新增可见按钮、tab、面板、banner、状态 chip 或说明文案。
- 不改现有 CSS class 的视觉效果，不引入新的视觉主题。
- 不改变用户发送、停止、审批权限、回答 AskUser、切换 session、打开文件面板的操作路径。
- 新旧 reducer 双跑期间只允许开发日志记录差异，不在 UI 上展示调试信息。
- 如果某阶段必须暴露新状态，只能先写入文档并单独征求用户确认。
- 阶段 15 已按用户确认暴露 Runner 链路切换按钮；后续新增可见状态仍需单独确认。
