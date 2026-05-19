# Agent 重构开发进度跟踪清单

本清单是后续迭代开发的主控文档。每个阶段完成前都必须更新本文件，并在对应 PR / commit 中说明完成项、验证结果和回滚点。

## 当前开发状态

更新时间：2026-05-19

当前阶段：阶段 13 Runner v2 默认化证据补齐进行中；代码侧补强、`sdk_session` 去重修复、Plan Mode 退出证据补强，以及 Watchdog / Teams auto-resume 等价证据补强均已完成并提交/验证；真实 Electron 仍已补到发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind；Pipeline UI 仍未在本机形成 human gate / patch-work / tester 真实证据，不能默认开启 Runner v2。

已完成：

- [x] 已完成 Agent 重构总览文档：[README.md](./README.md)
- [x] 已完成现状与差距分析：[current-state-and-gap.md](./current-state-and-gap.md)
- [x] 已完成目标架构设计：[target-architecture.md](./target-architecture.md)
- [x] 已完成迁移路线：[migration-plan.md](./migration-plan.md)
- [x] 已完成行为基线清单模板：[baseline-checklist.md](./baseline-checklist.md)
- [x] 已完成事件契约设计：[event-contract.md](./event-contract.md)
- [x] 已完成 Runtime Manifest 设计：[runtime-manifest.md](./runtime-manifest.md)
- [x] 已完成第一批实现 PR 拆分：[implementation-prs.md](./implementation-prs.md)
- [x] 已完成本开发进度跟踪清单：[development-checklist.md](./development-checklist.md)
- [x] 已明确客户端 UI 零可见变化约束。
- [x] 已提交方案阶段成果：`158d8a64 docs: 完成 Agent 模式重构方案阶段文档`
- [x] 已完成阶段 0 冻结基线首轮文本证据：[2026-05-17-round-1.md](./baseline-runs/2026-05-17-round-1.md)
- [x] 已提交阶段 0 成果：`47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线`
- [x] 阶段 1 Shared Event Contract 已完成实现与聚焦验证。
- [x] 已提交阶段 1 成果：`d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约`
- [x] 阶段 2 Event Log 双写已完成实现与聚焦验证。
- [x] 已提交阶段 2 成果：`04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写`
- [x] 已提交阶段 3 交接提示词更新：`d7d0ae60 docs(agent): 更新 Agent 重构阶段 3 交接提示`
- [x] 阶段 3 In-process AgentRuntimeRunner 已完成实现与聚焦验证。
- [x] 已提交阶段 3 成果：`ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner`
- [x] 阶段 4 Runtime Manifest 只读解析已完成实现与聚焦验证。
- [x] 已提交阶段 4 成果：`18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析`
- [x] 已提交阶段 5 交接提示词更新：`410d8945 docs(agent): 更新阶段 5 交接提示词`
- [x] 阶段 5 Runtime Materializer for New Sessions 已完成实现与聚焦验证。
- [x] 已提交阶段 5 成果：`10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer`
- [x] 阶段 6 插件系统原生化已完成实现与聚焦验证。
- [x] 已提交阶段 6 成果：`05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化`
- [x] 阶段 7 内置 MCP Bridge 已完成实现与聚焦验证。
- [x] 已提交阶段 7 成果：`eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge`

阶段状态：

- [x] 阶段 8 Renderer 切新 Reducer 已完成实现与聚焦验证。
- [x] 已提交阶段 8 成果：`6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer`
- [x] 阶段 9 External Channel Adapter 已完成实现与验证。
- [x] 已提交阶段 9 成果：`09e558a7 feat(agent): 完成 Agent 重构阶段 9 External Channel Adapter`
- [x] 阶段 10 Pipeline 复用 Runner 已完成实现与聚焦验证。
- [x] 已提交阶段 10 成果：`feat(agent): 完成阶段10 Pipeline 复用 Runner`
- [x] 阶段 11 清理旧路径已完成并提交。
- [x] 阶段 12 真实交互补跑与 Runner v2 默认化准备已完成并提交：`0e37e500 feat(agent): 完成阶段12真实交互补跑与Runner v2 stop加固`
- [~] 阶段 13 Runner v2 默认化证据补齐进行中；代码侧补强已提交：`328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据`；追加修复已提交：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`；Plan Mode 退出证据补强已提交：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`；本轮补上 Watchdog / Teams auto-resume 等价证据并通过聚焦测试。

下一步建议：

1. 下一轮优先补跑能到 human gate / patch-work / tester 的 Pipeline 真实 UI run，复验 Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
2. 在可保持 Electron 进程和 CDP 连接的环境中补 Pipeline 深水位真实 UI 证据；当前本轮 `bunx electron . --remote-debugging-port=9334` 启动后立即退出，只能记录阻塞。
3. 在证据不足前，不默认开启 `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2` 或 `agentRuntimeChannelsV2`。
4. 每阶段完成并通过验证后立即单独提交。

当前已知缺口：

- 阶段 13 已补齐 Runner v2 自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送和重复 `run_started/sdk_session` 去重的代码侧证据。
- 阶段 13 已通过真实 Runner v2 最小发送、stop、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind 复验。
- 阶段 13 已补齐 Watchdog / Teams auto-resume 等价证据：Runner v2 现在会复用 `TeamsCoordinator`，在同一 SDK session 下延迟 result、发出 legacy `waiting_resume` / `resume_start` 回调，并在 worker idle 时退出挂起 query。
- 2026-05-19 权限 deny 补跑通过：sessionId `c31ec718-0d80-465f-bebd-5233e2ca7884`，requestId `b31cdc76-fe22-428a-a11c-32fba08899b4`，目标文件未生成。
- 2026-05-19 权限 approve 补跑发现重复 `sdk_session` 去重仍不完整；已在 event log writer 层按同一 run 的 `sdkSessionId` 去重，并复验证据中 `sdk_session_count=1`。
- 2026-05-19 `sdk_session` writer 层去重修复已提交：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- 2026-05-19 Plan Mode 真实补跑发现 approve 后缺少 `plan_mode_exited` 持久化；已提交 `acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`，只在 `approve_auto` / `approve_edit` 写退出事件，`deny` / `feedback` 保持 plan mode active。
- 2026-05-19 Runner v2 已补上 Watchdog / Teams auto-resume 的等价测试；但仍缺真实 Electron 前端跑到 human gate / patch-work / tester 的 Pipeline 深水位证据。
- 阶段 6 已用聚焦测试覆盖本地 plugin 启用/禁用、snapshot 和 command index；未启动 Electron 桌面壳补跑真实插件启用/禁用交互。
- 当前本地配置没有飞书配置；阶段 9 已用 fixture 覆盖 Feishu channel adapter 降级策略，但飞书入口和飞书群聊 MCP 仍需后续在可用环境中补跑。
- 阶段 13 已启动新 Pipeline 真实 UI run 并可 stop，但 150 秒内停留 `explorer/running`；human gate、patch-work 防护、HEAD/refs/index/config 校验和 tester 证据保守判定仍未通过真实桌面壳复验。
- 阶段 11 已完成 Renderer 旧 reducer fallback / shadow compare 清理；阶段 12 仍未删除 Agent 主循环旧 `adapter.query()`、Pipeline legacy adapter、shared `adaptAgentEventToRuntimeEvent()` 或旧 session transcript 兼容。
- 工作树当前只有 `.DS_Store` / `improve/` 噪音文件，不属于 Agent 重构成果，不应纳入阶段提交。

