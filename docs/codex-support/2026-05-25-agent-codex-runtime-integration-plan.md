# Agent 模式 Codex Runtime 接入开发方案

状态：Phase 8 文档同步
日期：2026-05-25
最近更新：2026-05-27 Phase 8 实现状态回填
目标目录：`docs/codex-support/`

## 0. 当前实现状态快照

截至 2026-05-27，Agent 模式 Codex Runtime 的 Phase 0-7 主体实现、真实 runtime 接入、打包验证和成功路径 smoke 已完成。当前文档从原始设计方案升级为实现对照文档：保留方案推理，同时记录已经落地的实现差异、验证证据和长期维护入口。

已落地的关键状态：

- Agent 主进程已注册 `CodexAgentRuntime`，通过 `CodingAgentRuntimeRegistry` 在 Claude Code 与 Codex 之间选择 runtime；`CODEINSIGHTS_AGENT_CODEX_RUNTIME` 继续作为显式 feature flag 边界。
- Codex runtime 使用 `@openai/codex-sdk@0.130.0` / `@openai/codex@0.130.0`，真实运行走 `runStreamed()`，并把 Codex `ThreadEvent` 映射到 CodeInsights runtime events。
- Renderer 已接入 Agent runtime 设置、Codex auth/model/reasoning/network/web-search 配置、runtime badge 和 Codex runtime transcript 历史回放。
- Phase 7 已验证 native / read-only / workspace-write / resume / web-search / stop / packaged startup / packaged history reload / MCP config injection。
- CodeInsights workspace stdio/http MCP 已安全映射到 Codex 原生 `mcp_servers` 配置；secret 只通过 Codex 子进程 env 间接注入，不进入 SDK `--config` argv。
- `CODEX_SMOKE_API_KEY` channel API key smoke 暂缓：除非用户重新明确要求，不主动补跑，不读取 ambient `OPENAI_API_KEY`，该项作为已知未完成验证保留，不阻塞 Phase 8 文档。
- 根 `README.md` / `AGENTS.md` 仍未修改；若公开文档需要同步，必须先获得用户明确允许。

## 1. 背景与目标

CodeInsights 当前公开主入口是 `Pipeline | Agent`。Agent 模式的默认后端仍是 `@anthropic-ai/claude-agent-sdk`，但现在已经具备可插拔 `CodingAgentRuntime` 边界，并在 feature flag 下接入 Agent Codex runtime。应用层负责会话、工作区、权限、MCP 配置、消息持久化、事件转发和 UI 展示；Claude / Codex 只承担具体 coding-agent runtime 执行。Pipeline 模式也已经接入 `@openai/codex-sdk` / `@openai/codex`，但该接入仍是面向 Pipeline 节点的结构化一次性执行，不等同于 Agent 自由对话 runtime。

本方案的目标是在 Agent 模式新增一个 **Codex Runtime 后端接入点**。这不是新增一个普通 OpenAI 模型 Provider，也不是用 Responses API 或自研工具循环重写 Codex 能力，而是让 CodeInsights 作为 Coding Agent 产品的代理层，直接复用完整 Codex runtime：

- Codex 的工具、推理、MCP、sandbox、session、CLI 行为由 Codex 自身提供。
- CodeInsights 只做外层产品能力：桌面 UI、会话索引、工作区隔离、配置管理、凭证选择、事件可视化、权限策略、停止/恢复、审计和本地文件存储。
- Codex 升级后，只要 SDK/CLI 事件与配置契约兼容，Agent 模式应尽量自动受益，而不是每次重新适配工具细节。
- 未来同一抽象还应能接入更多 coding-agent runtime。

推荐结论已落地：**Agent 执行层已从 `ClaudeAgentAdapter.query(SDKMessage)` 升级为可插拔 `CodingAgentRuntime`，并新增 `CodexAgentRuntime`。Codex 会话优先持久化 runtime events，不把 Codex 长期伪造成 Claude SDKMessage。**

## 2. 需求边界

### 2.1 本次要做

- 为 Agent 模式设计 runtime-neutral 后端边界。
- 让 Claude Code 与 Codex 都成为 `CodingAgentRuntime` 的实现。
- 复用现有 Agent UI、IPC、Jotai、会话列表和工作区体系，第一阶段不做大规模 UI 改版。
- 复用现有 Pipeline Codex 中已经验证过的 Codex binary 解析、auth/env 隔离、打包配置和进程清理经验。
- 用 `@openai/codex-sdk` 的 `runStreamed()` 作为 Agent Codex runtime 的优先接入方式。
- 保留现有 Claude Agent 路径作为默认和回滚路径，Codex 通过显式设置或 feature flag 开启。

### 2.2 本次不做

- 不重新实现 Codex 的工具调用循环、shell 执行器、MCP 调度、模型推理和 patch 生成逻辑。
- 不把 Codex 当成普通 `openai` chat provider。
- 不用 Pipeline 的 `PipelineNodeRunner` 直接承载 Agent 自由对话。
- 不承诺首版达到 Claude Code 的所有交互能力等价，尤其是 Codex SDK 当前没有暴露与 Claude `canUseTool` 完全等价的 per-tool permission callback。
- 不在未经确认的情况下改 README / AGENTS.md 的公开文档。若功能实现后需要同步文档，应另起确认。

## 3. 当前代码事实

### 3.1 Agent 模式现有链路

当前发送链路：

```text
AgentView
  -> window.electronAPI.sendAgentMessage(input)
  -> preload AGENT_IPC_CHANNELS.SEND_MESSAGE
  -> main/ipc/agent-handlers.ts
  -> runAgent(input, webContents)
  -> AgentOrchestrator.sendMessage()
  -> CodingAgentRuntimeRegistry.resolve()
  -> ClaudeCodeRuntime | CodexAgentRuntime
  -> @anthropic-ai/claude-agent-sdk query() | @openai/codex-sdk runStreamed()
```

关键文件：

- `apps/electron/src/renderer/components/agent/AgentView.tsx`：构造 `AgentSendInput`，发送消息和停止。
- `apps/electron/src/preload/index.ts`：暴露 `sendAgentMessage`、`stopAgent`、流式事件监听和权限响应。
- `apps/electron/src/main/ipc/agent-handlers.ts`：注册 Agent IPC handler。
- `apps/electron/src/main/lib/agent-service.ts`：创建 runtime registry，注册 `ClaudeCodeRuntime` 与 `CodexAgentRuntime`，再创建 `AgentEventBus`、`AgentOrchestrator`。
- `apps/electron/src/main/lib/agent-orchestrator.ts`：当前 Agent 主编排层，负责 runtime 选择、会话绑定、事件持久化、停止与标题生成。
- `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`：封装 Claude SDK 路径。
- `apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`：动态导入 `@openai/codex-sdk` 并调用 `runStreamed()`。
- `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`：将 Codex `ThreadEvent` 映射为 CodeInsights runtime event。

已收敛的原耦合点：

- `agent-service.ts` 不再只注册 Claude；Codex runtime 在 feature flag 保护下可被选择。
- `AgentOrchestrator` 仍负责产品层编排，但 runtime 具体执行已下沉到 `CodingAgentRuntime` 实现。
- Codex 会话历史通过 runtime events 回放，Claude legacy 会话继续兼容 SDKMessage。
- Runtime materializer 已能保留 runtime-specific 信息；Codex 不复用 `.claude` 目录语义。
- 运行中会话 runtime 绑定已固化，避免 settings 后续变化污染已有 Codex thread resume。

### 3.2 Agent 侧已有可复用基础设施

这些能力应尽量复用，不应为 Codex 另起一套产品层：

- 会话元数据和 JSONL：`agent-session-manager.ts`
- runtime event log：`agent-runtime-event-log.ts`
- runtime envelope 类型：`packages/shared/src/agent/runtime-events.ts`
- workspace / MCP / skills 管理：`agent-workspace-manager.ts`
- permission / AskUser / ExitPlan 服务：`agent-permission-service.ts`、`agent-ask-user-service.ts`、`agent-exit-plan-service.ts`
- 全局 Agent IPC 监听：`useGlobalAgentListeners.ts`
- Jotai Agent 状态：`agent-atoms.ts`

### 3.3 Pipeline Codex 现有实现

Pipeline 的 Codex 接入集中在：

- `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- `apps/electron/src/main/lib/pipeline-node-router.ts`
- `apps/electron/src/main/lib/pipeline-codex-settings.ts`
- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`

已验证事实：

- `@openai/codex-sdk@0.130.0` 和 `@openai/codex@0.130.0` 已进入 Electron 包依赖。
- esbuild 已 external 化 `@openai/codex-sdk` / `@openai/codex`。
- electron-builder 已包含 `@openai/codex-sdk`、`@openai/codex` 和多平台 Codex binary 子包。
- `resolveCodexCliPath()` 已实现平台包解析和 `.asar.unpacked` 路径处理。
- `CodexSdkPipelineNodeRunner` 当前调用 `new Codex(...) -> startThread(...) -> thread.run(...)`。
- `CODEINSIGHTS_PIPELINE_CODEX_BACKEND=cli` 可切换到 CLI executor，否则默认 SDK。

可复用：

- Codex binary 解析和平台包映射。
- Codex auth/env 隔离经验。
- `CODEX_HOME` / API key / native auth 的优先级处理。
- Codex CLI 进程树清理。
- 打包配置。
- `openai` / `custom` 渠道凭证解密与 baseUrl 传递。

不可直接复用：

- `PipelineNodeRunner` 是节点式结构化执行接口，不适合 Agent 自由对话。
- `buildCodexPrompt()` 强制要求 JSON Schema 最终输出，不能用于 Agent 对话。
- Pipeline 的 Git guard 文案、patch-work、contribution task、stage output 都是 Pipeline 专用。
- Pipeline SDK runner 当前只用 `thread.run()`，没有 `runStreamed()`、Codex thread id 持久化和实时事件映射。

### 3.4 Codex SDK / CLI 事实边界

本地已安装 `@openai/codex-sdk@0.130.0`。其 README 和类型定义显示：

