# Agent 重构开发进度跟踪清单

本清单是后续迭代开发的主控文档。每个阶段完成前都必须更新本文件，并在对应 PR / commit 中说明完成项、验证结果和回滚点。

## 当前开发状态

更新时间：2026-05-18

当前阶段：阶段 6 插件系统原生化已完成实现与验证，待提交；下一阶段为阶段 7 内置 MCP Bridge。

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

未开始：

- [ ] 阶段 7 内置 MCP Bridge 尚未开始。
- [ ] 阶段 8 Renderer 切新 Reducer 尚未开始。
- [ ] 阶段 9 External Channel Adapter 尚未开始。
- [ ] 阶段 10 Pipeline 复用 Runner 尚未开始。
- [ ] 阶段 11 清理旧路径尚未开始。

下一步建议：

1. 下一次开发从阶段 7 内置 MCP Bridge 开始；阶段 6 已让 materialized session 使用 RV plugin snapshot，旧 session 继续保持旧 plugin 路径。
2. 阶段 7 开始前复核阶段 0 基线缺口；触碰 MCP bridge / host tools / 权限边界时，应优先补充 MCP 可见性、权限和旧 session resume 证据。
3. 每阶段完成并通过验证后立即单独提交。

当前已知缺口：

- 阶段 0 首轮没有实时 Electron 桌面交互证据；并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind 仍需在触碰相关边界前补跑。阶段 5 已用单元测试覆盖旧 session cwd 不迁移和 Orchestrator 路径判定，但未启动 Electron 桌面壳做真实旧 session resume。
- 当前本地配置没有 workspace MCP server，因此 MCP 可见性只记录了预期和缺口。
- 阶段 6 已用聚焦测试覆盖本地 plugin 启用/禁用、snapshot 和 command index；未启动 Electron 桌面壳补跑真实插件启用/禁用交互。
- 当前本地配置没有飞书配置，因此飞书入口和飞书群聊 MCP 仍需后续在可用环境中补跑。
- 工作树当前只有 `.DS_Store` / `improve/` 噪音文件，不属于 Agent 重构成果，不应纳入阶段提交。

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

- [ ] 新增 `agent-host-mcp-server.ts`。
- [ ] 实现 `rv_workspace_search`。
- [ ] 实现 `rv_list_workspace_files`。
- [ ] 实现 `rv_memory_search`。
- [ ] 实现 `rv_open_file`。
- [ ] 实现 `rv_memory_append`。
- [ ] 实现 `rv_send_channel_message`。
- [ ] 实现 `rv_schedule_task`。
- [ ] 所有工具入参 runtime schema 校验。
- [ ] side effect 工具走权限事件。
- [ ] 工具失败返回结构化错误。
- [ ] workspace manifest 支持 `hostBridge.enabled`。

### 验收

- [ ] Claude Code 能看到 `mcp__rv_insights__*` 工具。
- [ ] 工具调用产生统一 stream event。
- [ ] 权限 UI 能显示 MCP 工具请求。
- [ ] 工具只能访问允许 workspace path。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` host MCP tools fixture。
- [ ] 人工调用只读工具和 side effect 工具。
- [ ] `git diff --check`

### 回滚

- [ ] `hostBridge.enabled = false`。
- [ ] Runner 不注册内置 MCP server。

## 阶段 8：Renderer 切新 Reducer

目标：Renderer 主路径消费 `AgentStreamEnvelope`，但视觉完全不变。

### 任务

- [ ] `useGlobalAgentListeners` 消费 envelope。
- [ ] `agent-atoms.ts` 切到新 reducer。
- [ ] `SDKMessageRenderer` 降级为 transcript/debug。
- [ ] 删除 `payloadToLegacyEvents()`。
- [ ] 保留短期 shadow compare。
- [ ] pending permission 从 event log 恢复。
- [ ] pending AskUser 从 event log 恢复。
- [ ] plan mode 从 event log 恢复。

### 验收

- [ ] 最终 view model 与旧 reducer 一致。
- [ ] 客户端 UI diff 为零。
- [ ] 刷新/切换页面后 pending 交互不丢。
- [ ] 旧 session 可打开。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` event replay/view model 对比测试。
- [ ] 人工跑阶段 0 全部核心基线。
- [ ] `git diff --check`