阶段 13 当前证据文档：[2026-05-18-stage-13.md](./baseline-runs/2026-05-18-stage-13.md)

## 全局硬约束

- [x] 客户端 UI 零可见变化：不改布局、样式、文案、入口、按钮行为、交互路径。
- [ ] 不引入本地数据库，继续使用 JSON / JSONL / 配置文件。
- [ ] 不默认引入 Docker 或 SaaS 多用户模型。
- [ ] 不默认绕过权限；外部渠道默认不使用 `bypassPermissions`。
- [ ] 每阶段只改变一个主边界，避免事件、Runner、Runtime、Renderer、Pipeline 同时大改。
- [ ] 每阶段保留 feature flag 或明确回滚路径。
- [ ] 每阶段都兼容旧 session，不能只验证新 session。
- [ ] 每阶段完成后运行 `git diff --check`。

## 状态标记

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[!]` 阻塞，需要记录原因和决策

## 阶段 13：Runner v2 默认化证据补齐

目标：在不默认开启 feature flag、不删除旧 Agent 主循环、不改 UI 的前提下，补齐 Runner v2 与旧主循环的等价证据，为后续默认化提供可审计依据。

### 任务

- [x] 梳理旧 Agent 主循环仍独有能力：自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、旧 session resume / transcript 兼容。
- [x] 在 Runner v2 补齐 retryable catch error 自动重试、retry 生命周期事件、重试成功清理和重试耗尽持久化。
- [x] 在 Runner v2 补齐 assistant typed error 与 catch error 的 SDKMessage 持久化。
- [x] 在 Runner v2 path 继续向 UI 推送 `sdk_message` payload。
- [x] 在 Orchestrator Runner v2 event log path 过滤重复 `run_started` / `sdk_session`。
- [x] 在 event log writer 层按同一 run 的 `sdkSessionId` 去重，覆盖 SDK `onSessionId` 多次触发。
- [x] 在 ExitPlanMode approve 后持久化 `plan_mode_exited`，并确保 deny / feedback 不误写退出事件。
- [x] 补充 Runner v2 聚焦测试：UI `sdk_message`、catch error 持久化、retry success、typed error 持久化。
- [x] 补跑真实 Electron Runner v2 交互：发送、停止、权限 approve / deny、AskUser、Plan Mode。
- [x] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- [!] 补跑最小 Pipeline 真实 UI run；本轮 `bunx electron . --remote-debugging-port=9334` 启动后立即退出，无法进入 human gate / patch-work / tester，不能标记通过。
- [!] 补跑飞书入口和飞书群聊 MCP；当前本机缺少 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json`。
- [x] 递增 `@rv-insights/electron` patch 版本到 `0.0.93` 并同步 lockfile workspace 版本。
- [x] 提交阶段 13 追加修复：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`。
- [x] 提交阶段 13 Plan Mode 退出证据补强：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`。

### 验收

- [x] 默认行为不变：`agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 继续默认关闭。
- [x] 旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容均保留。
- [x] 代码侧等价证据已覆盖自动重试、typed error 持久化、catch error 持久化、UI `sdk_message` 推送、Watchdog / Teams auto-resume 等价回路。
- [x] 真实 Electron Runner v2 交互已补到发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- [!] 真实 Pipeline UI run 未到 human gate / patch-work / tester；飞书入口仍受配置缺失阻塞。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts packages/shared/src/agent/runtime-events.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [x] `git diff --check`
- [x] Electron 桌面壳真实交互：Runner v2 发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind 已通过。
- [!] 最小 Pipeline 真实 UI run 本轮未能保持 Electron 进程存活，无法进入 human gate / patch-work / tester。

### 回滚

- [x] `agentRuntimeRunnerV2` 默认关闭，旧 Agent 主循环仍为默认路径。
- [x] `agentRuntimePipelineRunnerV2` 默认关闭，Pipeline legacy adapter 仍保留。
- [x] `agentRuntimeChannelsV2` 默认关闭，旧 Feishu bridge 仍保留。
- [x] 本阶段提交：`328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据`
- [x] 本阶段追加提交：`46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据`
- [x] 本阶段 Plan Mode 证据补强提交：`acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据`

### 阶段 13 当前说明

- 证据文档：`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md`
- 当前不能默认开启 Runner v2。缺口集中在 Pipeline UI 深水位真实运行和飞书配置，而不是 typecheck、聚焦单测或 Watchdog / Teams auto-resume 等价实现。
- 2026-05-19 已新增真实权限 approve 证据：sessionId `d2fd3559-3515-40ed-b0dd-304c6c218200`，requestId `f7bf1269-3e92-45b0-b99a-f5f451eefde5`，`sdk_session_count=1`。
- 2026-05-19 已新增真实权限 deny 证据：sessionId `c31ec718-0d80-465f-bebd-5233e2ca7884`，requestId `b31cdc76-fe22-428a-a11c-32fba08899b4`，目标文件未生成。
- 2026-05-19 已新增真实 AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind 证据；Plan Mode 修复只在 `approve_auto` / `approve_edit` 时写 `plan_mode_exited`，`deny` / `feedback` 不写退出事件。

## 阶段 11：清理旧路径

目标：在不改变 Agent / Pipeline / 飞书 / Renderer UI 可见行为的前提下，清理已验证无用的旧路径重复逻辑，保留旧 session、resume / fork / rewind、权限、AskUser、Plan Mode 和必要回滚点。

### 任务

- [x] 复核阶段 0 真实交互缺口，确认不清理尚未人工补跑的关键路径。
- [x] 删除 Renderer 中硬编码 runtime reducer 后不再可达的旧 reducer fallback。
- [x] 删除 Renderer 端 shadow compare 投影和 `console.debug` 差异输出。
- [x] 保留 `payloadToLegacyEvents()` 作为副作用适配层，继续服务文件自动定位、后台任务、权限/AskUser/ExitPlanMode 队列、Plan Mode、提示建议和通知。
- [x] 将 SDK env 测试入口调整为统一 `agent-sdk-env.ts` 门面。
- [x] 复核 shared runtime event adapter，暂不删除公共导出的旧 `AgentEvent` adapter。
- [x] 保留 `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 默认关闭回滚点。
- [x] 递增 `@rv-insights/electron` patch 版本并同步 lockfile。

### 验收