- TypeScript SDK 是 `codex` CLI 的封装，会 spawn `@openai/codex` CLI，并通过 stdin/stdout JSONL 交换事件。
- `Codex` 支持 `startThread(options)` 和 `resumeThread(threadId, options)`。
- `Thread.run()` 会缓冲到 turn 结束。
- `Thread.runStreamed()` 返回结构化事件 async generator，适合 Agent UI 实时展示。
- Codex thread 持久化在 `~/.codex/sessions`，SDK 可用 `resumeThread()` 继续。
- `Codex` client 支持 `env`；一旦提供 env，SDK 不继承 `process.env`，适合 Electron 沙箱化宿主。
- SDK 支持 `baseUrl`、`apiKey`、`config` override。
- Thread options 支持 `model`、`sandboxMode`、`workingDirectory`、`skipGitRepoCheck`、`modelReasoningEffort`、`networkAccessEnabled`、`webSearchMode`、`approvalPolicy`、`additionalDirectories`。
- `runStreamed()` 事件包括 `thread.started`、`turn.started`、`item.started`、`item.updated`、`item.completed`、`turn.completed`、`turn.failed`、`error`。
- item 类型包括 `agent_message`、`reasoning`、`command_execution`、`file_change`、`mcp_tool_call`、`web_search`、`todo_list`、`error`。

CLI help 显示：

- `codex exec --json` 输出 JSONL。
- `--sandbox` 可选 `read-only`、`workspace-write`、`danger-full-access`。
- `--ask-for-approval` 可选 `untrusted`、`on-failure`、`on-request`、`never`。
- `--cd` 指定 working root。
- `--add-dir` 添加额外目录。
- `--skip-git-repo-check` 允许非 Git 仓库运行。
- `--ignore-user-config` 不加载 `$CODEX_HOME/config.toml`，但 auth 仍使用 `CODEX_HOME`。
- 顶层命令包含 `mcp`、`plugin`、`app-server`、`resume`、`fork` 等。

重要限制：

- 当前 TypeScript SDK 类型没有暴露 Claude `canUseTool` 等价的 per-tool permission callback。
- 当前 TypeScript SDK 类型没有暴露运行中注入 queue message 的 channel。
- 当前 TypeScript SDK 类型没有暴露 fork / rewind 文件快照等与现有 Claude Agent 完全等价的 API。

本节事实来源：

- 本地包：`apps/electron/node_modules/@openai/codex-sdk/README.md`
- 本地类型：`apps/electron/node_modules/@openai/codex-sdk/dist/index.d.ts`
- 本地 CLI：`apps/electron/node_modules/@openai/codex/bin/codex.js --help` 与 `codex exec --help`
- OpenAI Codex 官方仓库文档：`https://raw.githubusercontent.com/openai/codex/main/sdk/typescript/README.md`
- Codex `AGENTS.md` / config / skills 文档入口：`https://raw.githubusercontent.com/openai/codex/main/docs/agents_md.md`、`config.md`、`skills.md`

## 4. 目标架构

### 4.1 总体形态

```text
Renderer Agent UI / 外部渠道
        |
        v
Agent IPC / AgentChannel
        |
        v
AgentRuntimeOrchestrator
        |
        +--> Session / Workspace / Permission / EventLog / Title / Settings
        |
        v
CodingAgentRuntimeRegistry
        |
        +--> ClaudeCodeRuntime
        |       -> @anthropic-ai/claude-agent-sdk
        |
        +--> CodexRuntime
                -> @openai/codex-sdk
                -> @openai/codex native CLI
```

核心原则：

- `AgentRuntimeOrchestrator` 负责产品层，不直接知道 Claude/Codex SDK 细节。
- `CodingAgentRuntime` 负责调用底层完整 coding-agent runtime。
- 每个 runtime 只做薄适配：输入映射、事件映射、停止、session id 捕获、错误分类。
- Renderer 逐步从 SDKMessage 展示迁移到 `AgentStreamEnvelope` 展示。

### 4.2 推荐新增模块

```text
apps/electron/src/main/lib/agent-runtimes/
├── coding-agent-runtime-types.ts
├── coding-agent-runtime-registry.ts
├── claude-code-runtime.ts
├── codex-runtime.ts
├── codex-runtime-core.ts
├── codex-event-adapter.ts
└── codex-permission-policy.ts
```

职责：

- `coding-agent-runtime-types.ts`：定义 runtime-neutral 输入输出。
- `coding-agent-runtime-registry.ts`：按 session/settings 选择 runtime。
- `claude-code-runtime.ts`：封装当前 Claude adapter / runner v2，先保证行为不变。
- `codex-runtime.ts`：调用 `@openai/codex-sdk` 的 `runStreamed()`。
- `codex-runtime-core.ts`：从 Pipeline Codex runner 抽出 binary/env/auth/kill 可复用逻辑。
- `codex-event-adapter.ts`：Codex ThreadEvent -> AgentRuntimeEvent。
- `codex-permission-policy.ts`：CodeInsights permission mode -> Codex sandbox / approval / network 策略。

### 4.3 Runtime 中立接口

建议先引入下面的中立接口，不再让 Orchestrator 直接构造 Claude 专属 `ClaudeAgentQueryOptions`：

```ts
export type CodingAgentRuntimeKind = 'claude-code' | 'codex'

export interface CodingAgentRunInput {
  sessionId: string
  runId: string
  prompt: string
  model?: string
  cwd: string
  workspaceId?: string
  workspaceSlug?: string
  permissionMode: CodeInsightsPermissionMode
  resumeSessionId?: string
  runtimeManifest?: AgentRuntimeManifest
  additionalDirectories: string[]
  attachments: Array<{ type: 'local_image'; path: string } | { type: 'text'; text: string }>
  mentionedSkills: string[]
  mentionedMcpServers: string[]
  abortSignal: AbortSignal
  startedAt: number
  settings: AppSettings
}

export interface CodingAgentRunResult {
  runtimeKind: CodingAgentRuntimeKind
  runtimeSessionId?: string
  resultSubtype?: string
  terminalEvent?: AgentRuntimeEvent
}

export interface CodingAgentRuntime {
  kind: CodingAgentRuntimeKind
  run(input: CodingAgentRunInput): AsyncIterable<AgentStreamEnvelope>
  abort(sessionId: string): void
  queueMessage?(sessionId: string, message: AgentQueueMessageInput): Promise<string>
  setPermissionMode?(sessionId: string, mode: CodeInsightsPermissionMode): Promise<void>
  dispose(): void
}
```

首版允许 `queueMessage` 和 `setPermissionMode` 对 Codex 返回 `unsupported`，但 UI/Orchestrator 必须知道并给出确定行为，而不是静默失败。

## 5. 数据契约设计

### 5.1 Session metadata

当前 `AgentSessionMeta.sdkSessionId` 是 Claude SDK session id。为了支持未来更多 runtime，不建议继续添加 `codexThreadId` 这类 provider-specific 顶层字段。推荐新增通用字段，同时保留 `sdkSessionId` 作为 Claude legacy 兼容字段：

```ts
export interface AgentRuntimeSessionRef {
  kind: 'claude-code' | 'codex'
  externalSessionId: string
  createdAt: number
  updatedAt: number
}

export interface AgentSessionMeta {
  // existing fields...
  runtimeKind?: 'claude-code' | 'codex'
  runtimeSession?: AgentRuntimeSessionRef

  /**
   * @deprecated Claude Code legacy session id.
   * 迁移期继续读写，最终由 runtimeSession.externalSessionId 取代。
   */
  sdkSessionId?: string
}
```

迁移策略：

- 旧会话 `runtimeKind` 为空时视为 `claude-code`。
- 旧会话只有 `sdkSessionId` 时，读取时构造内存态 `runtimeSession = { kind: 'claude-code', externalSessionId: sdkSessionId }`。
- 新 Codex 会话只写 `runtimeSession`，不写 `sdkSessionId`。
- Claude 路径迁移完成前，同时写 `sdkSessionId` 和 `runtimeSession`，保证 rewind / fork 老代码不立刻断裂。

### 5.2 App settings

当前 `agentChannelId` / `agentModelId` 是 Claude Agent 渠道和模型选择；`pipelineCodexChannelId` 是 Pipeline 专用设置。Agent Codex 不能复用 `pipelineCodexChannelId`，否则用户会无法区分 Pipeline 节点与 Agent 自由对话的认证来源。

建议新增：

```ts
export interface AppSettings {
  agentRuntimeKind?: 'claude-code' | 'codex'
  agentCodexChannelId?: string | null
  agentCodexModelId?: string
}
```

语义：

- `agentRuntimeKind` 为空时默认 `claude-code`，保持现状。
- `agentCodexChannelId === null` 表示显式使用本机 Codex auth / `CODEX_API_KEY`。
- `agentCodexChannelId` 为字符串时，使用已保存的 `openai` / `custom` 渠道凭证。
- `agentCodexModelId` 仅对 Codex runtime 生效，不污染 Claude 模型选择。

### 5.3 Event source

`AgentEventSource` 当前没有 Codex 来源。建议扩展：

```ts
export type AgentEventSource =
  | 'claude_sdk'
  | 'codex_sdk'
  | 'codex_cli'
  | 'codeinsights'
  | 'permission_service'
  | 'ask_user_service'
  | 'runtime_service'
  | 'event_log'
```

`AgentRuntimeEvent.run_started` 建议增加 `runtimeKind`：

```ts
| {
    type: 'run_started'
    runtimeKind?: 'claude-code' | 'codex'
    model: string
    cwd: string
    permissionMode: CodeInsightsPermissionMode
    runtimeHash: string
    runnerMode?: AgentRuntimeRunnerMode
  }
```

兼容策略：字段可选，旧事件不需要迁移。

### 5.4 Runtime event 优先于 SDKMessage

首版 Codex 不应伪造成 Claude SDKMessage 作为主要持久化格式。推荐路径：

1. 新增 IPC：`AGENT_IPC_CHANNELS.GET_RUNTIME_EVENTS`。
2. Renderer 加载历史时同时读取 SDKMessage 和 runtime events。
3. Claude 会话继续优先展示 SDKMessage，Codex 会话优先展示 runtime events。
4. `AgentMessages` 增加 runtime transcript renderer。
5. 后续再把 Claude 也切到 runtime event 历史展示。

临时兼容：

- 为了最小可见改动，Codex runtime 可以在 live 状态中继续产出 `AgentRuntimeEvent`，由现有 `applyAgentStreamEnvelopeToState()` 驱动实时工具和文本。
- 不建议把 Codex item 强行转换为 Claude `SDKAssistantMessage` / `SDKUserMessage` 长期存储。

