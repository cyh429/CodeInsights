# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights

必须先阅读：
- tasks/lessons.md
- tasks/todo.md
- docs/agent-refactor/README.md
- docs/agent-refactor/development-checklist.md
- docs/agent-refactor/event-contract.md
- docs/agent-refactor/runtime-manifest.md
- docs/agent-refactor/baseline-runs/2026-05-17-round-1.md

当前已完成并提交：
- 方案阶段：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 阶段 0：47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线
- 阶段 1：d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约
- 阶段 2：04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写
- 阶段 3 交接文档：d7d0ae60 docs(agent): 更新 Agent 重构阶段 3 交接提示
- 阶段 3：ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner
- 阶段 4：18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析
- 阶段 5 交接文档：410d8945 docs(agent): 更新阶段 5 交接提示词
- 阶段 5：10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer
- 阶段 6：05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化
- 阶段 7：eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge
- 阶段 8：6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer
- 阶段 9：09e558a7 feat(agent): 完成 Agent 重构阶段 9 External Channel Adapter
- 阶段 10：feat(agent): 完成阶段10 Pipeline 复用 Runner
- 阶段 11：2760a3e8 feat(agent): 完成阶段11旧路径清理

当前状态：
- 阶段 0 已冻结首轮行为基线，但仍缺少实时 Electron 桌面交互证据。
- 阶段 1 已新增 shared runtime event contract：AgentStreamEnvelope / AgentRuntimeEvent / validator / adapter / replay reducer 测试骨架。
- 阶段 2 已在旧 Agent 运行路径旁边双写 `{session-id}.events.jsonl`，旧 SDKMessage JSONL 仍保留为 transcript/debug/resume 数据源。
- 阶段 3 已新增 InProcessAgentRuntimeRunner，抽出 SDK query / stream 边界；Runner 输出 `AsyncIterable<AgentStreamEnvelope>`，通过 callback 处理权限和 AskUser，通过 store interface 写 SDKMessage。
- 阶段 4 已新增只读 Runtime Manifest Registry，能从旧 workspace 解析 `mcp.json`、`skills/`、`skills-inactive/`、plugin manifest 和 attached directories，生成 source hash / runtimeHash / 能力快照。
- 阶段 5 已完成 Runtime Materializer for New Sessions：新 session 会物化 runtime 目录、session cwd、settings、MCP、CLAUDE.md、skills/plugins snapshot 和 runtime-manifest.json；旧 session 继续使用旧 cwd / resume 路径。
- 阶段 6 已完成插件系统原生化：新增 plugin catalog / enabled refs / local plugin import / snapshot materializer / command index；materialized session 的 SDK `plugins` 指向 RV snapshot，旧 session 继续走旧 workspace plugin 路径。
- 阶段 7 已完成内置 MCP Bridge：新增 `rv_host` in-process MCP server 和 host bridge handlers；默认 manifest 只注册只读工具 `rv_workspace_search`、`rv_list_workspace_files`、`rv_memory_search`、`rv_open_file`；side-effect handlers 已实现但不默认暴露；manifest 记录 hostBridge version/configHash 并纳入 runtimeHash；恢复已物化 session 时会校验 `rv-host-bridge.json` 未被篡改；Orchestrator 拒绝 custom MCP 覆盖内置 `rv_host`。
- 阶段 8 已完成 Renderer 切新 Reducer：Renderer 主路径优先把 `AgentStreamPayload` 适配为 `AgentStreamEnvelope` 并应用 runtime reducer；旧 `payloadToLegacyEvents()` 仍保留给副作用、transcript/debug 兼容和回滚；event replay 可恢复 pending permission / AskUser / ExitPlanMode request 与 Plan Mode 状态。
- 阶段 9 已完成 External Channel Adapter：新增 `AgentChannel` 抽象、`ElectronAgentChannel`、`FeishuChannelAdapter` 和 `FileAgentChannelBindingStore`；飞书 v2 路径只消费 `AgentStreamEnvelope`，assistant delta 节流输出，run completed 拼接最终 Markdown，permission requested 默认 `queue_to_desktop`；`agentRuntimeChannelsV2` 默认关闭，旧 Feishu bridge 和旧绑定文件保留回滚路径；飞书群聊 `feishu_chat` MCP 仍作为 run overlay 传入，不写 workspace manifest。
- 阶段 10 已完成 Pipeline 复用 Runner：`AgentRuntimeRunInput` 新增可选判别联合 metadata；Pipeline Claude 节点在 `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` 时通过 `InProcessAgentRuntimeRunner` 执行 SDK query，默认关闭时仍走旧 adapter query 路径；`pipeline-node-runner.ts` 复用共享 SDK env / CLI 解析；Pipeline checkpoint、human gate、结构化 schema、patch-work 写入、防护和 UI 行为保持独立。
- 阶段 11 已完成旧路径清理：删除 Renderer 端已不可达的旧 reducer fallback 和 shadow compare；`payloadToLegacyEvents()` 仍保留为副作用适配层；SDK env 测试改走统一 `agent-sdk-env.ts`；未删除 Agent 主循环旧 `adapter.query()`、Pipeline legacy adapter、shared `adaptAgentEventToRuntimeEvent()` 或旧 session transcript 兼容。
- Orchestrator 已接入 `agentRuntimeRunnerV2` feature flag，但默认关闭；真实 Agent 对话仍走旧 Orchestrator 路径，因此客户端 UI 和默认行为没有可见变化。
- `@rv-insights/shared` 当前为 `0.1.40`；`@rv-insights/electron` 当前为 `0.0.88`。

