# Agent 重构开发进度跟踪清单

本清单是后续迭代开发的主控文档。每个阶段完成前都必须更新本文件，并在对应 PR / commit 中说明完成项、验证结果和回滚点。

## 当前开发状态

更新时间：2026-05-17

当前阶段：阶段 0 冻结基线已完成并提交，下一步进入阶段 1 Shared Event Contract。

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

未开始：

- [ ] 阶段 1 Shared Event Contract 尚未开始。
- [ ] 阶段 2 Event Log 双写尚未开始。
- [ ] 阶段 3 In-process AgentRuntimeRunner 尚未开始。
- [ ] 阶段 4 Runtime Manifest 只读解析尚未开始。
- [ ] 阶段 5 Runtime Materializer for New Sessions 尚未开始。
- [ ] 阶段 6 插件系统原生化尚未开始。
- [ ] 阶段 7 内置 MCP Bridge 尚未开始。
- [ ] 阶段 8 Renderer 切新 Reducer 尚未开始。
- [ ] 阶段 9 External Channel Adapter 尚未开始。
- [ ] 阶段 10 Pipeline 复用 Runner 尚未开始。
- [ ] 阶段 11 清理旧路径尚未开始。

下一步建议：

1. 进入阶段 1 的 Shared Event Contract，继续保持客户端 UI 零可见变化。
2. 阶段 1 开始前复查阶段 0 缺口，涉及权限、AskUser、Plan Mode、MCP、附件、fork/rewind 或飞书时优先补跑对应基线。
3. 每阶段完成并通过验证后立即单独提交。

当前已知缺口：

- 阶段 0 首轮没有实时 Electron 桌面交互证据；并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind 仍需在触碰相关边界前补跑。
- 当前本地配置没有 workspace MCP server，因此 MCP 可见性只记录了预期和缺口。
- 当前本地配置没有飞书配置，因此飞书入口和飞书群聊 MCP 仍需后续在可用环境中补跑。
- 工作树当前只有 `.DS_Store` / `improve/` 噪音文件，不属于 Agent 重构成果，不应纳入阶段提交。

## 全局硬约束

- [ ] 客户端 UI 零可见变化：不改布局、样式、文案、入口、按钮行为、交互路径。
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

- [ ] 在 `packages/shared/src/agent/` 新增 `AgentStreamEnvelope`。
- [ ] 新增 `AgentRuntimeEvent` union。
- [ ] 新增 `AgentRuntimeErrorPayload`。
- [ ] 新增 `AgentEventSource`。
- [ ] 新增事件 schema guard / validator。
- [ ] 新增 SDKMessage fixture。
- [ ] 新增 AgentStreamEnvelope fixture。
- [ ] 新增旧 payload 到新 envelope 的 adapter。
- [ ] 新增 event replay reducer 测试骨架。
- [ ] 引入 `agentRuntimeEventsV2` feature flag，默认 off。

### 验收

- [ ] 类型导出稳定，旧 `AgentEvent` 未删除。
- [ ] 不改变 IPC 主协议默认行为。
- [ ] 不改变 Renderer 可见 UI。
- [ ] 事件 fixture 覆盖 text、tool、permission、AskUser、usage、complete、error。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` 覆盖 shared event fixture。
- [ ] `git diff --check`

### 回滚

- [ ] 关闭 `agentRuntimeEventsV2`。
- [ ] 保留旧 `AgentEvent` 和旧 reducer。

## 阶段 2：Event Log 双写

目标：在旧运行路径旁边写入新事件日志，UI 仍走旧路径。

### 任务

- [ ] 新增 `{session-id}.events.jsonl` 写入路径。
- [ ] 新增 runId 生成策略。
- [ ] 新增 per-run sequence 分配。
- [ ] 实现终态去重。
- [ ] Runtime Service / Orchestrator 写 envelope event log。
- [ ] SDKMessage 继续写原 JSONL。
- [ ] 新旧 reducer shadow compare，只写开发日志。
- [ ] 缺口 sequence 检测和补读策略打桩。

### 验收

- [ ] 发送消息生成完整 event log。
- [ ] 停止消息生成单一 `run_stopped`。
- [ ] 权限 approve / deny 生成 requested / resolved。
- [ ] AskUser 生成 requested / resolved。
- [ ] 重复终态不会写入。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` event log/replay 相关测试。
- [ ] 人工跑阶段 0 的关键基线：发送、停止、权限、AskUser。
- [ ] `git diff --check`

### 回滚

- [ ] 停止写 events JSONL。
- [ ] 旧 SDKMessage JSONL 继续作为唯一数据源。

## 阶段 3：In-process AgentRuntimeRunner

目标：抽出进程内 Runner，但不改客户端 UI 和 workspace 结构。

### 任务