- [x] Renderer view model 仍由 `AgentStreamEnvelope` reducer 驱动。
- [x] 旧 session transcript/debug 兼容路径未删除。
- [x] 权限、AskUser、Plan Mode、MCP、飞书和 Pipeline 默认路径未改变。
- [x] 客户端 UI 零可见变化：不改布局、样式、文案、入口、按钮行为或交互路径。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/renderer/atoms/agent-atoms.test.ts apps/electron/src/main/lib/agent-orchestrator/sdk-environment.test.ts packages/shared/src/agent/runtime-events.test.ts`
- [x] `bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`
- [!] `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts` 组合运行复现既有 Bun/Electron named export 问题；Pipeline Node Runner 与 Runtime Runner 测试先通过，event log 已单独通过。
- [x] `git diff --check`
- [!] 阶段 0 核心真实交互：本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法补跑发送、停止、权限 approve/deny、AskUser、Plan Mode、MCP、飞书和 Pipeline UI。

### 回滚

- [x] `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 仍默认关闭。
- [x] 主进程 event log shadow compare、旧 Agent 主循环、Pipeline legacy adapter、旧 session JSONL 读取均保留。

### 阶段 11 当前说明

- 已删除 Renderer 端不可达旧 reducer fallback 与 shadow compare，不再对每个 stream payload 做 legacy view model 投影。
- 本阶段未删除 Agent 主循环旧 `adapter.query()` 路径，因为它仍承载自动重试、Watchdog、Teams auto-resume、typed error 持久化和现有 UI `sdk_message` 推送。
- 本阶段未删除 shared `adaptAgentEventToRuntimeEvent()`，避免改变公共导出和现有 reducer 对照测试。

## 阶段 0：冻结基线

目标：不改业务逻辑，建立重构前行为证据。

### 任务

- [x] 创建 `docs/agent-refactor/baseline-runs/` 文本证据目录。
- [x] 按 [行为基线清单](./baseline-checklist.md) 跑完首轮人工基线。
- [x] 记录每个基线的 sessionId、workspaceId、权限模式、输入和终态。
- [x] 固化当前 SDKMessage JSONL 样例。
- [x] 固化当前权限 approve / deny 样例。
- [x] 固化当前 AskUser / Plan Mode 样例。
- [x] 固化当前 MCP / Skill 可见性样例。
- [x] 固化当前旧 session resume / fork / rewind 样例。
- [x] 如果触及飞书，固化当前飞书入口和群聊 MCP 样例。

### 验收

- [x] 每个基线都有输入、预期 UI、预期存储、预期终态。
- [x] 基线不要求截图，除非后续要证明 UI 零变化。
- [x] 没有业务代码变更。

### 验证

- [x] `bun run typecheck`
- [x] `git diff --check -- docs/agent-refactor tasks/todo.md`

### 回滚

- [x] 文档阶段，无功能回滚需求。

### 阶段 0 首轮说明

- 证据文件：`docs/agent-refactor/baseline-runs/2026-05-17-round-1.md`
- 已确认本机开发配置目录为 `~/.rv-insights-dev/`，当前有 1 个 DeepSeek Agent 渠道、1 个默认 workspace、4 条 Agent session metadata、3 个 SDKMessage JSONL transcript。
- 已用存量 JSONL 固化首条消息、错误恢复样例、WebSearch tool activity、result 终态和旧 session 多轮 resume 行为。
- 当前环境缺少实时 Electron 桌面交互、workspace MCP server、飞书配置和若干权限/AskUser 样例；这些场景已记录输入、预期 UI、预期存储、预期终态和待补跑状态，后续触碰相关边界前必须补跑。

## 阶段 1：Shared Event Contract

目标：新增统一事件契约，不改变运行行为。

### 任务

- [x] 在 `packages/shared/src/agent/` 新增 `AgentStreamEnvelope`。
- [x] 新增 `AgentRuntimeEvent` union。
- [x] 新增 `AgentRuntimeErrorPayload`。
- [x] 新增 `AgentEventSource`。
- [x] 新增事件 schema guard / validator。
- [x] 新增 SDKMessage fixture。
- [x] 新增 AgentStreamEnvelope fixture。
- [x] 新增旧 payload 到新 envelope 的 adapter。
- [x] 新增 event replay reducer 测试骨架。
- [x] 引入 `agentRuntimeEventsV2` feature flag，默认 off。

### 验收

- [x] 类型导出稳定，旧 `AgentEvent` 未删除。
- [x] 不改变 IPC 主协议默认行为。
- [x] 不改变 Renderer 可见 UI。
- [x] 事件 fixture 覆盖 text、tool、permission、AskUser、usage、complete、error。

### 验证