当前未完成：
- 阶段 12 真实交互补跑与 Runner v2 默认化准备尚未开始。
- 阶段 0 真实交互缺口仍保留：并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书。
- 阶段 7 真实 MCP 可见性仍未人工补跑：目前只有 host MCP bridge / materializer / manifest 聚焦测试，未启动 Electron 桌面壳或真实 Claude Code MCP 会话。
- 阶段 8 真实 Renderer 交互仍未人工补跑：目前通过 typecheck、event replay / view model 聚焦测试和代码审查修复验证，未启动 Electron 桌面壳补跑发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume。
- 阶段 9 真实飞书入口仍未人工补跑：当前本机不存在 `~/.rv-insights/feishu.json`，无法补跑飞书发送、完成、权限 pending 和群聊 MCP；未伪造通过。
- 阶段 10 真实最小 Pipeline 未人工补跑：此前未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文；已有 mock RuntimeRunner 聚焦测试覆盖 Claude 节点执行、metadata、结构化输出、delta/message 去重和失败映射。
- Agent Runner v2 尚不具备直接替代旧 Agent 主循环的证据：旧主循环仍承载自动重试、Watchdog、Teams auto-resume、typed error 持久化和现有 UI `sdk_message` 推送。

当前工作树注意事项：
- 可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 等噪音文件。
- 不要把 `.DS_Store`、`improve/` 或无关改动纳入阶段提交。

下一步请执行阶段 12：真实交互补跑与 Runner v2 默认化准备。

阶段 12 目标：
1. 补齐阶段 0 真实 Electron 交互证据，确认默认旧路径仍稳定。
2. 在 feature flag 下对照验证 Agent Runner v2、Pipeline Runner v2、External Channel v2 的真实行为。
3. 找出 `agentRuntimeRunnerV2` 距离默认开启还缺什么，尤其是 UI `sdk_message` 推送、自动重试、Watchdog、Teams auto-resume、typed error 持久化。
4. 不做 UI 改版，不删除旧 Agent 主循环，不默认开启任何 feature flag，除非聚焦测试和真实交互证据都支持。

建议文件范围：
- docs/agent-refactor/baseline-runs/
- docs/agent-refactor/development-checklist.md
- tasks/todo.md
- apps/electron/src/main/lib/agent-orchestrator.ts 及 Runner 相关测试（仅在发现缺口需要修复时）
- apps/electron/src/main/lib/pipeline-node-runner.ts 及测试（仅在真实 Pipeline 补跑发现缺口时）
- apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts / renderer atoms 测试（仅在真实 Renderer 补跑发现缺口时）

必须遵守：
- 开发前先在 tasks/todo.md 写阶段 12 checklist；完成后追加 Review。
- 每阶段只改变一个主边界；阶段 12 以真实交互补跑和证据记录为主，除非发现明确 bug 才做最小修复。
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS / IM-first 模型。
- 不默认 bypass 权限。
- 保留 patch-work 写入防护，不能回退 Git 防护、HEAD/refs/index/config 校验或 human gate 复验。
- 每阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动。
- 若用户纠正了实现方向，立即更新 tasks/lessons.md。

阶段 12 验证至少包括：
- bun run typecheck
- Agent / Runtime / Renderer / Pipeline 相关聚焦测试
- Electron 桌面壳真实交互补跑；无法补跑的场景必须明确记录原因
- git diff --check
```