## 6. Codex event 映射

`@openai/codex-sdk` 的 ThreadEvent 应映射到 CodeInsights runtime envelope。

| Codex event | Codex item | CodeInsights event |
| --- | --- | --- |
| `thread.started` | - | `sdk_session`，`sdkSessionId = thread_id`。后续可改名为 `runtime_session` |
| `turn.started` | - | 可记录内部状态，不重复发 `run_started` |
| `item.started` | `agent_message` | `assistant_delta` 或 `assistant_message(status: complete)` |
| `item.updated` | `agent_message` | `assistant_delta`，需要按 item id 做增量 diff |
| `item.completed` | `agent_message` | `assistant_message(status: complete)` |
| `item.started/updated/completed` | `reasoning` | 新增 `reasoning_message` 或折叠到 `assistant_message` 的 metadata；首版可仅审计不展示 |
| `item.started/updated/completed` | `command_execution` | `tool_started(Bash)`、`tool_progress`、`tool_completed` |
| `item.completed` | `file_change` | `tool_started(PatchApply)` + `tool_completed`，或新增 `file_changed` |
| `item.started/updated/completed` | `mcp_tool_call` | `tool_started(server.tool)`、`tool_completed` |
| `item.completed` | `web_search` | `tool_started(WebSearch)`、`tool_completed` |
| `item.updated/completed` | `todo_list` | `agent_task_progress` 或新增 `todo_list_updated` |
| `item.completed` | `error` | 非 fatal 时 `tool_completed(status: error)`；fatal 由 `turn.failed` 决定 |
| `turn.completed` | - | `usage_updated` + `run_completed` |
| `turn.failed` | - | `run_failed` |
| `error` | - | `run_failed` |

增量策略：

- Codex `item.updated` 可能包含累计文本或累计 stdout；adapter 必须按 `item.id` 保存上一次内容，计算 delta 后再发 `assistant_delta` / `tool_progress`。
- 每个 item id 映射为稳定 `messageId` / `toolCallId`。
- `turn.completed` 到达前不能发送 `run_completed`。
- Abort 后如果 SDK 正常结束，Orchestrator 仍必须检查 active session，补写 `run_stopped`，沿用现有 lessons。

## 7. Codex auth 与环境隔离

Codex Agent runtime 应抽出 `codex-runtime-core.ts`，供 Pipeline 和 Agent 共用。

### 7.1 Auth 优先级

推荐规则：

1. 若 `agentCodexChannelId` 为 OpenAI / Custom 渠道：使用 safeStorage 解密出的 API key，并传给 `new Codex({ apiKey, baseUrl })`。
2. 若 `agentCodexChannelId === null`：使用本机 Codex auth 或环境变量。
3. 若无显式设置：默认使用本机 Codex auth / `CODEX_API_KEY`，但 UI 要显示认证来源。
4. 若都不存在：fail-fast，给出明确错误和恢复动作。

### 7.2 `CODEX_HOME` 规则

必须延续现有 lesson：

- 原生登录不等于保留整个 `HOME`。
- native auth 模式优先解析 `CODEX_HOME/auth.json`，否则回退 `HOME/.codex/auth.json`。
- 子进程只传明确 `CODEX_HOME`，隔离 `HOME` / `USERPROFILE` / `XDG_CONFIG_HOME`。
- API key 模式必须覆盖或隔离宿主继承的 `CODEX_HOME`，避免误加载用户全局 Codex 状态。
- 测试不得依赖开发机已有登录；mock runner 使用假 `CODEX_API_KEY`。

### 7.3 环境变量

Codex SDK `env` 一旦提供就不继承 `process.env`。因此 `buildCodexEnv()` 必须显式合并必要变量：

- 保留 `PATH`、`HOME`、`SHELL`、locale、proxy 等运行所需变量。
- 删除 `ANTHROPIC_*`。
- 删除不应泄漏的 Git / GitHub 凭证变量，除非用户显式允许。
- 删除 `CODEX_THREAD_ID`，避免外部线程污染。
- 根据应用代理设置注入 `HTTP_PROXY` / `HTTPS_PROXY`。
- API key 模式由 SDK 写入 `CODEX_API_KEY`，不要在主进程全局 `process.env` 写入。

## 8. 权限与 sandbox 策略

这是 Codex Agent 首版最大风险点。Claude Agent SDK 暴露 `canUseTool` 和 `setPermissionMode()`，当前 CodeInsights 可以做 per-tool 权限 UI。Codex TypeScript SDK 当前暴露的是 `approvalPolicy`、`sandboxMode`、`networkAccessEnabled`、`webSearchMode` 等 thread options，没有等价的 per-tool callback。

因此首版不要承诺完全等价权限体验。

### 8.1 推荐映射

| CodeInsights 模式 | Codex sandbox | Codex approval | network | 说明 |
| --- | --- | --- | --- | --- |
| `plan` | `read-only` | `never` | `false` | 只读规划，禁止写入。退出计划由 CodeInsights UI 控制下一轮运行模式 |
| `auto` | `workspace-write` | `never` | `false` 默认 | Codex 可写工作区，但不做 per-tool UI 审批；必须在 UI 标明 Codex runtime 权限语义 |
| `bypassPermissions` | `workspace-write` 或显式 `danger-full-access` | `never` | 用户设置决定 | 默认仍建议 `workspace-write`，只有显式高级设置才允许 danger |

不建议首版使用 `approvalPolicy: 'on-request'` 作为 UI 审批替代，因为当前 SDK 类型没有响应 approval request 的回调。如果 CLI JSONL 后续暴露 approval 事件和响应通道，再升级映射。

### 8.2 Plan Mode

Claude 的 `EnterPlanMode` / `ExitPlanMode` 是工具级交互。Codex 不应伪造相同工具。首版建议：

- 当当前会话 runtime 是 Codex 且模式为 `plan`，直接以 `read-only` sandbox 运行。
- UI 继续显示计划模式状态。
- 用户批准后，下一轮切换到 `auto` 或 `bypassPermissions`。
- 不把 `ExitPlanMode` 注入给 Codex，除非 Codex runtime 原生提供等价机制。

### 8.3 Git 防护

Pipeline 的 Git guard 是“禁止 Pipeline 节点产生真实 commit/push”。Agent 模式不是同一业务语义，不能直接照搬。但底层机制可复用：

- 可复用环境清理、PATH shim、进程清理、事后 refs/index/config 检测。
- 策略必须参数化：
  - `plan`：禁止写入和 Git mutation。
  - `auto`：允许工作区文件修改，但默认禁止 `git push/tag/reset/rebase/fetch/pull` 和 `gh` / `hub` 远端操作。
  - `bypassPermissions`：仅用户显式开启时放宽。
- 文案必须改成 Agent 语义，不使用 Pipeline patch-work 文案。

## 9. Runtime materialization

当前 manifest 字段包含 `claudeConfigDir`、`claudeMdPath`、`skillsDir`、`pluginsDir` 等 Claude 专用路径。Codex 支持自己的 config、AGENTS.md、MCP / plugin 发现机制，不能把 `.claude` 目录视为通用 runtime。

推荐演进：

```ts
export interface AgentRuntimeManifest {
  manifestVersion: 2
  workspaceId: string
  workspaceSlug: string
  runtimeRoot: string
  defaultCwd: string
  sessionCwd?: string
  runtimes: {
    claudeCode?: ClaudeCodeRuntimeManifest
    codex?: CodexRuntimeManifest
  }
  enabledMcpServers: AgentRuntimeManifestMcpServer[]
  enabledSkills: AgentRuntimeManifestSkill[]
  enabledPlugins: AgentRuntimeManifestPlugin[]
  additionalDirectories: AgentRuntimeManifestAdditionalDirectory[]
  runtimeHash: string
}
```

Codex materializer 首版建议：

- 在 session cwd 写入 `AGENTS.md`，内容等价当前 `CLAUDE.md` 的工作区说明，但不包含 Claude 专属指令。
- 写入 runtime-scoped Codex config，优先通过 SDK `config` override 传递，减少直接污染用户 `$CODEX_HOME/config.toml`。
- Workspace `mcp.json` 已在 Phase 7 映射到 Codex 原生 MCP 配置：enabled stdio/http server 会进入 SDK `config.mcp_servers`；stdio env 使用 `env_vars`，HTTP headers 使用 `env_http_headers`，真实 secret 只通过 Codex 子进程 env 间接注入，不进入 SDK `--config` argv。
- Workspace MCP 注入仍保留安全限制：legacy SSE 暂不映射，复杂 HTTP header key 暂跳过，workspace env 不能覆盖 Git guard/base env、proxy、Codex auth/home 等保留变量。
- Skills / plugins 不做手工复刻。Codex 原生支持前，只把 CodeInsights workspace 规则写入 `AGENTS.md`，不尝试模拟 Claude plugins。

## 10. Orchestrator 接入策略

### 10.1 第一阶段最小切入点

保持 renderer/preload/IPC 不变，先改 main 内部：

1. 在 `AgentSendInput` 增加可选 `runtimeKind?: 'claude-code' | 'codex'`，也可先只从 settings 读取。
2. `AgentOrchestrator.sendMessage()` 继续负责：
   - 并发守卫
   - 用户消息持久化
   - workspace / cwd 解析
   - dynamic context 和 mentioned tools 处理
   - 权限模式读取
   - runtime event log 启动
   - completion / title / error callback
3. 把“构造 Claude queryOptions + 调 adapter.query”下沉到 `ClaudeCodeRuntime`。
4. 新增 `CodexRuntime`，由 Orchestrator 根据 runtimeKind 调用。
5. Orchestrator 只消费 `AgentStreamEnvelope`，不再关心 SDK 原始 stream 细节。

### 10.2 Claude 路径保守迁移

为了降低风险，Claude 可以先做包装而不是重写：

- `ClaudeCodeRuntime` 内部暂时复用 `InProcessAgentRuntimeRunner` 和 `ClaudeAgentAdapter`。
- Orchestrator 逐步停止导入 `ClaudeAgentQueryOptions`。
- 等 Codex 路径跑通后，再把 Claude 专属 helper 从 Orchestrator 中剥离。

### 10.3 Codex 路径

Codex runtime 流程：