- [x] `bun run typecheck`
- [x] `bun test packages/shared/src/agent/runtime-events.test.ts`
- [x] `bun test packages/shared/src/agent/runtime-events.test.ts packages/shared/src/utils/pipeline-state.test.ts packages/shared/src/utils/capabilities-diff.test.ts`
- [x] `bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`
- [!] `bun test` 全量在 412 pass 后出现一次 test runner / Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`。单独重跑该失败文件通过，且本阶段只修改 shared contract。
- [x] `git diff --check`

### 回滚

- [x] 关闭 `agentRuntimeEventsV2`。
- [x] 保留旧 `AgentEvent` 和旧 reducer。

### 阶段 1 完成说明

- 提交：`d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约`
- 新增文件：`packages/shared/src/agent/runtime-events.ts`、`packages/shared/src/agent/runtime-events.test.ts`
- 已新增 `AgentStreamEnvelope`、`AgentRuntimeEvent`、`AgentRuntimeErrorPayload`、`AgentEventSource`、默认关闭的 `agentRuntimeEventsV2` feature flag。
- 已新增 envelope 创建、schema guard / validator、终态识别、旧 `AgentEvent` / `AgentStreamPayload` / `SDKMessage` 到 runtime event 的 adapter，以及 event replay reducer 测试骨架。
- 已通过 `packages/shared/src/agent/index.ts` 和 `packages/shared/src/index.ts` 导出新契约；旧 `AgentEvent`、旧 `AgentStreamPayload`、旧 IPC 默认行为和旧 Renderer reducer 均保留。
- `@rv-insights/shared` patch 版本已从 `0.1.33` 提升到 `0.1.34`。
- 本阶段没有修改 `apps/electron` 运行路径、Renderer UI、布局、样式、文案、入口、按钮行为或交互路径。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts`；`bun test packages/shared/src/agent/runtime-events.test.ts packages/shared/src/utils/pipeline-state.test.ts packages/shared/src/utils/capabilities-diff.test.ts`；`bun test apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- 全量 `bun test` 曾在 412 pass 后出现一次 test runner / Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；单独重跑该失败文件通过，本阶段 shared contract 改动未触碰该路径。

## 阶段 2：Event Log 双写

目标：在旧运行路径旁边写入新事件日志，UI 仍走旧路径。

### 任务

- [x] 新增 `{session-id}.events.jsonl` 写入路径。
- [x] 新增 runId 生成策略。
- [x] 新增 per-run sequence 分配。
- [x] 实现终态去重。
- [x] Runtime Service / Orchestrator 写 envelope event log。
- [x] SDKMessage 继续写原 JSONL。
- [x] 新旧 reducer shadow compare，只写开发日志。
- [x] 缺口 sequence 检测和补读策略打桩。

### 验收

- [x] 发送消息生成完整 event log。
- [x] 停止消息生成单一 `run_stopped`。
- [x] 权限 approve / deny 生成 requested / resolved。
- [x] AskUser 生成 requested / resolved。
- [x] 重复终态不会写入。
- [x] UI 无可见变化。

### 验证

- [x] `bun run typecheck`
- [x] `bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`
- [!] 人工跑阶段 0 的关键基线：发送、停止、权限、AskUser。当前本轮未启动 Electron 桌面壳；已用 Orchestrator mock 覆盖发送、停止、终态，event log 单测覆盖权限和 AskUser requested/resolved，真实 UI 交互仍保留为后续补跑缺口。
- [x] `git diff --check`

### 回滚

- [x] 停止写 events JSONL。
- [x] 旧 SDKMessage JSONL 继续作为唯一数据源。

### 阶段 2 完成说明

- 新增文件：`apps/electron/src/main/lib/agent-runtime-event-log.ts`、`apps/electron/src/main/lib/agent-runtime-event-log.test.ts`
- 新增 `{session-id}.events.jsonl` 旁路写入与读取 API；原 `{session-id}.jsonl` SDKMessage transcript 继续保留并作为 Renderer / resume 主数据源。
- 新增 `AgentRuntimeEventLogWriter`，每次 run 生成独立 `runId`，按 run 分配单调 `sequence`，并对 `run_completed` / `run_failed` / `run_stopped` 做终态去重。
- 旧 Orchestrator 路径已双写 `run_started`、`sdk_session`、assistant/tool、`usage_updated`、`run_completed` / `run_failed` / `run_stopped`。
- 权限与 AskUser 生命周期已记录 requested/resolved；resolved 只在 IPC handler 旁路写 events JSONL，原 Renderer `STREAM_EVENT` 行为保持不变。
- shadow compare 仅写主进程开发日志，当前检测 per-run sequence 缺口和内存/落盘 replay 终态差异，不在 UI 展示。
- `@rv-insights/shared` patch 版本从 `0.1.34` 提升到 `0.1.35`；`@rv-insights/electron` patch 版本从 `0.0.78` 提升到 `0.0.79`。
- 本阶段没有修改 Renderer、布局、样式、文案、入口、按钮行为或交互路径；客户端 UI 零可见变化。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts`；`git diff --check`。
- [!] 全量 `bun test` 仍在 412 pass 后复现既有 test runner / Electron named export 问题：`Export named 'BrowserWindow' not found in module .../electron/index.js`；本阶段相关聚焦测试单独运行通过。
- 当前未启动 Electron 桌面壳补跑阶段 0 真实交互基线；发送/停止由 Orchestrator 测试覆盖，权限/AskUser 由 event log 单测覆盖，真实 UI 交互仍记录为后续补跑缺口。

## 阶段 3：In-process AgentRuntimeRunner

目标：抽出进程内 Runner，但不改客户端 UI 和 workspace 结构。

### 任务

- [x] 新增 `apps/electron/src/main/lib/agent-runtime-runner.ts`。
- [x] 新增 `agent-runtime-types.ts`。
- [x] 新增 `agent-sdk-env.ts`，迁移 SDK env 构建。
- [x] 新增 `agent-sdk-message-converter.ts`。
- [x] Runner 支持 `AgentRuntimeRunInput`。
- [x] Runner 输出 `AsyncIterable<AgentStreamEnvelope>`。
- [x] Runner 通过 callback 请求权限和 AskUser。
- [x] Runner 通过 store interface 写 SDKMessage，不直接写 IPC。
- [x] Orchestrator 通过 `agentRuntimeRunnerV2` 调用 Runner。
- [x] 保留旧 Orchestrator SDK query 路径。
- [x] Runner mock SDK stream 单元测试。

### 验收

- [x] Agent 发送行为不变。
- [x] 停止行为不变。
- [x] resume 行为不变。
- [x] 权限 approve / deny 行为不变。
- [x] AskUser 行为不变。
- [x] `agent-orchestrator.ts` SDK stream 遍历逻辑开始瘦身。
- [x] UI 无可见变化。

### 验证

- [x] `bun run typecheck`
- [x] `bun test` Runner mock stream 测试。
- [ ] 人工跑发送、停止、resume、权限、AskUser。
- [x] `git diff --check`

### 回滚

- [x] 关闭 `agentRuntimeRunnerV2`。
- [x] Orchestrator 回到旧 SDK query 路径。

### 阶段 3 启动说明

- 已完成编码，实现进程内 Runner 边界并保留旧 Orchestrator SDK query 路径。
- 目标保持不变：不改 UI，只抽离 SDK query、SDKMessage 转换、权限/AskUser callback 和 SDKMessage 持久化接口。
- 现阶段 `agentRuntimeRunnerV2` 默认关闭，可作为回滚开关。
- Renderer 仍走旧路径，客户端 UI 继续零可见变化。

## 阶段 4：Runtime Manifest 只读解析

目标：新增 Registry/Manifest，只读转换旧 workspace 配置，不改变 cwd。

### 任务

- [x] 新增 `agent-runtime-manifest-registry.ts`。
- [x] 在 `packages/shared/src/agent/` 新增 runtime manifest 类型。
- [x] 读取旧 workspace `mcp.json`。
- [x] 读取旧 workspace `skills/`。
- [x] 读取旧 plugin manifest。
- [x] 生成 manifest source hash 与 runtime hash。
- [x] 路径安全：resolve + lstat + realpath。
- [x] 拒绝 symlink traversal fixture。
- [x] additionalDirectories 只记录引用，不复制。

### 验收