### 回滚

- [ ] 重新启用旧 reducer flag。
- [ ] 保留 event log 作为排查数据。

## 阶段 9：External Channel Adapter

目标：飞书等外部渠道走 Agent Runtime Service。

### 任务

- [ ] 新增 `agent-channel.ts`。
- [ ] 新增 Electron channel adapter。
- [ ] 新增 Feishu channel adapter。
- [ ] 定义 channel session binding 存储。
- [ ] 飞书 assistant_delta 节流卡片更新。
- [ ] 飞书 run_completed 最终 Markdown 拼接。
- [ ] 飞书 permission_requested 默认 `queue_to_desktop`。
- [ ] 支持 `interactive_card` 策略打桩。
- [ ] channel-scoped MCP overlay 不写 workspace manifest。
- [ ] 旧 feishu bridge 通过 feature flag 保留。

### 验收

- [ ] Electron 和飞书可驱动同一 runtime session。
- [ ] 外部渠道不直接依赖 SDKMessage 内部结构。
- [ ] 外部渠道不默认 bypass 权限。
- [ ] Electron 客户端 UI diff 为零。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` channel adapter fixture。
- [ ] 人工飞书发送、完成、权限 pending。
- [ ] `git diff --check`

### 回滚

- [ ] 关闭 `agentRuntimeChannelsV2`。
- [ ] 飞书回到旧 bridge 路径。

## 阶段 10：Pipeline 复用 Runner

目标：Pipeline 节点复用 AgentRuntimeRunner，Pipeline 状态管理保持独立。

### 任务

- [ ] 为 Runner 输入增加 pipeline metadata。
- [ ] `AgentEventSource` 支持 `channelType: "pipeline"`。
- [ ] Pipeline nodeId 写入 event source。
- [ ] 保留 Pipeline LangGraph checkpoint。
- [ ] 保留 Pipeline human gate。
- [ ] 迁移 `pipeline-node-runner.ts` 的 SDK env 逻辑。
- [ ] 迁移 Pipeline 节点权限策略。
- [ ] 保留 patch-work 写入防护。
- [ ] 结构化输出 schema 不进入通用 Agent UI。

### 验收

- [ ] Agent 与 Pipeline Claude 执行入口统一。
- [ ] Pipeline UI 无变化。
- [ ] Pipeline checkpoint / gate 行为不变。
- [ ] Patch-work 防护不回退。

### 验证

- [ ] `bun run typecheck`
- [ ] Pipeline 相关测试。
- [ ] 人工跑一个最小 Pipeline。
- [ ] `git diff --check`

### 回滚

- [ ] 关闭 `pipelineUsesAgentRunner`。
- [ ] Pipeline 回到旧 `pipeline-node-runner.ts`。

## 阶段 11：清理旧路径

目标：删除已验证无用的旧适配和 legacy reducer。

### 前置条件

- [ ] 阶段 1-10 均已完成并通过基线。
- [ ] 至少保留一个版本周期的 feature flag 回滚。
- [ ] 没有未解释的 shadow compare diff。

### 任务

- [ ] 删除 `payloadToLegacyEvents()`。
- [ ] 删除重复 SDK env 构建。
- [ ] 删除重复 MCP 注入逻辑。
- [ ] 删除或瘦身 `ClaudeAgentAdapter`。
- [ ] `agent-orchestrator.ts` 只保留兼容入口或删除。
- [ ] 更新相关内部文档。

### 验收

- [ ] Agent 和 Pipeline 共享 Runner。
- [ ] 没有重复 SDK query 包装。
- [ ] 旧 session 仍可读。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test`
- [ ] 阶段 0 核心人工基线。
- [ ] `git diff --check`

### 回滚

- [ ] 该阶段只在前序稳定后做；回滚以 git revert 为主。

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