```text
resolve Codex auth/channel
  -> build isolated env
  -> create Codex({ codexPathOverride, apiKey, baseUrl, env, config })
  -> thread = existing ? codex.resumeThread(id, options) : codex.startThread(options)
  -> runStreamed(input, { signal })
  -> map ThreadEvent to AgentStreamEnvelope
  -> persist runtimeSession.externalSessionId on thread.started
  -> emit usage / terminal / errors
  -> cleanup command guard
```

## 11. UI 与设置

首版 UI 应小而明确：

- Agent 设置页增加 Runtime 选择：`Claude Code` / `Codex`。
- Codex 认证来源选择：
  - 本机 Codex auth / `CODEX_API_KEY`
  - 已保存 OpenAI / Custom 渠道
- Codex 模型选择独立于 Claude 模型。
- Agent Header 或输入区显示当前 runtime，避免用户以为正在使用 Claude。
- Codex runtime 下如果用户使用 queue message / rewind / fork / per-tool permission，应明确展示“不支持”或采用退化路径。

不建议：

- 不把 Pipeline Codex 供应商设置复用成 Agent Codex 设置。
- 不在模型渠道列表里把 OpenAI 渠道直接混入 Claude Agent 渠道，避免现有 `isAgentCompatibleProvider()` 语义混乱。

## 12. 功能兼容矩阵

| 功能 | Claude 当前 | Codex 首版目标 | 说明 |
| --- | --- | --- | --- |
| 基本文本对话 | 支持 | 支持 | Codex `agent_message` 映射 |
| 工具活动展示 | 支持 | 支持 | command/file/mcp/web_search/todo 映射 |
| MCP | 支持 CodeInsights workspace 注入 | stdio/http 原生配置注入已验证 | legacy SSE、复杂 header key 和真实模型强制 MCP tool-call smoke 后续评估 |
| 工作区 cwd | 支持 | 支持 | `workingDirectory` + session cwd |
| additional directories | 支持 | 支持 | `additionalDirectories` |
| 图片输入 | 支持 | 支持 | Codex SDK `local_image` |
| stop | 支持 | 支持 | `AbortSignal` + 进程清理 |
| resume | 支持 | 支持 | Codex `resumeThread(threadId)` |
| queue message during run | 支持 | 暂不支持或排队到下一轮 | SDK 无活跃 channel 注入 |
| soft interrupt | 支持 | 暂不支持 | 不伪造 |
| per-tool permission UI | 支持 | 暂不支持 | SDK 无等价 callback |
| Plan / ExitPlanMode 工具 | 支持 | 只支持宿主级 plan 模式 | 用 read-only sandbox |
| fork | 支持 | 待调研 | CLI 有 fork 命令，SDK 类型未暴露 |
| rewind files | 支持 | 暂不支持 | 现有实现依赖 Claude JSONL file history |
| prompt suggestion | 支持 | 待观察 | Codex event 类型未见 prompt_suggestion |
| Teams / subagent | 支持 Claude 语义 | 不复刻 | 等 Codex 原生能力 |

## 13. 分阶段实施计划

### Phase 0：基线冻结与文档确认

交付：

- 本方案文档。
- 明确首版 Codex runtime 的不等价能力清单。
- 确认是否接受“Codex 首版不支持 per-tool permission parity / rewind / queue injection”。

验证：

- `git diff --check`
- 文档链接和路径检查。

### Phase 1：共享类型与设置契约

交付：

- `CodingAgentRuntimeKind`。
- `AgentSessionMeta.runtimeKind` / `runtimeSession`。
- `AgentEventSource` 增加 `codex_sdk` / `codex_cli`。
- `run_started.runtimeKind` 可选字段。
- `AppSettings.agentRuntimeKind` / `agentCodexChannelId` / `agentCodexModelId`。
- 单元测试覆盖旧 session 默认 Claude。

验证：

- `bun run typecheck`
- `bun test packages/shared apps/electron/src/main/lib/settings-service.test.ts`

### Phase 2：抽出 Codex runtime core

交付：

- 从 `codex-pipeline-node-runner.ts` 抽出：
  - `resolveCodexCliPath`
  - `buildCodexEnv`
  - `resolveCodexAuth`
  - `createCodexCommandGuard`
  - 进程树清理
  - channel resolution
- Pipeline runner 改为引用 core，行为不变。

验证：

- `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- 新增 `codex-runtime-core.test.ts`
- `bun run --filter='@codeinsights/electron' typecheck`

### Phase 3：Codex event adapter

交付：

- `codex-event-adapter.ts`。
- Codex `ThreadEvent` fixture。
- item delta 计算。
- command/file/mcp/web/todo/error 映射。

验证：

- 单测覆盖每类 Codex item。
- 测试 abort 后不重复 terminal event。
- 测试 `turn.failed` 映射为 `run_failed`。

### Phase 4：CodexAgentRuntimeRunner

交付：

- `CodexAgentRuntime` 使用 `@openai/codex-sdk` `runStreamed()`。
- 捕获 `thread.started` 并保存 `runtimeSession.externalSessionId`。
- 支持 `resumeThread()`。
- 支持 `workingDirectory`、`additionalDirectories`、`model`、`modelReasoningEffort`、`sandboxMode`、`approvalPolicy`、`networkAccessEnabled`。
- 支持 AbortSignal。
- 不支持的 `queueMessage` / `setPermissionMode` 明确返回 unsupported。

验证：

- mock Codex client 单测。
- real Codex smoke test 作为手动验证，不纳入默认 CI。
- 停止场景测试：SDK 正常结束和抛 AbortError 都能落 `run_stopped`。

### Phase 5：Orchestrator runtime routing

交付：

- `CodingAgentRuntimeRegistry`。
- `AgentOrchestrator` 根据 settings/session runtime 选择 Claude 或 Codex。
- Claude 路径行为保持不变。
- Codex 路径写 runtime event log 和 complete signal。
- 运行中会话禁止切换 runtime。

验证：

- mock Claude runtime 保持现有 tests 通过。
- mock Codex runtime 覆盖成功、失败、停止、resume。
- `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`

### Phase 6：Renderer 历史展示与设置 UI

交付：

- 新增 `getAgentSessionRuntimeEvents` IPC。
- Codex 会话历史从 runtime events 回放。
- Agent 设置页加入 runtime 与 Codex auth/model 配置。
- Agent header 显示 runtime。
- Codex runtime 下禁用或解释 rewind/fork/soft interrupt。

验证：

- Jotai reducer 单测。
- AgentMessages runtime transcript 单测。
- 真实 Electron UI smoke：新建 Codex 会话、发送、停止、重开应用后能看到历史。

### Phase 7：真实集成验证

交付：

- 本机 Codex auth 模式真实运行。
- OpenAI / Custom API key 模式 smoke 保留为暂缓验证；除非用户重新明确要求，不主动补跑 `CODEX_SMOKE_API_KEY`，不读取 ambient `OPENAI_API_KEY`。
- workspace-write 修改文件。
- read-only plan 模式不写文件。
- MCP / web_search 能力按当前支持情况记录；Phase 7 已通过 web-search 真实 runtime smoke 和 MCP config injection smoke。
- 打包后 binary 路径验证。

验证：

- `bun run typecheck`
- `bun test --isolate`
- `bun run electron:build`
- `CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast`
- `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only binary|native|readonly|workspace-write|resume|web-search|stop|mcp`
- `bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui`

Phase 7 实际结果：

- `@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、binary `codex-cli 0.130.0` 已验证；npm latest 查询记录为 `0.133.0`，本阶段未升级依赖。
- native auth 隔离 smoke 会复制同源 `auth.json` 与 `config.toml`，保留中转 `model_provider` / `base_url`，并尊重 `model_reasoning_effort`；native / read-only / workspace-write / resume / web-search / stop 已通过。
- packaged history reload 使用 fixture-based UI smoke 验证重开读取和渲染链路；它不替代真实 Codex 写入链路验证。
- workspace MCP config injection smoke 已通过，Codex CLI `mcp list --json` 可识别 CodeInsights workspace 映射出的 stdio/http `mcp_servers`。
- channel API key smoke 仍未通过真实 API key 路径验证，按用户要求暂缓，不再阻塞 Phase 8。

## 14. 测试矩阵

| 层级 | 测试内容 | 方式 |
| --- | --- | --- |
| shared 类型 | runtime kind、event source、validation | bun test |
| settings | 新旧设置读写、无效 channel 清理 | bun test |
| codex core | auth/env/CODEX_HOME/proxy/Git env 清理 | bun test |
| event adapter | Codex item 全类型映射 | fixture test |
| runner | start/resume/abort/failure | mocked Codex SDK |
| orchestrator | runtime routing、active session、complete signal | unit test |
| renderer | runtime events replay、工具活动展示 | component / atom test |
| integration | 真实 Codex run | manual gated |
| packaging | 平台 binary 可解析 | build / dist smoke |

必须补的回归：

- Claude Agent 默认路径不受影响。
- 旧 `sdkSessionId` 会话可继续打开。
- Codex API key 模式不读取用户全局 `CODEX_HOME`。
- Codex native auth 模式不继承整个 `HOME`。
- 用户 stop 后不会落 completed。
- Codex turn failed 不会被 UI 当成成功完成。

## 15. 风险与开放问题

### 15.1 权限不等价

风险：Codex SDK 当前没有 Claude `canUseTool` 等价能力。若产品文案暗示 Codex 与 Claude 权限 UI 完全一致，会误导用户。

处理：

- UI 明确显示 Codex runtime 的权限语义。
- 首版只承诺 sandbox 级策略。
- 后续等待 Codex SDK/CLI 暴露 approval event/response 后再接入 per-tool UI。

### 15.2 历史展示依赖 SDKMessage

风险：现有 UI 历史展示依赖 Claude SDKMessage，Codex 没有同构消息。

处理：

- 引入 runtime event 历史加载。
- Codex 会话优先用 runtime transcript renderer。
- 不长期存储伪造 Claude SDKMessage。

### 15.3 Rewind / fork 不等价

风险：现有 rewind 依赖 Claude SDK JSONL file-history snapshot；Codex SDK 当前未暴露等价 API。

处理：

- Codex 首版隐藏或禁用 rewind。
- fork 仅在确认 Codex SDK/CLI 可稳定调用后支持。
- 不用自研文件快照假装等价，除非另起方案。

### 15.4 MCP / Skills 差异