- [ ] 新增 `apps/electron/src/main/lib/agent-runtime-runner.ts`。
- [ ] 新增 `agent-runtime-types.ts`。
- [ ] 新增 `agent-sdk-env.ts`，迁移 SDK env 构建。
- [ ] 新增 `agent-sdk-message-converter.ts`。
- [ ] Runner 支持 `AgentRuntimeRunInput`。
- [ ] Runner 输出 `AsyncIterable<AgentStreamEnvelope>`。
- [ ] Runner 通过 callback 请求权限和 AskUser。
- [ ] Runner 通过 store interface 写 SDKMessage，不直接写 IPC。
- [ ] Orchestrator 通过 `agentRuntimeRunnerV2` 调用 Runner。
- [ ] 保留旧 Orchestrator SDK query 路径。
- [ ] Runner mock SDK stream 单元测试。

### 验收

- [ ] Agent 发送行为不变。
- [ ] 停止行为不变。
- [ ] resume 行为不变。
- [ ] 权限 approve / deny 行为不变。
- [ ] AskUser 行为不变。
- [ ] `agent-orchestrator.ts` SDK stream 遍历逻辑开始瘦身。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` Runner mock stream 测试。
- [ ] 人工跑发送、停止、resume、权限、AskUser。
- [ ] `git diff --check`

### 回滚

- [ ] 关闭 `agentRuntimeRunnerV2`。
- [ ] Orchestrator 回到旧 SDK query 路径。

## 阶段 4：Runtime Manifest 只读解析

目标：新增 Registry/Manifest，只读转换旧 workspace 配置，不改变 cwd。

### 任务

- [ ] 新增 `agent-runtime-registry.ts`。
- [ ] 在 `packages/shared/src/agent/` 新增 runtime manifest 类型。
- [ ] 读取旧 workspace `mcp.json`。
- [ ] 读取旧 workspace `skills/` 与 `skills-inactive/`。
- [ ] 读取旧 plugin manifest。
- [ ] 生成 manifest source hash。
- [ ] 路径安全：resolve + lstat + realpath。
- [ ] 拒绝 symlink traversal fixture。
- [ ] additionalDirectories 只记录引用，不复制。

### 验收

- [ ] 旧 workspace 都能生成 manifest。
- [ ] 旧 session cwd 不移动。
- [ ] 旧 session resume 不变。
- [ ] Manifest 与 [Runtime Manifest](./runtime-manifest.md) 字段一致。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` registry/path safety fixture。
- [ ] 人工打开旧 workspace 和旧 session。
- [ ] `git diff --check`

### 回滚

- [ ] Runner 不读取 manifest。
- [ ] 继续使用旧 `agent-workspace-manager.ts` 配置解析。

## 阶段 5：Runtime Materializer for New Sessions

目标：新 session 使用新 runtime 目录；旧 session 兼容。

### 任务

- [ ] 新增 `agent-runtime-materializer.ts`。
- [ ] 新 session 创建 `sessions/{session-id}/cwd`。
- [ ] 写入 `runtime/.claude/settings.json`。
- [ ] 写入 `runtime/mcp.json`。
- [ ] 写入 `runtime/CLAUDE.md`。
- [ ] 物化 enabled skills。
- [ ] 物化 plugins snapshot 打桩或最小实现。
- [ ] 写入 `runtime-manifest.json`。
- [ ] settings 只覆盖白名单 key。
- [ ] 冲突写 `.rv-insights-conflicts.json` 并阻断 run。
- [ ] materialize 失败发 `runtime_config_invalid`。

### 验收

- [ ] 新 session 目录符合 runtime manifest 文档。
- [ ] 旧 session 仍使用旧 cwd 并可 resume。
- [ ] MCP/Skill 改动后 hash 变化。
- [ ] materialize 失败不进入半配置运行。
- [ ] UI 无可见变化。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` materializer fixture。
- [ ] 人工跑新 session 和旧 session。
- [ ] `git diff --check`

### 回滚

- [ ] 关闭 `agentRuntimeMaterializerV2`。
- [ ] 新 session 回到旧目录策略。

## 阶段 6：插件系统原生化

目标：参考 happyclaw 的 catalog -> enabled refs -> snapshot，但保持本地桌面模型。

### 任务

- [ ] 新增 plugin catalog 类型。
- [ ] 新增 enabled plugin refs 配置。
- [ ] 新增 plugin snapshot materializer。
- [ ] 支持导入本地 Claude Code plugin。
- [ ] 记录 plugin source path、snapshot path、hash。
- [ ] plugin command 索引。
- [ ] DMI slash command 应用层展开。
- [ ] 非 DMI plugin command 交给 SDK。
- [ ] 禁止 snapshot 失败时 fallback 到用户全局 plugin。

### 验收

- [ ] 启用/禁用插件后 Runner `options.plugins` 正确变化。
- [ ] 删除插件只删除 RV snapshot，不删除用户源目录。
- [ ] 插件能力不绕过权限。
- [ ] UI 无可见变化，沿用现有设置入口。

### 验证

- [ ] `bun run typecheck`
- [ ] `bun test` plugin materializer fixture。
- [ ] 人工启用/禁用一个本地 plugin。
- [ ] `git diff --check`

### 回滚

- [ ] Runner 不传 `options.plugins`。
- [ ] 保留旧 Skill / plugin 兼容路径。

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
