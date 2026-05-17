# 迁移路线

## 迁移策略总则

- 每阶段只改变一个主边界：事件、Runner、Runtime、Plugin、MCP、Channel、Renderer、Pipeline 复用不要混在同一个 PR。
- 每阶段保留回滚路径：新能力先双写、双读或 feature flag，确认后再删除旧路径。
- 所有阶段继续遵守本地文件优先：不引入本地数据库，不默认 Docker，不要求 SaaS 账户。
- 任何触及运行逻辑的阶段都要保留旧 session 兼容，不能只验证新 session。
- 文档、类型、fixture、实现按同一阶段提交，避免架构文档与代码漂移。
- 新旧 reducer 的对比目标是最终 view model，而不是事件条数。
- 终态信号只允许一个来源，双写期间避免重复 complete、重复 tool result 和重复 final message。
- 默认不允许任何客户端 UI 可见变化；只允许运行时、数据契约和后台边界变化。

建议 feature flag：

| Flag | 默认值 | 用途 |
| --- | --- | --- |
| `agentRuntimeEventsV2` | off | 新旧事件双写和 Renderer 双 reducer |
| `agentRuntimeRunnerV2` | off | Orchestrator 调用新 Runner |
| `agentRuntimeMaterializerV2` | off | 新 workspace runtime 目录 |
| `agentRuntimeChannelsV2` | off | 外部渠道走 AgentChannel |
| `pipelineUsesAgentRunner` | off | Pipeline 节点复用 Agent Runner |

验证 fixture 类型：

- `SDKMessage` fixture
- `AgentStreamEnvelope` fixture
- `permission` fixture
- `runtime manifest` fixture
- `legacy JSONL` fixture
- `external channel` fixture
- `pipeline runner` fixture

## 阶段 0：冻结目标与建立验证基线

目标：只补文档、测试和观测点，不改运行逻辑。
UI 约束：不改任何 Electron 客户端布局、视觉、文案、入口和交互。

任务：

- 固化当前 Agent 主链路的 smoke tests。
- 记录当前 session 创建、发送、停止、权限请求、AskUser、文件上传、MCP、Skill 的行为。
- 增加 shared event fixture，用于后续验证 Renderer 事件兼容。
- 明确当前 `agent-orchestrator.ts` 中哪些逻辑需要保留、下沉、删除。
- 详细基线见 [行为基线清单](./baseline-checklist.md)。

建议新增文件：

- `docs/agent-refactor/baseline-checklist.md`
- `packages/shared/src/agent/__fixtures__/legacy-agent-events.ts`
- `apps/electron/src/renderer/atoms/__tests__/agent-event-replay.test.ts`

人工基线脚本：

1. 新建 Agent session，发送“列出当前工作区文件”。
2. 触发一个需要权限的写入或 shell 操作，分别 approve / deny。
3. 切到设置页等待流式输出，再切回 Agent，确认输出未丢。
4. 停止一次长任务，确认 UI 和后台状态都结束。
5. 打开旧 session，执行 resume、fork、rewind。

基线判定：

- 停止：loading 清理，终态为 `run_stopped`，event log 不再追加 assistant/tool 事件。
- 权限 approve/deny：pending queue 消失，event log 记录 resolved。
- AskUser：切换页面后仍能响应，恢复后请求还在。
- MCP：启用/禁用后下次 run 生效，manifest hash 变化。
- Skill mention：物化路径可见，tool 调用能发现技能能力。
- 文件上传：附件引用和 UI 可见性一致。
- fork/rewind：旧 session 能进入新的 `runId`，或明确回退旧语义。
- 飞书群聊 MCP：如果存在，则必须记录 channel target 和 workspace overlay。

完成定义：

- `bun run typecheck` 通过。
- 当前 Agent UI 发送一次消息、停止一次消息、权限请求一次消息可人工验证。
- 文档列出所有待迁移模块和风险。
- 基线记录包括输入、预期 UI、预期 event log、预期终态。

回滚点：