风险：Claude plugins/skills 与 Codex MCP/plugin 不是同一机制。

处理：

- Runtime manifest 拆分 runtime-specific 字段。
- CodeInsights workspace stdio/http MCP 已映射到 Codex 原生 `mcp_servers` 并通过 config injection smoke。
- 不把 MCP secret 写入 SDK `config` / CLI argv；只传环境变量名，真实值通过 Codex 子进程 env 注入。
- legacy SSE、复杂 HTTP header key 和真实模型强制调用本地 MCP 的 smoke 仍需后续评估。
- 不强行模拟 Claude plugins；Codex skills/plugin 与 CodeInsights skills/plugin 的长期关系另行设计。

### 15.5 打包体积与平台包

风险：Codex binary 约百 MB 级，平台包增加安装体积和 CI 构建复杂度。

处理：

- 复用现有 `@openai/codex-*` optionalDependencies。
- 打包检查必须覆盖 `apps/electron/electron-builder.yml`。
- macOS x64 / arm64、Windows x64 分别验证 binary 存在。

## 16. 推荐文件改动清单

首批代码 PR 建议按下面顺序拆，避免一次性大爆炸：

1. `packages/shared/src/types/agent.ts`
   - 增加 runtime kind / runtime session metadata / event source。
2. `apps/electron/src/types/settings.ts`
   - 增加 Agent Codex settings。
3. `apps/electron/src/main/lib/agent-runtimes/codex-runtime-core.ts`
   - 从 Pipeline runner 抽公共 Codex core。
4. `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
   - 改用 Codex core，保持行为不变。
5. `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`
   - Codex event fixture 映射。
6. `apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`
   - 新 runtime runner。
7. `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`
   - 包装当前 Claude runner。
8. `apps/electron/src/main/lib/agent-orchestrator.ts`
   - 接入 runtime registry。
9. `apps/electron/src/main/ipc/agent-handlers.ts` / `preload/index.ts`
   - 增加 runtime events 历史读取。
10. `apps/electron/src/renderer/components/settings/AgentSettings.tsx`
    - Runtime 设置 UI。
11. `apps/electron/src/renderer/components/agent/AgentMessages.tsx`
    - Codex runtime transcript renderer。

## 17. 最终验收标准

Codex Agent 首版可标记完成，必须同时满足：

- 新建 Codex Agent 会话可以发送消息并看到流式文本。
- 命令执行、文件修改、MCP 调用或 web search 至少能按 Codex event 类型展示为工具活动；不支持项必须明确显示。
- 停止按钮能终止 Codex run，且 UI 最终态是 stopped，不是 completed。
- 会话重开后能通过 runtime event 历史恢复主要对话和工具活动。
- Codex thread id 能持久化，并可用 `resumeThread()` 继续下一轮。
- Claude Agent 默认路径无行为回归。
- native auth 模式已通过环境隔离测试；channel API key 模式保留为暂缓的已知未完成验证。
- 打包后能解析 Codex binary。
- 文档记录首版不支持 per-tool permission parity、rewind、soft interrupt 的边界。

## 18. 推荐决策

推荐采用“三步走”：

1. **先抽中立 runtime 边界**：降低 Orchestrator 与 Claude 的耦合，Claude 行为不变。
2. **再接 Codex `runStreamed()`**：以 runtime event 为唯一稳定输出，不伪造成 Claude SDKMessage。
3. **最后补 UI 和能力等价**：等真实 Codex SDK/CLI 能力确认后，再逐项补 MCP、permission、fork、rewind。

这样最符合项目定位：CodeInsights 是 Coding Agent 产品代理层，而不是又实现一个 Agent。Claude Code、Codex 以及未来更多 coding-agent 都应在同一 runtime 边界下被接入。

## 19. 二次细化总览

本轮细化的重点不是扩大范围，而是把已有结论拆成可以执行、可以测试、可以回滚的工程单元。后续实现应遵循下面的顺序：

1. 先稳定公共契约：runtime kind、runtime session、event source、settings。
2. 再抽 Codex core：binary、auth、env、command guard 先从 Pipeline 中拆出来，确保 Pipeline 行为不变。
3. 再做 Codex event adapter：不接 Orchestrator，先用 fixtures 把 `ThreadEvent` 到 `AgentStreamEnvelope` 的映射跑绿。
4. 再接 Codex runtime：用 mock Codex SDK 跑 start/resume/abort/failure。
5. 最后接 UI 与设置：Codex 会话历史基于 runtime events 回放，Claude 继续保守使用现有路径。

这意味着第一批 PR 可以完全不触碰渲染层；第二批 PR 可以完全不触碰真实 Codex；第三批 PR 才进入真实集成。这样能避免“抽象、SDK、UI、打包”一次性混在同一轮修改里。

## 20. Runtime 边界落地设计

### 20.1 类型放置

建议把 runtime-neutral 的跨进程契约放在 `@codeinsights/shared`，把 Electron 主进程专用依赖放在 `apps/electron/src/main/lib/agent-runtimes/`。

推荐分布：

- `packages/shared/src/types/agent.ts`
  - `CodingAgentRuntimeKind`
  - `AgentRuntimeSessionRef`
  - `AgentSessionMeta.runtimeKind`
  - `AgentSessionMeta.runtimeSession`
- `packages/shared/src/agent/runtime-events.ts`
  - `AgentEventSource` 增加 `codex_sdk`、`codex_cli`
  - `run_started.runtimeKind?: CodingAgentRuntimeKind`
  - 兼容保留 `sdk_session`，新增别名型事件前不要破坏现有回放。
- `apps/electron/src/types/settings.ts`
  - `agentRuntimeKind?: CodingAgentRuntimeKind`
  - `agentCodexChannelId?: string | null`
  - `agentCodexModelId?: string`
  - `agentCodexReasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'`
  - `agentCodexNetworkAccessEnabled?: boolean`
  - `agentCodexWebSearchMode?: 'disabled' | 'cached' | 'live'`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts`
  - 主进程 runtime 接口、resolved settings、unsupported capability 错误。

首版不要把 `CodexOptions`、`ThreadEvent`、`ClaudeAgentQueryOptions` 暴露到 shared。shared 只表达 CodeInsights 自己的中立契约。

### 20.2 主进程接口

建议的主进程接口比第 4 节更严格，便于 Orchestrator 统一处理终态和 unsupported 能力：

```ts
export type CodingAgentRuntimeKind = 'claude-code' | 'codex'

export interface CodingAgentAttachmentInput {
  type: 'local_image' | 'text'
  path?: string
  text?: string
}

export interface CodingAgentRuntimeCapabilities {
  queueMessage: 'supported' | 'unsupported'
  changePermissionModeDuringRun: 'supported' | 'unsupported'
  perToolPermission: 'supported' | 'unsupported'
  rewind: 'supported' | 'unsupported'
  fork: 'supported' | 'unsupported' | 'unknown'
  runtimeEventHistory: 'supported'
}

export interface CodingAgentRunInput {
  sessionId: string
  runId: string
  prompt: string
  model: string
  cwd: string
  workspaceId?: string
  workspaceSlug?: string
  permissionMode: CodeInsightsPermissionMode
  resumeSessionId?: string
  runtimeManifest?: AgentRuntimeManifest
  additionalDirectories: string[]
  attachments: CodingAgentAttachmentInput[]
  abortSignal: AbortSignal
  runtimeHash: string
  startedAt: number
}

export interface CodingAgentRunResult {
  runtimeKind: CodingAgentRuntimeKind
  externalSessionId?: string
  resultSubtype?: string
  terminalEvent?: AgentRuntimeEvent
}

export interface CodingAgentRuntime {
  readonly kind: CodingAgentRuntimeKind
  readonly capabilities: CodingAgentRuntimeCapabilities
  run(input: CodingAgentRunInput): AsyncIterable<AgentStreamEnvelope>
  abort(sessionId: string): void
  queueMessage(sessionId: string, message: AgentQueueMessageInput): Promise<UnsupportedRuntimeCapabilityResult>
  setPermissionMode(sessionId: string, mode: CodeInsightsPermissionMode): Promise<UnsupportedRuntimeCapabilityResult>
  dispose(): void
}
```

`queueMessage()` 和 `setPermissionMode()` 对 Codex 首版应显式返回：

```ts
{ ok: false, code: 'runtime_capability_unsupported', runtimeKind: 'codex', capability: 'queueMessage' }
```

不要让 UI 等待永远不会发生的 Codex approval/queue 事件。

### 20.3 Registry 选择规则

Runtime 选择应该集中在 `CodingAgentRuntimeRegistry`，不要散落在 UI、IPC、Orchestrator 和 session manager。

解析优先级：

1. 如果当前 session 已有 `runtimeKind`，继续使用该 runtime。
2. 如果当前 session 没有 `runtimeKind` 但有 `sdkSessionId`，视为 `claude-code` legacy。
3. 如果是新 session，读取 `settings.agentRuntimeKind`。
4. 如果 settings 为空，默认 `claude-code`。
5. 如果用户尝试在已有 session 切换 runtime，拒绝并提示“一个会话只能绑定一个 runtime”。

伪代码：

```ts
function resolveRuntimeKind(input: ResolveRuntimeInput): CodingAgentRuntimeKind {
  if (input.session.runtimeKind) return input.session.runtimeKind
  if (input.session.sdkSessionId) return 'claude-code'
  return input.settings.agentRuntimeKind ?? 'claude-code'
}
```

会话第一次发送成功捕获外部 session id 后，立即写回：

```ts
updateAgentSessionMeta(sessionId, {
  runtimeKind: runtime.kind,
  runtimeSession: {
    kind: runtime.kind,
    externalSessionId,
    createdAt: now,
    updatedAt: now,
  },
  sdkSessionId: runtime.kind === 'claude-code' ? externalSessionId : existingSdkSessionId,
})
```

Codex 会话不要写 `sdkSessionId`，除非为了临时兼容某个只读 UI 分支必须写入；如果必须写，应标记迁移债并限定生命周期。

### 20.4 运行中状态机

Orchestrator 侧建议保持一个 runtime-neutral active run 表：

```ts
interface ActiveAgentRun {
  sessionId: string
  runId: string
  runtimeKind: CodingAgentRuntimeKind
  abortController: AbortController
  startedAt: number
  terminalWritten: boolean
}
```

关键约束：

- active run 存在时，拒绝同 session 第二次 send。
- stop 时只通过 `runtime.abort(sessionId)` 和 `abortController.abort()` 双通道终止。
- runtime stream 正常结束后，仍要检查 `abortSignal.aborted`，避免用户 stop 后落 `run_completed`。
- terminal event 必须由 writer 或 Orchestrator 去重，不能依赖 runtime 自己保证。
- session 级 runtimeKind 在 active run 期间禁止修改。

## 21. Codex Runtime Core 抽取设计

### 21.1 抽取目标

`codex-pipeline-node-runner.ts` 当前同时包含 Pipeline 业务 prompt、JSON Schema 解析、Codex binary 查找、auth/env、Git guard、CLI executor。新增 Agent Codex 时应先抽公共 core，避免复制第二套。

建议新增：

```text
apps/electron/src/main/lib/codex-runtime/
├── codex-binary.ts
├── codex-auth.ts
├── codex-env.ts
├── codex-command-guard.ts
├── codex-channel.ts
├── codex-sdk-client.ts
└── index.ts
```

Pipeline 文件只保留节点业务：

- `buildCodexPrompt()`
- `buildCodexCliArgs()`
- `CodexSdkPipelineNodeRunner`
- `SpawnCodexCliExecutor`
- JSON schema 输出解析
- Pipeline Git guard 策略参数。

### 21.2 公共函数签名

推荐公共 core 暴露以下函数：

```ts
export interface ResolveCodexChannelInput {
  channelId?: string | null
  allowNativeAuth: boolean
  purpose: 'agent' | 'pipeline'
}