- [x] 旧 workspace 都能生成 manifest。
- [x] 旧 session cwd 不移动。
- [x] 旧 session resume 不变。
- [x] Manifest 与 [Runtime Manifest](./runtime-manifest.md) 字段一致。
- [x] UI 无可见变化。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts`
- [!] 人工打开旧 workspace 和旧 session：本阶段未启动 Electron 桌面壳；只读 manifest registry 未接入 Runner / Orchestrator / Renderer，旧 session cwd 和 resume 路径未改变，真实 UI 交互仍保留为后续补跑缺口。
- [x] `git diff --check`

### 回滚

- [x] Runner 不读取 manifest。
- [x] 继续使用旧 `agent-workspace-manager.ts` 配置解析。

### 阶段 4 完成说明

- 新增文件：`packages/shared/src/agent/runtime-manifest.ts`、`apps/electron/src/main/lib/agent-runtime-manifest-registry.ts`、`apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts`
- 已新增 `AgentRuntimeManifest`、MCP / Skill / Plugin / additional directory manifest 类型，以及默认关闭的 `agentRuntimeManifestV1` feature flag。
- 已新增只读 Workspace Runtime Registry：从旧 workspace 根目录读取 `mcp.json`、`skills/`、`.claude-plugin/plugin.json` 和 `config.json.attachedDirectories`，生成 manifest 字段、source hash、runtime hash 和能力快照。
- 本阶段不创建 `runtime/`、不写 `runtime-manifest.json`、不改变 `agentCwd`、不接入 Runner / Orchestrator / Renderer；旧 session cwd 与 resume 行为保持原路径。
- 路径安全已覆盖：workspace 内路径必须保持在 workspace root 内；已存在路径段用 `lstat` 拒绝 symlink；已存在目标再用 `realpath` 复验；additional directories 只保存引用，不复制也不解析成 runtime 内容。
- 单元测试覆盖旧 MCP、Skill、plugin manifest、attached directories、缺失配置、hash 稳定性、workspace slug traversal、plugin name traversal、入口文件 symlink、nested Skill symlink 和 `skills-inactive` symlink 拒绝。
- `@rv-insights/shared` patch 版本从 `0.1.35` 提升到 `0.1.36`；`@rv-insights/electron` patch 版本从 `0.0.80` 提升到 `0.0.81`。
- 本阶段没有修改 Renderer、UI 样式、文案、入口或交互路径；客户端 UI 零可见变化。
- 代码审查发现并已修复：shared barrel 顶层访问 `process` 的浏览器兼容风险、workspace slug traversal、plugin manifest name 进入 snapshot path 的路径风险，并补充对应回归测试。

## 阶段 5：Runtime Materializer for New Sessions

目标：新 session 使用新 runtime 目录；旧 session 兼容。

### 任务

- [x] 新增 `agent-runtime-materializer.ts`。
- [x] 新 session 创建 `sessions/{session-id}/cwd`。
- [x] 写入 `runtime/.claude/settings.json`。
- [x] 写入 `runtime/mcp.json`。
- [x] 写入 `runtime/CLAUDE.md`。
- [x] 物化 enabled skills。
- [x] 物化 plugins snapshot 打桩或最小实现。
- [x] 写入 `runtime-manifest.json`。
- [x] settings 只覆盖白名单 key。
- [x] 冲突写 `.rv-insights-conflicts.json` 并阻断 run。
- [x] materialize 失败阻断 run，并通过现有 preflight error 通道返回配置错误。

### 验收

- [x] 新 session 目录符合 runtime manifest 文档。
- [~] 旧 session 仍使用旧 cwd 并可 resume：已用路径判定和 legacy cwd fixture 覆盖“不迁移旧 cwd”；本轮未启动 Electron 桌面壳补跑真实 resume。
- [x] MCP/Skill 改动后 hash 变化沿用阶段 4 registry fixture；阶段 5 聚焦验证 materializer 写入 snapshot。
- [x] materialize 失败不进入半配置运行。
- [x] UI 无可见变化。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/main/lib/agent-runtime-materializer.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-session-manager-copy.test.ts`
- [!] 人工跑新 session 和旧 session：本轮未启动 Electron 桌面壳；旧 session cwd / resume 兼容已用路径 fixture 覆盖，新 session materialize 已用文件落盘 fixture 覆盖。
- [x] `git diff --check`

### 回滚

- [x] 删除 session 创建处的 materialize 调用，并让 Orchestrator 不检测 session runtime manifest，即可回到旧目录策略。

### 阶段 5 完成说明

- 新增 `apps/electron/src/main/lib/agent-runtime-materializer.ts` 与聚焦测试，基于阶段 4 manifest 写入 runtime root、session cwd、session `runtime-manifest.json`、settings、MCP、CLAUDE.md、Skill snapshot 和 plugin snapshot。
- 新 session 创建时会先 materialize runtime，再写入 session index；materialize 失败不会留下可见 session metadata。
- Orchestrator 只在检测到 `sessions/{session-id}/runtime-manifest.json` 时切到 `sessions/{session-id}/cwd`，旧 session 没有 manifest 时继续使用旧 `agent-workspaces/{slug}/{sessionId}` cwd 和既有 resume 行为。
- settings 合并只管理白名单字段；若 `plansDirectory` / `skipWebFetchPreflight` 等 RV 管理字段已有冲突值，会写 `runtime/.claude/.rv-insights-conflicts.json` 并阻断 run。
- materialized runtime 判定不只看文件存在，会校验 manifest 普通文件、sessionId、workspaceSlug、sessionCwd 和 manifest path，避免旧 session 被残留文件误切到新 cwd。
- materializer 同时写入 runtime settings 与实际 SDK project settings（`sessions/{session-id}/cwd/.claude/settings.json`），Orchestrator 对 materialized session 跳过旧 settings 写入 block，避免绕过冲突检查。
- 路径安全延续阶段 4 策略：workspace 内已存在路径段拒绝 symlink，写入目标必须保持在 workspace root 内；runtime 写入目标若是 symlink 会被拒绝。
- 代码审查发现并已修复：manifest 存在性误判、session cwd project settings 覆盖风险、fork 源 cwd symlink 递归复制风险，并补充对应回归测试。
- 本阶段未修改 Renderer、UI 样式、文案、入口或交互路径；未默认启用 Runner v2。
- `@rv-insights/shared` patch 版本从 `0.1.36` 提升到 `0.1.37`；`@rv-insights/electron` patch 版本从 `0.0.81` 提升到 `0.0.82`，并同步 `bun.lock`。

## 阶段 6：插件系统原生化

目标：参考 happyclaw 的 catalog -> enabled refs -> snapshot，但保持本地桌面模型。

### 任务

- [x] 新增 plugin catalog 类型。
- [x] 新增 enabled plugin refs 配置。
- [x] 新增 plugin snapshot materializer。
- [x] 支持导入本地 Claude Code plugin。
- [x] 记录 plugin source path、snapshot path、hash。
- [x] plugin command 索引。
- [x] DMI slash command 应用层展开。
- [x] 非 DMI plugin command 交给 SDK。
- [x] 禁止 snapshot 失败时 fallback 到用户全局 plugin。

### 验收