- 本阶段不改业务逻辑，不需要功能回滚。

## 阶段 1：定义统一 Agent StreamEvent

目标：先收敛事件契约，不触碰 SDK 执行方式。
UI 约束：Renderer 只允许换内部 reducer，不允许新增/删除/改动任何可见控件。

任务：

- 在 `@rv-insights/shared` 新增 `AgentStreamEnvelope` / `AgentRuntimeEvent`。
- 保留现有 `AgentStreamPayload`，增加适配器从旧事件生成新事件。
- Renderer 新增基于新事件的 reducer，但暂不删除旧 `applyAgentEvent`。
- 增加事件重放测试：给定事件序列，能恢复 ToolActivity、usage、completion 状态。
- 事件字段、持久化和 SDKMessage 映射见 [事件契约](./event-contract.md)。

文件范围：

- `packages/shared/src/agent/`：新增 runtime event 类型、schema guard、fixture。
- `apps/electron/src/main/lib/agent-event-adapter.ts`：旧 payload 到新 envelope 的适配。
- `apps/electron/src/renderer/atoms/agent-runtime-reducer.ts`：新 reducer。
- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts`：双写到旧状态和新状态。

测试重点：

- 文本 delta 合并成 assistant message。
- tool start/result 能形成稳定 timeline。
- permission requested/resolved 能恢复 pending queue。
- ask-user requested/resolved 能恢复 pending queue。
- run_failed / run_stopped 只产生一个终态。
- sequence 重复、乱序、缺口的处理可预测。

完成定义：

- 新旧事件双写。
- UI 行为不变。
- 测试覆盖 text、tool、permission、ask-user、usage、complete、error。
- 新旧 reducer 对比最终 view model，覆盖文本、工具活动、usage、pending permission、AskUser、plan mode、retry、compact、completion、error。

回滚点：

- 关闭 `agentRuntimeEventsV2`，Renderer 继续只走旧事件。
- 旧 `AgentEvent` 仍可作为 shadow compare 输入，但不作为新主协议。

## 阶段 2：抽出 Agent Runtime Runner 进程内实现

目标：把 SDK `query()` 细节从 `AgentOrchestrator` 拆到 Runner，但仍在 Electron 主进程内运行。
UI 约束：不修改任何 Agent 页面的组件树、样式、文案或交互路径。

任务：

- 新建 `agent-runtime-runner.ts`。
- Runner 接收 `AgentRuntimeRunInput`：
  - `sessionId`
  - `runId`
  - `prompt`
  - `startedAt`
  - `cwd`
  - `env`
  - `sdkCliPath`
  - `model`
  - `provider`
  - `permissionMode`
  - `mcpServers`
  - `plugins`
  - `resume`
  - `resumeSessionAt`
  - `attachments`
  - `additionalDirectories`
  - `mentionedSkills`
  - `mentionedMcpServers`
  - `systemPromptAppend`
  - `thinking/maxTurns/maxBudgetUsd/betas`
  - `enableFileCheckpointing`
- Runner 输出 `AsyncIterable<AgentStreamEnvelope>`。
- `AgentOrchestrator` 改为调度 runner，不直接遍历 SDK query。
- `ClaudeAgentAdapter` 可临时保留，但目标是变薄。

完成定义：

- 主功能行为不变。
- `agent-orchestrator.ts` 代码量明显下降。
- 发送、停止、resume、权限请求仍可用。
- Runner 单元测试可 mock SDK message 流。

文件范围：

- `apps/electron/src/main/lib/agent-runtime-runner.ts`
- `apps/electron/src/main/lib/agent-runtime-types.ts`
- `apps/electron/src/main/lib/agent-sdk-env.ts`
- `apps/electron/src/main/lib/agent-sdk-message-converter.ts`
- `apps/electron/src/main/lib/agent-orchestrator.ts`

迁移步骤：

1. 先复制 SDK query 相关逻辑到 Runner，不改变 Orchestrator 外部接口。
2. Orchestrator 仍负责 channel/workspace/session 解析，只把最终 `AgentRuntimeRunInput` 交给 Runner。
3. Runner 产出新 envelope，同时 Orchestrator 继续产出旧 payload。
4. 验证后删除 Orchestrator 中直接遍历 SDK stream 的代码。

不要在本阶段做：

- 不改 workspace 目录结构。
- 不迁移插件系统。
- 不改 Renderer 主协议。
- 不让 Pipeline 复用 Runner。
- 不在本阶段引入新 runtime manifest。

回滚点：

- 关闭 `agentRuntimeRunnerV2`，Orchestrator 回到旧 SDK query 路径。
- `runId` 与 `sdkSessionId` 仍按旧逻辑持久化，避免 resume 断裂。

## 阶段 3：Workspace Runtime Registry 与 Materializer

目标：把 workspace 配置与 Claude runtime 对齐。
UI 约束：配置入口和展示不变，最多在后台更新数据，不向界面暴露新控件。

任务：

- 定义 workspace runtime manifest。
- 新增 Runtime Registry：
  - resolve workspace root
  - resolve session cwd
  - resolve Claude config dir
  - resolve MCP config
  - resolve Skill path
  - resolve Plugin runtime path
- 新增 Materializer：
  - 写 `.claude/settings.json`
  - 物化 `.claude/skills`
  - 物化 plugins runtime snapshot
  - 合并 MCP servers
  - 写 CLAUDE.md / runtime notes
- 迁移现有 `agent-workspace-manager.ts` 的 MCP/Skill 逻辑到新边界。
- manifest 示例和目录模型见 [Runtime Manifest](./runtime-manifest.md)。

完成定义：

- 新工作区按新结构创建。
- 旧工作区可兼容读取。
- Claude SDK 能从新 runtime 读取 MCP/Skill/Plugin。
- 不破坏本地文件可读性。

文件范围：

- `apps/electron/src/main/lib/agent-runtime-registry.ts`
- `apps/electron/src/main/lib/agent-runtime-materializer.ts`
- `apps/electron/src/main/lib/agent-workspace-manager.ts`
- `packages/shared/src/agent/runtime-manifest.ts`

兼容策略：

- 旧工作区存在 `mcp.json` / `skills/` 时，Registry 读取并转换为 manifest source。
- 新工作区写入 `workspace.json` 和 `runtime/`。
- 旧 session cwd 不移动；新 session 使用 `sessions/{session-id}/cwd`。
- 如果 materialize 失败，本次 run 阻断并给出 `runtime_config_invalid`，不要 fallback 到半配置运行。
- 旧目录兼容规则：
  - 旧 session cwd 继续保留原路径，直到该 session 结束。
  - 旧 workspace 的 `skills/`、`mcp.json`、plugin manifest 可被读取并转换。
  - `resume` 旧 session 时优先使用原 cwd 和原 manifest source hash，只有新 session 才迁移到 `runtime/` 新结构。

验证重点：

- 新建工作区后目录结构符合 manifest。
- 旧工作区能继续发送消息。
- MCP server 列表与 UI 设置一致。
- Skill 启用/禁用后下一次 run 生效。
- symlink / 路径穿越 fixture 被拒绝。
- settings 合并时只覆盖白名单 key，冲突写入 `.rv-insights-conflicts.json` 并阻断，而不是静默覆盖用户配置。
- Skill 物化优先 symlink，失败回退复制，manifest 必须记录实际 materializeMode。

回滚点：

- 关闭 `agentRuntimeMaterializerV2`，继续读取旧 workspace 配置。

## 阶段 4：插件系统原生化

目标：参考 happyclaw 的 plugin 三段式，但适配本地桌面。
UI 约束：插件启用状态可继续沿用现有设置页表现，不新增任何新的操作入口。

任务：

- 增加 workspace plugin catalog。
- 增加 enabled plugin refs 配置。
- 增加 runtime snapshot materialization。
- 支持导入本地 Claude Code plugin。
- 支持 plugin commands 索引。
- 对 DMI slash command 做应用层展开，非 DMI 交给 SDK。

完成定义：

- 启用/禁用插件后，SDK `options.plugins` 正确变化。
- plugin runtime 路径不直接依赖用户全局目录。
- 插件目录可审计、可删除、可随 workspace 移动。

文件范围：

- `apps/electron/src/main/lib/agent-plugin-catalog.ts`
- `apps/electron/src/main/lib/agent-plugin-materializer.ts`
- `apps/electron/src/main/lib/agent-runtime-materializer.ts`
- `apps/electron/src/renderer/components/settings/AgentSettings.tsx`

配置模型：

```json
{
  "plugins": {
    "enabled": [
      {
        "id": "local-plugin-id",
        "source": "local",
        "version": "snapshot",
        "enabledCommands": ["*"]
      }
    ]
  }
}
```

安全要求：

- plugin snapshot 必须记录 source path 和 hash。
- 禁止运行 manifest 外的 plugin path。
- 删除插件只删除 RV 管理的 snapshot，不删除用户原始目录。
- plugin command 展示为能力，不直接绕过权限。
- plugin snapshot 失败时不得悄悄降级为用户全局目录。

回滚点：

- 禁用 plugin materialization，Runner 不传 `options.plugins`。

## 阶段 5：内置 MCP Bridge

目标：将 RV-Insights 宿主能力以 MCP 工具暴露给 Claude Code。
UI 约束：只改变后台能力暴露，不新增或重排客户端面板。

优先工具：

- `rv_send_message`
- `rv_memory_search`
- `rv_memory_append`
- `rv_workspace_search`
- `rv_list_workspace_files`
- `rv_schedule_task`
- `rv_open_file`

任务：

- 在 Runner 内创建 in-process MCP server。
- 工具实现通过主进程 service 调用宿主能力。
- 每个工具有权限分类和审计日志。
- workspace 可配置启用/禁用。

完成定义：

- Claude Code 能原生看到 `mcp__rv_insights__*` 工具。
- 工具调用会产生统一 stream event。
- 权限 UI 能显示 MCP 工具请求。

文件范围：

- `apps/electron/src/main/lib/agent-host-mcp-server.ts`
- `apps/electron/src/main/lib/agent-runtime-runner.ts`
- `apps/electron/src/main/lib/memory-service.ts`
- `apps/electron/src/main/lib/agent-workspace-manager.ts`
- `packages/shared/src/agent/host-tools.ts`

实现顺序：

1. 先实现只读工具：`rv_workspace_search`、`rv_list_workspace_files`、`rv_memory_search`。
2. 再实现低风险 side effect：`rv_open_file`。
3. 最后实现写入/外发：`rv_memory_append`、`rv_send_channel_message`、`rv_schedule_task`。

测试重点：

- MCP 工具入参做 runtime schema 校验。
- 工具只能访问允许 workspace path。
- side effect 工具必须走权限事件。
- 工具失败返回结构化错误，不让 SDK stream 崩溃。
- MCP 合并顺序为 workspace MCP、runtime overlay MCP、channel-scoped MCP；同名 server 以更近作用域覆盖，但必须记录冲突日志。

回滚点：

- workspace manifest 中关闭 `hostBridge.enabled`。

## 阶段 6：外部渠道统一接入

目标：飞书、钉钉、微信等不再绕过或复制 Agent 逻辑，而是走 Agent Runtime Service。
UI 约束：Electron 客户端仍保持原有入口和展示，不因为外部渠道接入而改版。

任务：

- 定义 `AgentChannel` 抽象。
- Electron IPC 实现为默认 channel。
- 飞书 bridge 迁移为 channel adapter。
- 后续 Telegram 可按同一接口接入。
- 外部渠道输出消费 `AgentStreamEvent`，按渠道能力降级：
  - Electron：完整事件时间线
  - 飞书：流式卡片/最终 Markdown
  - 微信：短文本分片

完成定义：

- Electron 和飞书可驱动同一 session。
- 外部渠道不会直接调用低层 AgentOrchestrator。
- channel 逻辑不依赖 SDKMessage 内部结构。

文件范围：

- `apps/electron/src/main/lib/agent-channel.ts`
- `apps/electron/src/main/lib/agent-electron-channel.ts`
- `apps/electron/src/main/lib/feishu-bridge.ts`
- 后续 `dingtalk-bridge.ts` / `wechat-bridge.ts`

渠道降级规则：

| 事件类型 | Electron | 飞书 | 微信/短文本渠道 |
| --- | --- | --- | --- |
| `assistant_delta` | 实时增量 | 合并节流更新卡片 | 分片或最终输出 |
| `tool_started` | 时间线 | 卡片状态行 | 可省略或短提示 |
| `permission_requested` | 横幅 | 确认卡片 | 桌面确认提示 |
| `ask_user_requested` | 横幅输入 | 卡片按钮/文本回复 | 文本回复 |
| `run_failed` | 错误面板 | 错误卡片 | 简短错误 |

回滚点：

- 飞书保留旧 bridge 入口，`agentRuntimeChannelsV2` 关闭时不走 AgentChannel。
- 飞书/微信权限策略默认 `queue_to_desktop`，不再静默 `bypassPermissions`。
- 旧 bridge 可以保留为兼容适配层，但不能再直接访问 SDKMessage 内部字段。

## 阶段 7：Renderer 切到新事件 reducer

目标：删除 legacy event 转换。
UI 约束：必须做到“看起来一模一样”，只允许日志、数据来源和内部 reducer 变化。

任务：

- `useGlobalAgentListeners` 只消费 `AgentStreamEnvelope`。
- `agent-atoms.ts` 用新 reducer。
- `SDKMessageRenderer` 保留为 transcript/debug renderer，不再承担实时状态构造。
- `AgentMessages` 基于事件重放后的 view model 展示。
- 删除 `payloadToLegacyEvents()`。

完成定义：

- UI 行为一致或更清晰。
- 旧 `AgentEvent` 不再作为实时主协议。
- 事件 fixture 测试覆盖主 UI 状态。

文件范围：

- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`
- `apps/electron/src/renderer/atoms/agent-runtime-reducer.ts`
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx`
- `apps/electron/src/renderer/components/agent/ToolActivityItem.tsx`

迁移步骤：

1. UI 默认读取新 reducer view model。
2. 保留旧 reducer shadow compare，开发环境记录差异。
3. 确认 fixture 和人工流程稳定后删除 `payloadToLegacyEvents()`。
4. `SDKMessageRenderer` 降级为 transcript/debug 组件。
5. 双跑期间保存 shadow diff，便于发现 reducer 分歧。

回滚点：

- 开关切回旧 reducer，保留新事件日志用于排查。

## 阶段 8：清理旧 Orchestrator 与 Pipeline 复用

目标：让 Agent 和 Pipeline 共享 runner。
UI 约束：Pipeline 和 Agent 的用户界面保持现状，不以复用 Runner 为由调整界面结构。

任务：

- 删除或瘦身 `AgentProviderAdapter` 抽象。
- `agent-orchestrator.ts` 只保留调度职责，或被 `AgentRuntimeService` 取代。
- `pipeline-node-runner.ts` 改用 Agent Runtime Runner。
- 移除重复的 SDK env / permission / mcp 注入逻辑。

完成定义：

- Agent 与 Pipeline 的 Claude 执行入口统一。
- 没有重复的 Claude SDK query 包装。
- 构建、类型检查、核心流程测试通过。

文件范围：

- `apps/electron/src/main/lib/agent-orchestrator.ts`
- `apps/electron/src/main/lib/agent-service.ts`
- `apps/electron/src/main/lib/pipeline-node-runner.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`

迁移顺序：

1. 先让 Agent 主路径完全走 `AgentRuntimeService + Runner`。
2. 删除 `ClaudeAgentAdapter` 中与 Runner 重复的 SDK query 包装。
3. Pipeline developer/tester 等节点接入 Runner，但 Pipeline 状态仍由 Pipeline service 管。
4. 删除重复 env、permission、MCP 注入逻辑。
5. Pipeline 差异输入通过 `AgentEventSource` 或 run metadata 传入，不另起一套事件协议。

回滚点：

- Pipeline flag 独立关闭，不影响 Agent 主路径。
- 如果 Pipeline 接入失败，主 Agent runtime 不回滚；只回滚 Pipeline 复用路径。

## 验证矩阵

每个阶段至少验证：

- 类型检查：`bun run typecheck`
- Agent 发送消息
- Agent 停止
- resume 继续对话
- 权限请求 approve/deny
- AskUser 响应
- MCP 工具调用
- Skill 可见性
- 文件上传/附加目录
- fork / rewind
- 飞书入口，如果该阶段触及外部渠道
- Pipeline 节点执行，如果该阶段触及 runner 复用

旧 session 迁移判定：

| 旧数据状态 | 处理策略 |
| --- | --- |
| 只有旧 `AgentMessage` JSONL | 可打开展示；resume 时使用 context rehydration fallback，并标记 `resumeMode: "legacy_context"` |
| 有 `SDKMessage` JSONL 和 `sdkSessionId` | 优先 SDK resume |
| 缺 `sdkSessionId` | 不尝试 SDK resume，提示将以历史上下文继续 |
| `sdkSessionId` 失效 | 发 `resume_failed`，允许用户新 run 继续 |
| 有 `resumeAtMessageUuid` | 映射为 `resumeSessionAt`，失败则 fallback |
| fork/rewind 源 session | 保留源 cwd 和 transcript 引用，新 run 产生新 `runId` |
| file-history-snapshot 缺失 | 不阻塞打开；写入类工具运行前提示风险 |

双写与回滚总规则：

- 新旧协议共存时，新协议为主、旧协议 shadow compare。
- 任何终态重复都视为 bug，必须在 service 层去重。
- 任何 run 不能同时生成两个 `runId` 终态。
- 旧 session 兼容优先于新目录迁移；只有新建 session 才强制进入新 manifest。
- 如果任一阶段无法保证 event log 可重放，就不删旧路径。

## 主要风险

### 1. SDK session 语义迁移风险

`sdkSessionId`、`resumeSessionAt`、fork、rewind 目前已有业务语义。迁移到 Runner 后必须先保证旧 JSONL 和 Claude transcript 的映射关系。

缓解：

- 先双写 metadata。
- 先兼容旧 session。
- 不在同一阶段同时改 storage 和 runner。

### 2. 权限体验回退风险

权限从 Orchestrator 下沉到 Runner 后，UI pending request 不能丢。

缓解：

- 权限服务仍在主进程。
- Runner 通过回调/事件请求权限。
- 权限事件必须可重放。

### 3. Plugin runtime 路径风险

Claude Code plugin 对路径和 manifest 较敏感。

缓解：

- 物化 snapshot 后只传 snapshot path。
- 禁止直接修改用户全局 plugin。
- 增加 plugin fixture 测试。

### 4. Renderer 状态迁移风险

Agent UI 当前依赖大量 Jotai state 和 legacy event reducer。

缓解：

- 新旧 reducer 双跑一段时间。
- 用 fixture 对比最终 view model。
- 最后再删除 legacy path。

### 5. 过度照搬 happyclaw 风险

happyclaw 的多用户、IM-first、Docker、计费不适合 RV-Insights 当前项目原则。

缓解：

- 每个实现阶段都检查是否仍满足本地优先、配置文件优先、不引入数据库、不默认 Docker。

## 推荐第一批落地 PR

1. 新增 shared Agent runtime event 类型和 fixture。
2. 新增进程内 `AgentRuntimeRunner`，但 Orchestrator 仍保留调度。
3. 新增 Runtime Registry，只服务新会话，旧会话兼容读取。
4. Renderer 双跑新旧 reducer。
5. 清理 `payloadToLegacyEvents()`。