export interface ResolvedCodexChannel {
  source: 'channel' | 'native'
  channelId?: string
  apiKey?: string
  baseUrl?: string
  model?: string
}

export function resolveCodexChannel(input: ResolveCodexChannelInput): ResolvedCodexChannel

export interface BuildCodexEnvInput {
  auth: ResolvedCodexAuth
  proxyUrl?: string
  inheritedEnv?: NodeJS.ProcessEnv
  extraEnv?: Record<string, string>
}

export function buildCodexEnv(input: BuildCodexEnvInput): Record<string, string>

export interface CodexExecutionGuardInput {
  env: Record<string, string>
  auth: ResolvedCodexAuth
  repositoryRoot?: string
  policy: CodexCommandGuardPolicy
}

export function createCodexExecutionGuard(input: CodexExecutionGuardInput): Promise<CodexExecutionGuard>
```

其中 `purpose` 只用于错误文案和默认策略，不应让 Agent 复用 Pipeline prompt 或节点 guard 文案。

### 21.3 Auth 算法

Codex auth 需要明确区分“凭证来源”和“子进程隔离目录”。

推荐算法：

1. `agentCodexChannelId` 是字符串：
   - 校验 channel 存在、启用、provider 是 `openai` 或 `custom`。
   - 解密 API key。
   - `source = 'channel'`。
   - 子进程使用临时 `CODEX_HOME`，避免读取用户全局 Codex session/auth。
2. `agentCodexChannelId === null`：
   - `source = 'native'`。
   - 优先使用当前环境中的 `CODEX_HOME/auth.json`。
   - 其次使用当前环境中的 `CODEX_API_KEY`。
   - 再其次使用 `HOME/.codex/auth.json`。
   - 传给子进程时仍只传明确的 `CODEX_HOME`，不保留真实 `HOME`。
3. `agentCodexChannelId === undefined`：
   - 首版建议按 native auth 处理，但 UI 显示“自动使用本机 Codex auth”。
   - 若用户后来选择 channel，则新会话使用 channel，旧会话不自动迁移。

错误要可恢复：

- `codex_auth_missing`：没有 API key，也没有 native auth。
- `codex_channel_not_found`：保存的 channel 已被删除。
- `codex_channel_disabled`：channel 存在但关闭。
- `codex_channel_provider_unsupported`：不是 OpenAI/Custom。
- `codex_binary_missing`：平台包或 binary 不存在。

### 21.4 Env 白名单与黑名单

Codex SDK 的 `env` 是替换语义，因此 `buildCodexEnv()` 要先保留必要变量，再删危险变量。

保留：

- `PATH`
- `HOME` 只用于 native auth 探测阶段，传入子进程前替换成 guard home。
- `SHELL`
- `TMPDIR` / `TEMP` / `TMP`
- `LANG` / `LC_ALL` / `LC_CTYPE`
- `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`
- `SSL_CERT_FILE` / `NODE_EXTRA_CA_CERTS`

删除：

- `ANTHROPIC_*`
- `OPENAI_API_KEY`，除非本次明确采用环境 API key 模式。
- `CODEX_THREAD_ID`
- `GH_TOKEN`、`GITHUB_TOKEN`、`GITHUB_PAT`
- `SSH_AUTH_SOCK`
- 所有危险 `GIT_*`：`GIT_DIR`、`GIT_WORK_TREE`、`GIT_INDEX_FILE`、`GIT_ASKPASS`、`GIT_SSH`、`GIT_SSH_COMMAND`、`GIT_CONFIG*`

注入：

- 应用代理设置解析出的 `HTTP_PROXY` / `HTTPS_PROXY`。
- channel API key 对应的 `CODEX_API_KEY`，但只写入子进程 env。
- `CODEX_HOME` 指向本次 guard 决定的目录。
- `GIT_TERMINAL_PROMPT=0`、`GCM_INTERACTIVE=Never`。

### 21.5 Command guard 参数化

现有 Pipeline guard 的文案是 Pipeline 节点语义。Agent 需要独立策略：

```ts
export interface CodexCommandGuardPolicy {
  blockGitBinary: boolean
  blockRemoteWriteCli: boolean
  blockAbsoluteGitViaEnv: boolean
  disableGitCredentialPrompt: boolean
  purpose: 'agent' | 'pipeline'
}
```

Agent 默认：

- `plan`：`blockGitBinary = true`，`sandboxMode = 'read-only'`。
- `auto`：不完全屏蔽 `git`，但通过 env 阻断远端写和交互凭证；可选高级设置才允许解除。
- `bypassPermissions`：仍保留 `GIT_TERMINAL_PROMPT=0`，除非用户显式允许真实 Git 凭证交互。

这样既不误伤 Agent 对本地 `git diff/status` 的正常使用，也避免默认情况下执行 `git push`、`gh pr create` 这类远端副作用。

## 22. Codex Event Adapter 详细设计

### 22.1 Adapter 状态

Codex `item.updated` 可能是累计文本或累计输出。adapter 必须维护每个 item 的上一次快照：

```ts
interface CodexEventAdapterState {
  seenThreadId?: string
  startedItems: Set<string>
  completedItems: Set<string>
  previousAgentTextByItemId: Map<string, string>
  previousReasoningTextByItemId: Map<string, string>
  previousCommandOutputByItemId: Map<string, string>
  previousTodoTextByItemId: Map<string, string>
  terminalWritten: boolean
}
```

不要把 `item.updated` 的全量文本每次都作为 delta，否则 UI 会重复显示。

### 22.2 Delta 算法

文本 delta 可先用前缀差分：

```ts
function diffAppendOnly(previous: string, next: string): string {
  if (next.startsWith(previous)) return next.slice(previous.length)
  return next
}
```

如果 Codex 后续事件不是 append-only，则退化为发完整 `assistant_message` 覆盖态，并在 adapter 测试里记录该行为。首版不做复杂 LCS，避免把 runtime adapter 变成文本 diff 库。

### 22.3 映射细节

推荐细化如下：

| Codex item | started | updated | completed |
| --- | --- | --- | --- |
| `agent_message` | 建立 message id，不发空文本 | `assistant_delta` | `assistant_message` 覆盖最终内容 |
| `reasoning` | `agent_task_started` 或审计事件 | `agent_task_progress` | `agent_task_completed`，UI 默认折叠 |
| `command_execution` | `tool_started` name=`Bash`，inputSummary=command | `tool_progress` 输出 delta | `tool_completed`，exit_code 非 0 为 error |
| `file_change` | 不发，通常 completed 才有完整 changes | 不发 | `tool_started` name=`PatchApply` 后紧跟 `tool_completed` |
| `mcp_tool_call` | `tool_started` name=`server.tool` | 可发 `tool_progress` | `tool_completed`，error 映射为 error |
| `web_search` | `tool_started` name=`WebSearch` | 可忽略 | `tool_completed` |
| `todo_list` | `agent_task_started` | `agent_task_progress` | `agent_task_completed` |
| `error` | 不发或审计 | 不发 | 非 fatal `tool_completed(error)`，fatal 以 `turn.failed` 为准 |

`thread.started` 当前可继续映射为 `sdk_session`，但事件内容应把 Codex thread id 写入 `sdkSessionId` 字段只是兼容过渡。后续可以增加：

```ts
{ type: 'runtime_session', runtimeKind: 'codex', externalSessionId: thread_id }
```

在增加新事件前，必须先扩展 shared validator 和 replay，不要让旧 UI 读到 unknown event。

### 22.4 终态规则

终态规则必须由 adapter 和 Orchestrator 双层防御：

- `turn.completed` 映射 `usage_updated` 和 `run_completed`。
- `turn.failed` 映射 `run_failed`。
- 顶层 `error` 映射 `run_failed`。
- 如果 AbortSignal 已 aborted，优先写 `run_stopped`，不能写 completed。
- 如果 SDK generator 抛 AbortError，写 `run_stopped`。
- 如果 SDK generator 抛其他 Error，写 `run_failed`。
- 同一 run 只允许一个 terminal event。

### 22.5 Usage 映射

Codex usage 字段：

- `input_tokens` -> `inputTokens`
- `cached_input_tokens` -> `cacheReadTokens`
- `output_tokens` -> `outputTokens`
- `reasoning_output_tokens` 当前 shared 没有字段，可先放入 `details` 或扩展 `AgentRuntimeUsagePayload.reasoningOutputTokens`

建议扩展 `AgentRuntimeUsagePayload`：

```ts
reasoningOutputTokens?: number
```

这个字段对 Claude 不产生破坏，validator 只需允许可选数字。

### 22.6 Fixture 设计

`codex-event-adapter.test.ts` 至少准备这些 fixtures：

- `agent-message-stream.jsonl`：两个 `item.updated` 追加文本，一个 completed。
- `command-success.jsonl`：command in_progress、多次 output、exit 0。
- `command-failed.jsonl`：exit non-zero。
- `file-change.jsonl`：add/update/delete 三类 changes。
- `mcp-tool-call.jsonl`：completed 和 failed 各一个。
- `todo-list.jsonl`：todo 状态更新。
- `turn-failed.jsonl`：有非 fatal item error，最终 turn.failed。
- `abort-after-completed-race.jsonl`：用于 Orchestrator 测试 stop 优先级。

fixtures 应存放在：

```text
apps/electron/src/main/lib/agent-runtimes/__fixtures__/codex-events/
```

## 23. CodexAgentRuntime 执行流程

### 23.1 start/resume 流程

Codex runtime 的 `run()` 建议结构：

```ts
async *run(input: CodingAgentRunInput): AsyncIterable<AgentStreamEnvelope> {
  yield runStarted(...)

  const channel = resolveAgentCodexChannel(settings)
  const envBase = await buildCodexEnv(...)
  const auth = resolveCodexAuth(channel, envBase)
  const guard = await createCodexExecutionGuard(...)

  try {
    const codex = createCodexClient({
      codexPathOverride: resolveCodexCliPath(),
      apiKey: channel.apiKey,
      baseUrl: channel.baseUrl,
      env: guard.env,
      config: buildCodexConfig(input),
    })

    const thread = input.resumeSessionId
      ? codex.resumeThread(input.resumeSessionId, buildThreadOptions(input))
      : codex.startThread(buildThreadOptions(input))

    const streamed = await thread.runStreamed(buildCodexInput(input), {
      signal: input.abortSignal,
    })

    for await (const event of streamed.events) {
      for (const envelope of adapter.accept(event)) {
        yield envelope
      }
    }

    yield adapter.completeIfNeeded(input.abortSignal)
  } finally {
    await guard.cleanup()
  }
}
```

`thread.id` 在 `thread.started` 前可能是 `null`，因此不能在 `startThread()` 后立即持久化；必须等待 `thread.started` 或 SDK 侧 id 变为非空。

### 23.2 Codex input 构建

Codex SDK `Input` 支持 string 或 `UserInput[]`。建议统一构造数组，便于混合图片：

```ts
function buildCodexInput(input: CodingAgentRunInput): Input {
  const items: UserInput[] = [{ type: 'text', text: input.prompt }]
  for (const attachment of input.attachments) {
    if (attachment.type === 'local_image' && attachment.path) {
      items.push({ type: 'local_image', path: attachment.path })
    }
    if (attachment.type === 'text' && attachment.text) {
      items.push({ type: 'text', text: attachment.text })
    }
  }
  return items
}
```

附件路径必须先走现有 attachment service 的安全校验，不允许 renderer 直接传任意绝对路径给 Codex。

### 23.3 Thread options 构建

推荐映射：

```ts
function buildThreadOptions(input: CodingAgentRunInput, settings: AppSettings): ThreadOptions {
  const policy = resolveCodexPermissionPolicy(input.permissionMode, settings)
  return {
    model: settings.agentCodexModelId ?? input.model,
    workingDirectory: input.cwd,
    additionalDirectories: input.additionalDirectories,
    sandboxMode: policy.sandboxMode,
    approvalPolicy: policy.approvalPolicy,
    networkAccessEnabled: policy.networkAccessEnabled,
    webSearchMode: settings.agentCodexWebSearchMode ?? 'disabled',
    modelReasoningEffort: settings.agentCodexReasoningEffort ?? 'medium',
    skipGitRepoCheck: true,
  }
}
```

`skipGitRepoCheck: true` 只代表允许 CodeInsights 管理的 workspace 非 Git 根目录运行，不代表跳过 CodeInsights 自己的路径安全和 command guard。

### 23.4 错误分类

Codex runtime 应把错误映射为 typed error，便于 UI 给出恢复动作：

| code | 场景 | recoverable |
| --- | --- | --- |
| `codex_auth_missing` | 无 channel、无 API key、无 native auth | true |
| `codex_binary_missing` | binary 解析失败 | false |
| `codex_channel_invalid` | channel 删除、禁用或 provider 不支持 | true |
| `codex_run_aborted` | 用户停止 | true |
| `codex_turn_failed` | `turn.failed` | true |
| `codex_stream_error` | 顶层 `error` 或 generator throw | true |
| `codex_event_invalid` | SDK event shape 不符合预期 | false |

错误文案要中文，保留 Codex / SDK / binary 等专业名词。

## 24. 数据迁移与持久化细节

### 24.1 Session 迁移

不建议写一次性全量迁移脚本。读取时做 lazy migration 更稳：

```ts
function normalizeAgentSessionMeta(meta: AgentSessionMeta): AgentSessionMeta {
  if (meta.runtimeKind) return meta
  if (meta.sdkSessionId) {
    return {
      ...meta,
      runtimeKind: 'claude-code',
      runtimeSession: {
        kind: 'claude-code',
        externalSessionId: meta.sdkSessionId,
        createdAt: new Date(meta.createdAt).getTime(),
        updatedAt: new Date(meta.updatedAt).getTime(),
      },
    }
  }
  return { ...meta, runtimeKind: 'claude-code' }
}
```

写回时再持久化 normalized 字段，避免首次启动就批量改写用户全部会话文件。

### 24.2 Settings 迁移

`AgentSettingsInitializer` 当前已经会清理无效 `agentChannelId` 和 `pipelineCodexChannelId`。新增 Agent Codex 后需要独立清理：

- `agentCodexChannelId === null`：保留，代表 native auth。
- `agentCodexChannelId === undefined`：未配置，UI 展示自动模式。
- `agentCodexChannelId` 是字符串但 channel 不存在：写回 `undefined`，并 toast 或 console warn。
- channel provider 不是 `openai` / `custom`：写回 `undefined`。
- channel disabled：写回 `undefined` 或保留但 UI 标红，建议首版写回 `undefined`，降低失败率。

不要把 `pipelineCodexChannelId` 自动复制给 `agentCodexChannelId`。如果要做迁移提示，应在 UI 提醒用户可手动选择同一渠道。

### 24.3 Runtime events 存储

`agent-session-manager.ts` 已有 `appendAgentRuntimeEvents()` / `getAgentSessionRuntimeEvents()` 能力。Codex 会话应把 runtime events 作为历史主数据：

- live stream：Orchestrator 发送 envelope 给 renderer，同时 append JSONL。
- reload history：`getAgentSessionRuntimeEvents(sessionId)`。
- Claude legacy：继续读取 SDKMessage，runtime events 作为 shadow replay。
- Codex：不写伪造 SDKMessage，只写用户输入记录和 runtime events。

如果需要用户消息历史展示，建议给 runtime events 增加：

```ts
{ type: 'user_message'; messageId: string; contentBlocks: unknown[] }
```

若首版不扩展事件类型，也必须继续把用户消息写入现有 `AgentMessage` JSONL，让 transcript renderer 能把用户输入和 runtime assistant events 合并。

### 24.4 外部 session id 命名

Codex thread id 不应叫 `sdkSessionId`。推荐 UI 和内部日志统一叫：

- `runtimeSession.externalSessionId`
- 展示标签：`Codex thread`
- 兼容事件：`sdk_session` 只作为 v1 runtime events 的过渡事件名。

后续做 v2 event schema 时再把 `sdk_session` 正式替换为 `runtime_session`。

## 25. Renderer 与 UX 细节

### 25.1 设置页

`AgentSettings.tsx` 建议增加一个“Agent Runtime”小节：

- Segmented control：`Claude Code` / `Codex`
- Claude Code 选中时显示现有 Anthropic Agent 渠道、模型、thinking、effort。
- Codex 选中时显示：
  - 认证来源：`本机 Codex auth` / `OpenAI 或 Custom 渠道`
  - 渠道选择：只列出 enabled 且 provider 为 `openai` / `custom` 的 channel。
  - 模型输入或下拉：默认读取 channel enabled model；允许手填。
  - Reasoning effort。
  - Web search：disabled/cached/live。
  - Network access：开关，默认关闭。

UI 文案要明确：Codex 权限按 sandbox/approval 策略生效，不等同 Claude 的逐工具审批。

### 25.2 Header 与会话列表

Agent header 应显示当前 session runtime：

- 新会话未绑定时显示全局默认 runtime。
- 已绑定 session 显示 session runtime，且设置切换不会改变它。
- Codex 会话标题旁可显示 `Codex` badge。
- Claude legacy 会话不强制展示 “legacy”，只显示 `Claude Code`。

会话列表不需要大改，但筛选或搜索可以后续支持 runtime 维度。

### 25.3 Runtime transcript renderer

Codex 会话历史建议新增 `RuntimeTranscript`：

```text
runtime events + AgentMessage(user)
  -> normalize transcript blocks
  -> AgentMessages 复用 Markdown / ToolActivityItem