- [x] 启用/禁用插件后 Runner `options.plugins` 正确变化。
- [x] 删除插件只删除 RV snapshot，不删除用户源目录。
- [x] 插件能力不绕过权限。
- [x] UI 无可见变化，沿用现有设置入口。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/main/lib/agent-plugin-catalog.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts`
- [!] 人工启用/禁用一个本地 plugin：本轮未启动 Electron 桌面壳；已用 `config.json` catalog / enabled refs fixture 覆盖本地 plugin 启用与禁用，真实 UI 交互仍作为后续补跑缺口。
- [x] `git diff --check`

### 回滚

- [ ] Runner 不传 `options.plugins`。
- [ ] 保留旧 Skill / plugin 兼容路径。

### 阶段 6 完成说明

- 新增文件：`apps/electron/src/main/lib/agent-plugin-catalog.ts`、`apps/electron/src/main/lib/agent-plugin-catalog.test.ts`
- 已新增 plugin catalog / enabled refs 类型，`config.json.pluginCatalog` 记录可导入本地 plugin，`config.json.enabledPlugins` 控制启用状态；缺省仍兼容旧 `.claude-plugin/plugin.json`。
- 已新增 plugin snapshot materializer：materialized runtime 会复制 plugin source 到 `runtime/.claude/plugins/{pluginId}`，manifest 记录 `sourcePath`、`snapshotPath`、`hash`、`sourceType`、`commands` 和 `enabled`。
- snapshot 前后校验 hash，source 内符号链接会被拒绝；snapshot 失败会阻断 materialize，不会回退到用户全局 plugin 目录。
- 已建立 plugin command index，扫描 plugin `commands/*.md` 与 `.claude/commands/*.md`；frontmatter `dmi: true` / `rv-dmi: true` 的 slash command 由应用层展开，其他 command 保留给 SDK。
- `agent-orchestrator.ts` 在已有 runtime manifest 的 session 下直接复用 materialized runtime；新 session 无 manifest 时先物化，再把 SDK `queryOptions.plugins` 指向 RV snapshot，旧 session 继续使用旧 workspace plugin 路径。
- 代码审查后补强：DMI 展开改为优先读取 snapshot，plugin catalog 导入前对 `config.json` 写目标做 symlink 防护，避免运行期绕过 snapshot 或污染 workspace 配置。
- 本阶段没有修改 Renderer、UI 样式、文案、入口或交互路径；没有默认启用 Runner v2。
- `@rv-insights/shared` patch 版本从 `0.1.37` 提升到 `0.1.38`；`@rv-insights/electron` patch 版本从 `0.0.82` 提升到 `0.0.83`。

## 阶段 7：内置 MCP Bridge

目标：把 RV 宿主能力以 MCP 工具暴露给 Claude Code。

### 任务

- [x] 新增 `agent-host-mcp-server.ts`。
- [x] 实现 `rv_workspace_search`。
- [x] 实现 `rv_list_workspace_files`。
- [x] 实现 `rv_memory_search`。
- [x] 实现 `rv_open_file`。
- [x] 实现 `rv_memory_append`。
- [x] 实现 `rv_send_channel_message`。
- [x] 实现 `rv_schedule_task`。
- [x] 所有工具入参 runtime schema 校验。
- [x] side effect 工具不声明 readOnlyHint，不默认 bypass 权限。
- [x] 工具失败返回结构化错误。
- [x] workspace manifest 支持 `hostBridge.enabled`。

### 验收

- [x] Materialized session 会注入 `rv_host` in-process MCP server，默认暴露只读 `rv_*` 宿主工具；side-effect handlers 已实现但不默认注册。
- [x] 工具调用继续走 SDK MCP/tool 事件路径，不新增 Renderer 可见协议。
- [x] side effect 工具不设置只读注解，保留现有 SDK `canUseTool` 权限路径。
- [x] 工具只能访问 manifest 允许的 workspace/session/additional directory path。
- [x] UI 无可见变化。

### 验证

- [x] `bun run typecheck`
- [x] `bun test apps/electron/src/main/lib/agent-host-mcp-server.test.ts apps/electron/src/main/lib/agent-runtime-manifest-registry.test.ts apps/electron/src/main/lib/agent-runtime-materializer.test.ts`
- [!] 人工调用只读工具和 side effect 工具：本轮未启动 Electron 桌面壳或真实 Claude Code MCP 会话；MCP 可见性与权限 UI 仍记录为后续补跑缺口。
- [x] `git diff --check`

### 回滚

- [x] `hostBridge.enabled = false`。
- [x] Runner 不注册内置 MCP server。

### 阶段 7 完成说明

- 新增 `apps/electron/src/main/lib/agent-host-mcp-server.ts` 与聚焦测试，定义 `rv_host` in-process MCP server 和 7 个 host bridge handler。
- `rv_workspace_search`、`rv_list_workspace_files`、`rv_open_file` 只读取 manifest 允许的 session cwd、workspace-files 和 additional directory；拒绝符号链接逃逸、范围外路径和非文本读取。
- `rv_memory_search`、`rv_memory_append` 复用 MemOS 底层客户端；记忆未启用或缺少 API Key 时返回明确错误，不发起外部请求。`rv_memory_append` 已实现但不在默认 hostBridge 工具清单中注册。
- `rv_send_channel_message`、`rv_schedule_task` 默认返回“未注入 adapter”的保守错误；只有未来 channel adapter / scheduler 显式注入后才会执行 side effect，且不在默认 hostBridge 工具清单中注册。
- Runtime manifest 的 `hostBridge.tools` 现在由只读默认工具列表生成，记录 `version` / `configHash`，并纳入 `sourceConfigHash` / `runtimeHash`；materializer 会写入 `runtime/.claude/rv-host-bridge.json` 作为审计元数据，恢复已物化 session 时会校验该产物未被篡改。
- `agent-orchestrator.ts` 仅在 materialized session manifest 存在且 `hostBridge.enabled` 时注入 `rv_host` MCP server；event log / Runner v2 会记录同一个 manifest `runtimeHash`，并拒绝外部 `customMcpServers` 覆盖内置 `rv_host`。旧 session、Renderer 和默认 Runner v2 开关均未改变。
- 本阶段没有修改 Renderer、UI 样式、文案、入口或交互路径；没有默认启用 Runner v2。
- `@rv-insights/electron` patch 版本从 `0.0.83` 提升到 `0.0.84`；`@rv-insights/shared` patch 版本从 `0.1.38` 提升到 `0.1.39`。

## 阶段 8：Renderer 切新 Reducer

目标：Renderer 主路径消费 `AgentStreamEnvelope`，但视觉完全不变。

### 任务

- [x] `useGlobalAgentListeners` 消费 envelope。
- [x] `agent-atoms.ts` 切到新 reducer。
- [x] `SDKMessageRenderer` 降级为 transcript/debug。
- [ ] 删除 `payloadToLegacyEvents()`。
- [x] 保留短期 shadow compare。
- [x] pending permission 从 event log 恢复。
- [x] pending AskUser 从 event log 恢复。
- [x] plan mode 从 event log 恢复。

### 验收

- [x] 最终 view model 与旧 reducer 一致。
- [x] 客户端 UI diff 为零。
- [x] 刷新/切换页面后 pending 交互不丢。
- [x] 旧 session 可打开。

### 验证

- [x] `bun run typecheck`
- [x] `bun test` event replay/view model 对比测试。
- [ ] 人工跑阶段 0 全部核心基线。
- [x] `git diff --check`

### 回滚

- [x] 重新启用旧 reducer flag。
- [x] 保留 event log 作为排查数据。

### 阶段 8 完成说明

- Renderer 主路径现在优先把 `AgentStreamPayload` 转成 runtime envelope，再通过新 reducer 应用到 `AgentStreamState`；旧 `payloadToLegacyEvents()` 仍保留用于 transcript/debug 兼容与副作用分支。
- `AgentStreamEnvelope` replay state 现在能恢复 `pendingPermissionRequests`、`pendingAskUserRequests`、`pendingExitPlanRequests` 和 `planModeActive`，Renderer 会从 event log/envelope 回填 pending 交互状态。
- 新增 shadow compare helper 与聚焦测试，覆盖 runtime reducer 和旧 reducer 的可见 view model 一致性。
- 本阶段没有改变 UI 布局、样式、文案、入口或按钮行为；`SDKMessageRenderer` 仍保留为 transcript/debug 兼容路径。
- 已升级 `@rv-insights/shared` 到 `0.1.40`、`@rv-insights/electron` 到 `0.0.85`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/renderer/atoms/agent-atoms.test.ts`；`git diff --check`。
- 人工补跑阶段 0 核心基线仍未完成：当前没有启动 Electron 桌面壳做发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume 的真实交互验证，因此这部分仍保留为后续缺口。

## 阶段 9：External Channel Adapter

目标：飞书等外部渠道走 Agent Runtime Service。

### 任务

- [x] 新增 `agent-channel.ts`。
- [x] 新增 Electron channel adapter。
- [x] 新增 Feishu channel adapter。
- [x] 定义 channel session binding 存储。
- [x] 飞书 assistant_delta 节流卡片更新。
- [x] 飞书 run_completed 最终 Markdown 拼接。
- [x] 飞书 permission_requested 默认 `queue_to_desktop`。
- [x] 支持 `interactive_card` 策略打桩。
- [x] channel-scoped MCP overlay 不写 workspace manifest。
- [x] 旧 feishu bridge 通过 feature flag 保留。

### 验收

- [x] Electron 和飞书可驱动同一 runtime session。
- [x] 外部渠道不直接依赖 SDKMessage 内部结构。
- [x] 外部渠道不默认 bypass 权限。
- [x] Electron 客户端 UI diff 为零。

### 验证

- [x] `bun run typecheck`
- [x] `bun test` channel adapter fixture。
- [!] 人工飞书发送、完成、权限 pending：当前本机不存在 `~/.rv-insights/feishu.json`，无法补跑真实飞书入口。
- [x] `git diff --check`

### 回滚

- [x] 关闭 `agentRuntimeChannelsV2`。
- [x] 飞书回到旧 bridge 路径。

### 阶段 9 完成说明

- 新增 `apps/electron/src/main/lib/agent-channel.ts`，定义 `AgentChannel`、`AgentChannelRunContext`、`agentRuntimeChannelsV2` feature flag 和 `ElectronAgentChannel`；Electron adapter 只包装现有 IPC payload 转发，不改变 Renderer 可见行为。
- 新增 `apps/electron/src/main/lib/agent-channel-binding-store.ts`，使用 `agent-channel-bindings.json` 与 `agent-channel-bindings.events.jsonl` 保存 channel session binding 和审计事件，继续保持本地 JSON / JSONL 存储。
- 新增 `apps/electron/src/main/lib/feishu-channel-adapter.ts`，Feishu adapter 只消费 `AgentStreamEnvelope`，不再直接解析 SDKMessage 内部结构；assistant delta 节流输出，run completed 拼接最终 Markdown，permission requested 默认 `queue_to_desktop`。
- `feishu-bridge.ts` 仅在 `RV_AGENT_RUNTIME_CHANNELS_V2=1` 时使用新 Feishu channel adapter；旧 Feishu bridge 和旧 `feishu-bindings-{botId}.json` 持久化继续保留，客户端 UI 零可见变化。
- 飞书群聊 `feishu_chat` MCP 仍通过 `customMcpServers` 作为 run overlay 传给 Agent，不写入 workspace runtime manifest。
- 新增聚焦测试覆盖 channel binding store upsert/remove、Feishu adapter delta/final Markdown/permission queue 策略，并保留 Runner fixture 作为 runtime event contract 回归。
- `@rv-insights/electron` patch 版本从 `0.0.85` 提升到 `0.0.86`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/agent-channel-binding-store.test.ts apps/electron/src/main/lib/feishu-channel-adapter.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 本轮未启动 Electron 桌面壳补跑真实 Agent 发送；当前本机不存在 `~/.rv-insights/feishu.json`，真实飞书入口、飞书群聊 MCP 和权限 pending 仍保留为后续可用环境验证缺口。

## 阶段 10：Pipeline 复用 Runner

目标：Pipeline 节点复用 AgentRuntimeRunner，Pipeline 状态管理保持独立。

### 任务

- [x] 为 Runner 输入增加 pipeline metadata。
- [x] 不修改 `AgentEventSource` 枚举；Pipeline 上下文只放在 Runner input metadata，避免破坏 runtime event contract。
- [x] Pipeline nodeId 写入 Runner input metadata。
- [x] 保留 Pipeline LangGraph checkpoint。
- [x] 保留 Pipeline human gate。
- [x] 迁移 `pipeline-node-runner.ts` 的 SDK env / SDK CLI 解析逻辑到共享 `agent-sdk-env`。
- [x] 保留 Pipeline 节点权限策略，v2 explorer / planner 继续强制 read-only。
- [x] 保留 patch-work 写入防护。
- [x] 结构化输出 schema 不进入通用 Agent UI。

### 验收

- [x] Agent 与 Pipeline Claude 执行入口可通过 `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` 统一到 AgentRuntimeRunner。
- [x] Pipeline UI 无变化。
- [x] Pipeline checkpoint / gate 行为不变。
- [x] Patch-work 防护不回退。

### 验证

- [x] `bun run typecheck`
- [x] Pipeline / Runner 聚焦测试。
- [!] 人工跑一个最小 Pipeline：本轮未启动 Electron 桌面壳，缺少真实渠道/API 交互上下文，无法证明真实最小 Pipeline；已用 mock RuntimeRunner 覆盖 Claude 节点执行、metadata、结构化输出和失败映射。
- [x] `git diff --check`

### 回滚

- [x] 关闭 `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2`。
- [x] Pipeline 回到旧 `pipeline-node-runner.ts` adapter query 路径。

### 阶段 10 完成说明

- `AgentRuntimeRunInput` 新增可选判别联合 `metadata`，Pipeline run 传入 `origin: "pipeline"`、`pipelineSessionId`、`nodeId`、`nodeRunId`、`version` 和 `reviewIteration`；Agent 路径不传 metadata，事件 envelope schema 未改变。
- `ClaudePipelineNodeRunner` 新增 `agentRuntimePipelineRunnerV2` feature flag，默认关闭；关闭时继续使用旧 `ClaudeAgentAdapter.query()` 路径，开启时通过 `InProcessAgentRuntimeRunner` 执行 SDK query。
- `pipeline-node-runner.ts` 移除了本地重复的 SDK env / CLI path 构建，复用 `agent-sdk-env` 中的 `buildSdkEnv()` 和 `resolveSDKCliPath()`。
- Pipeline 的 LangGraph checkpoint、human gate、PipelineStreamEvent、结构化 JSON schema、patch-work 文档写入、tester 证据保守判定、read-only 工具防护和现有 UI 行为均保持在 Pipeline 边界内。
- Runtime event 到 Pipeline 输出的合并按 messageId 处理，避免 `assistant_delta` 与完整 `assistant_message` 重复追加导致结构化 JSON 污染。
- 默认 RuntimeRunner 采用延迟动态加载，只在 `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2=1` 路径需要时创建。
- `@rv-insights/electron` patch 版本从 `0.0.86` 提升到 `0.0.87`，并同步 `bun.lock`。
- 验证通过：`bun run typecheck`；`bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`git diff --check`。
- 代码审查发现的 delta / complete 重复合并、metadata 判别约束和默认 Runner 懒加载问题已修复，并补充回归测试。
- 本轮未启动 Electron 桌面壳补跑真实最小 Pipeline；真实 Pipeline / 渠道交互仍记录为后续可用环境验证缺口。

## 阶段 12：真实交互补跑与 Runner v2 默认化准备

目标：补齐阶段 0 真实 Electron 交互证据，确认 Runner / Channel / Pipeline v2 feature flag 能覆盖默认路径关键行为，再决定是否进入默认开启或继续补齐能力。

### 前置条件

- [x] 阶段 1-11 均已完成并保留回滚点。
- [x] 客户端 UI 零可见变化约束仍有效。
- [x] 可启动 Electron 桌面壳，并有可用 Agent 兼容渠道/API Key。
- [!] 如要验证飞书入口，需要本机存在有效 `~/.rv-insights/feishu.json` 或明确记录缺失原因；本机正式和 dev 配置目录均缺少飞书配置。

### 任务

- [~] 补跑 Agent 发送、停止、同会话并发、旧 session resume；已补跑发送和 pending-stop，旧 session resume 仍依赖存量 JSONL，未重新发送。
- [x] 补跑权限 approve / deny、AskUser、Plan Mode 进入与退出。
- [!] 补跑附件、additional directory、fork、rewind；本轮未完整跑模型闭环，继续保留为后续缺口。
- [x] 补跑 materialized runtime 下 `rv_host` 只读 MCP 工具真实可见性。
- [!] 补跑 Skill / Plugin snapshot 在真实 Agent 对话中的可见性；本轮仅通过 materialized runtime 日志确认 host bridge 和 runtime cwd，未单独证明 Skill / Plugin snapshot 被模型使用。
- [!] 补跑飞书入口和飞书群聊 MCP；本机缺少飞书配置，明确阻塞，不伪造通过。
- [!] 补跑最小 Pipeline 真实运行，确认 Pipeline UI、human gate、patch-work 防护仍正常；本轮未启动新 Pipeline 真实任务，继续依赖聚焦测试。
- [~] 评估 `agentRuntimeRunnerV2` 开启后的缺口：真实最小发送通过，但自动重试、Watchdog、Teams auto-resume、typed error 持久化仍未证明等价。
- [~] 评估 `agentRuntimePipelineRunnerV2` 与 `agentRuntimeChannelsV2` 是否具备默认开启条件；两者均暂不具备默认开启条件。
- [x] 更新 `docs/agent-refactor/baseline-runs/` 新一轮真实交互证据、`development-checklist.md` 和 `tasks/todo.md`。

### 验收

- [~] 每个补跑场景都有 sessionId/workspaceId/channelId、输入、终态、存储证据和 UI 行为记录；已补跑场景见 `baseline-runs/2026-05-18-stage-12.md`。
- [x] 未补跑场景必须有具体阻塞原因。
- [x] 不默认 bypass 权限，不降低 patch-work Git 写入防护。
- [x] 若准备默认开启任一 feature flag，必须有聚焦测试和真实交互证据同时支持；本阶段不默认开启任何 feature flag。

### 验证

- [x] `bun run typecheck`
- [x] Agent / Runtime / Event Log / Renderer atoms 聚焦测试。
- [x] Pipeline node runner 聚焦测试。
- [x] Electron 桌面壳真实交互补跑。
- [x] `git diff --check`

### 回滚

- [x] `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 保持可关闭。
- [x] 旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 读取继续作为回滚路径，直到真实交互证据证明可以删除。

### 阶段 12 完成说明

- 完成提交：`0e37e500 feat(agent): 完成阶段12真实交互补跑与Runner v2 stop加固`。
- 新增真实交互证据：`baseline-runs/2026-05-18-stage-12.md`。
- 真实 Electron Agent 已补跑默认发送、pending-stop、权限 approve/deny、AskUser、Plan Mode 和 materialized runtime 下 `rv_host` 只读 MCP 可见性。
- 发现并修复 stop 正常结束终态缺口：旧主循环和 Runner v2 在用户 stop 后如果 iterator / runner 正常结束，都会补写 `run_stopped` 并发送 `stoppedByUser` completion。
- 本阶段不默认开启任何 feature flag，不删除旧 Agent 主循环，不做 UI 改版。
- `@rv-insights/electron` patch 版本从 `0.0.88` 提升到 `0.0.89`；本阶段 `bun.lock` 无 diff。
- 验证通过：`bun run typecheck`；Agent / Runtime / Renderer 聚焦测试 37 pass；Pipeline / human gate / patch-work / Codex runner 聚焦测试 81 pass；`git diff --check`。

## 阶段 13：Runner v2 默认化证据补齐

目标：在不改变默认可见行为、不删除旧主循环的前提下，补齐 `agentRuntimeRunnerV2` 与旧 Orchestrator 主循环的等价证据，判断是否具备默认开启条件。

### 前置条件

- [x] 阶段 12 已完成并提交。
- [x] `agentRuntimeRunnerV2` 默认关闭，旧 Agent 主循环仍是默认路径。
- [x] 客户端 UI 零可见变化约束仍有效。
- [!] 飞书真实入口仍依赖本机有效飞书配置；缺配置时继续记录阻塞。

### 任务

- [ ] 梳理旧主循环仍独有能力：自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、旧 session resume / transcript 兼容。
- [ ] 为 Runner v2 补齐自动重试等价测试，或明确记录不等价原因。
- [ ] 为 Runner v2 补齐 typed error 持久化和 completion signal 行为测试。
- [ ] 补跑 Runner v2 真实 Electron 交互：发送、停止、权限 approve / deny、AskUser、Plan Mode。
- [ ] 补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- [ ] 补跑最小 Pipeline 真实 UI run，复验 human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
- [ ] 在有飞书配置时补跑 `agentRuntimeChannelsV2` 飞书入口和群聊 MCP；无配置时明确阻塞，不伪造通过。
- [ ] 判断是否具备默认开启 `agentRuntimeRunnerV2` 条件；证据不足时继续保持默认关闭。

### 验证

- [ ] `bun run typecheck`
- [ ] Agent / Runtime / Event Log / Renderer atoms 聚焦测试。
- [ ] Pipeline node runner / human gate / patch-work 防护聚焦测试。
- [ ] Electron 桌面壳真实交互补跑。
- [ ] `git diff --check`

## 每阶段完成模板

完成任一阶段后，在本文件对应阶段下补充：

```text
完成日期：
完成 PR/commit：
实际改动文件：
验证命令：
人工基线结果：
UI 零变化确认：
残余风险：
回滚方式：
```