```

标准 block：

```ts
interface RuntimeTranscriptBlock {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  createdAt: string
  text?: string
  tool?: {
    name: string
    status: 'running' | 'success' | 'error' | 'denied' | 'stopped'
    inputSummary?: string
    outputSummary?: string
  }
  metadata?: Record<string, unknown>
}
```

不要在 `AgentMessages` 里直接 switch 全部 Codex event 类型。先在 selector/helper 中归一化，组件只渲染 transcript block。

### 25.4 不支持能力的 UI 处理

Codex 首版能力差异必须可见：

- Rewind：隐藏或禁用，tooltip “Codex runtime 首版暂不支持文件回退”。
- Fork：若未验证 Codex CLI fork，禁用。
- Queue message：运行中发送时改为“排队到下一轮”或直接禁用输入，首版建议禁用。
- Soft interrupt：不展示。
- Per-tool permission：不展示 PermissionBanner；显示 sandbox policy badge。

不要让 Codex 会话出现 Claude 专用 AskUser/ExitPlanMode UI，除非 Codex 事件真的提供等价请求。

## 26. 权限、Sandbox 与安全边界细化

### 26.1 策略函数

建议把策略函数单独测试：

```ts
export interface ResolvedCodexPermissionPolicy {
  sandboxMode: 'read-only' | 'workspace-write' | 'danger-full-access'
  approvalPolicy: 'never' | 'on-request' | 'on-failure' | 'untrusted'
  networkAccessEnabled: boolean
  webSearchMode: 'disabled' | 'cached' | 'live'
  commandGuardPolicy: CodexCommandGuardPolicy
  warning?: string
}
```

默认映射：

- `plan`：`read-only`、`never`、network false、web search disabled。
- `auto`：`workspace-write`、`never`、network false、web search 按设置。
- `bypassPermissions`：`workspace-write`、`never`、network 按设置。`danger-full-access` 必须有单独高级开关，不跟随 bypass 默认开启。

### 26.2 审批策略边界

当前 SDK 虽支持 `approvalPolicy` 字段，但 TypeScript 类型没有暴露 approval request 响应通道。因此：

- 不使用 `on-request` 来假装接入 CodeInsights PermissionBanner。
- `approvalPolicy` 首版固定 `never` 或仅在实验 flag 下验证。
- 如果 Codex CLI JSONL 后续出现 approval event，新增单独调研文档，不在当前实现里预留半成品 UI。

### 26.3 工作区路径安全

Codex `workingDirectory`、`additionalDirectories` 都必须来自 workspace manager 的已校验路径：

- `workingDirectory` 使用 materialized session cwd。
- `additionalDirectories` 使用 workspace attached directories。
- 拒绝 renderer 直接注入路径。
- existing path 的 symlink 检查复用 runtime materializer 经验。
- session cwd 不存在时由 materializer 创建。

### 26.4 Git 副作用

Agent 模式默认允许本地文件修改，但远端副作用仍要保守：

- 默认阻断交互式凭证请求。
- 默认阻断 `gh` / `hub` 远端操作。
- 默认通过 `remote.*.pushurl` 方式让 push 失败。
- 不默认阻断 `git diff` / `git status` / `git log`。
- `plan` 模式通过 read-only sandbox 和 guard 双重保证不写入。

## 27. 测试与验证细节

### 27.1 单元测试新增清单

建议新增或扩展：

- `packages/shared/src/agent/runtime-events.test.ts`
  - `codex_sdk` / `codex_cli` source validator。
  - `run_started.runtimeKind` 可选字段。
  - `reasoningOutputTokens`。
- `apps/electron/src/main/lib/codex-runtime/codex-auth.test.ts`
  - channel API key 优先。
  - native `CODEX_HOME/auth.json`。
  - `CODEX_API_KEY` fallback。
  - 无凭证 fail-fast。
- `apps/electron/src/main/lib/codex-runtime/codex-env.test.ts`
  - env 替换语义下保留 PATH。
  - 删除 `ANTHROPIC_*`、危险 Git env、GitHub token。
  - proxy 注入。
- `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`
  - 全 item 类型 fixture。
  - delta 不重复。
  - terminal 去重。
- `apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`
  - start thread。
  - resume thread。
  - abort before stream。
  - abort during stream。
  - stream throw。
- `apps/electron/src/main/lib/agent-orchestrator.test.ts`
  - runtime routing。
  - 运行中禁止切换 runtime。
  - stop 后不落 completed。
- Renderer 测试：
  - runtime transcript selector。
  - Codex settings invalid channel cleanup。
  - unsupported capability UI。

### 27.2 Mock Codex SDK

不要在单测里 spawn 真实 Codex。用注入式 factory：

```ts
export interface CodexClientFactory {
  create(options: CodexOptions): CodexClientLike
}

export interface CodexClientLike {
  startThread(options?: ThreadOptions): CodexThreadLike
  resumeThread(id: string, options?: ThreadOptions): CodexThreadLike
}

export interface CodexThreadLike {
  readonly id: string | null
  runStreamed(input: Input, options?: TurnOptions): Promise<{ events: AsyncGenerator<ThreadEvent> }>
}
```

真实实现动态 import `@openai/codex-sdk`，测试实现从数组生成 async generator。

### 27.3 集成验证

真实 Codex smoke test 不进入默认 CI，原因是需要凭证、native auth、网络和 packaged binary。Phase 7 已新增独立脚本，默认使用隔离 `CODEINSIGHTS_CONFIG_DIR`、隔离 `CODEX_HOME` 和临时 workspace：

```bash
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only binary
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only native
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only readonly
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only workspace-write
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only resume
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only web-search
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only stop
bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only mcp
bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui
```

已验证记录：

- native auth 新建 Codex 会话，返回 `codeinsights-codex-native-ok`。
- read-only plan 保持目标文件不变。
- workspace-write 只修改目标临时文件。
- resume 同一 Codex thread 能记住首轮口令。
- web-search 返回 npm latest `@openai/codex` 版本记录。
- stop 长任务最终状态为 `run_stopped`。
- 重启 packaged Electron 后，fixture-based Codex 历史能回放到真实 UI。
- MCP config injection 从真实 helper 输出派生 CLI override，`codex mcp list --json` 可识别 stdio/http 配置。

暂缓验证：

- channel API key 新建 Codex 会话仍未走真实 API key 成功路径；除非用户重新明确要求，不主动补跑 `CODEX_SMOKE_API_KEY`，不读取 ambient `OPENAI_API_KEY`。

仍建议后续人工检查：

- 删除 channel 后，设置页能清理无效 `agentCodexChannelId`。
- macOS x64 / Windows x64 runner 上打包后 Codex binary 路径可解析。

### 27.4 文档级验证

每次更新本方案后至少运行：

```bash
python3 - <<'PY'
from pathlib import Path
path = Path('docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md')
text = path.read_text()
fence = '`' * 3
fence_lines = [line for line in text.splitlines() if line.startswith(fence)]
assert len(fence_lines) % 2 == 0, 'code fence not balanced'
PY

git diff --check -- docs/codex-support tasks/todo.md
```

## 28. 回滚、Feature Flag 与发布策略

### 28.1 Feature flags

建议至少保留三个开关：

| Flag | 默认 | 作用 |
| --- | --- | --- |
| `CODEINSIGHTS_AGENT_CODEX_RUNTIME` | `0` | 是否允许选择 Codex Agent runtime |
| `CODEINSIGHTS_AGENT_RUNTIME_EVENTS_HISTORY` | `0` 到 Phase 6 后改 `1` | 是否启用 runtime events 历史渲染 |
| `CODEINSIGHTS_AGENT_CODEX_DANGER_FULL_ACCESS` | `0` | 是否允许 Codex 使用 danger-full-access |

开发阶段 UI 可以隐藏 Codex runtime，只有 flag 开启时显示。这样主分支可以合并底层抽象而不向普通用户暴露半成品。

### 28.2 回滚路径

如果 Codex Agent 出现严重问题：

1. 关闭 `CODEINSIGHTS_AGENT_CODEX_RUNTIME`。
2. 新会话默认回到 Claude Code。
3. 已有 Codex session 保留在列表中，但发送按钮禁用并提示“当前版本暂时禁用 Codex runtime”。
4. 不删除 runtime events 和 `runtimeSession`。
5. Claude session 不受影响，因为 Claude runner 包装路径保持独立。

### 28.3 发布前检查

发布前必须确认：

- `electron-builder.yml` 包含 `@openai/codex`、`@openai/codex-sdk` 和平台 binary 包。
- esbuild external 不遗漏 `@openai/codex-sdk` / `@openai/codex`。
- macOS arm64 已本地验证；macOS x64 和 Windows x64 需要分别在对应 runner 安装 optional platform package 后验证。
- Linux platform packages 已列入打包配置，但 Linux packaged binary 是否进入首版支持矩阵仍未定。
- Codex runtime 关闭 flag 时，UI 不显示不可用入口。
- settings 中的 `agentCodexChannelId` 不影响 Pipeline Codex。
- native auth smoke 隔离 `CODEX_HOME` 时必须同步复制同源 `config.toml`，否则会丢失用户配置的中转 provider。
- MCP secret 不得出现在 SDK `config`、CLI argv、日志或 smoke summary 中。

## 29. 分阶段 Definition of Done

### Phase 1 DoD

- shared 类型通过 validator 测试。
- settings 读写兼容旧文件。
- 旧 Claude session 正常打开。
- 没有任何 Codex UI 暴露。

### Phase 2 DoD

- Pipeline Codex runner 改用公共 core 后测试全绿。
- 公共 core 单测覆盖 auth/env/binary/guard。
- Pipeline 错误文案仍是 Pipeline 语义，Agent 文案未混入 Pipeline。

### Phase 3 DoD

- Codex event adapter fixture 覆盖所有当前 SDK item 类型。
- delta 不重复。
- terminal 去重。
- usage 映射完整。

### Phase 4 DoD

- Mock Codex runtime 可以 start/resume/abort/fail。
- `thread.started` 后能持久化 `runtimeSession.externalSessionId`。
- 不支持能力返回结构化 unsupported。
- 不写伪造 Claude SDKMessage。

### Phase 5 DoD

- Orchestrator 根据 session/settings 正确 route。
- 运行中禁止切换 runtime。
- stop 竞态测试通过。
- Claude 默认路径测试不回归。

### Phase 6 DoD

- Codex settings UI 可配置 runtime/auth/model。
- Codex 会话历史重启后能通过 runtime events 回放。
- Rewind/fork/queue/permission 差异有明确 UI。
- Agent header 能显示 session runtime。

### Phase 7 DoD

- native auth 模式真实验证通过；channel API key 模式暂缓，不再作为 Phase 8 阻塞项。
- read-only plan 模式不写文件。
- workspace-write 能修改 workspace 文件。
- stop、resume、history reload、packaged binary smoke 均通过。
- 方案文档更新实际实现差异。

## 30. 需要用户确认的产品决策

实现前建议确认这些决策，避免后续返工：

1. Codex 首版是否接受无 per-tool permission UI，仅提供 sandbox 级权限说明。
2. Codex 首版是否默认隐藏 rewind/fork/soft interrupt/queue message。
3. Agent Codex 默认认证来源是否设为本机 Codex auth，而不是复用 Pipeline Codex channel。
4. `bypassPermissions` 下是否仍默认禁止 `danger-full-access`，只通过高级开关启用。
5. 是否接受 Codex 会话历史优先基于 runtime events，而不是强行转换成 Claude SDKMessage。

推荐答案：

- 接受首版权限不等价，但 UI 必须明确。
- 首版隐藏或禁用不支持能力。
- Agent Codex 与 Pipeline Codex 设置分离。
- `danger-full-access` 必须单独开关。
- Codex 历史以 runtime events 为主数据。
