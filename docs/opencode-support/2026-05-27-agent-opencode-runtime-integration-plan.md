# Agent 模式 opencode Runtime 接入开发方案

状态：设计方案
日期：2026-05-27
目标目录：`docs/opencode-support/`
适用范围：CodeInsights Electron Agent 模式

## 0. 结论摘要

本方案建议把 opencode 作为第三个 `CodingAgentRuntime` 接入 Agent 模式，和当前 `claude-code` / `codex` 处在同一层级。CodeInsights 不重新实现 opencode 的工具循环、MCP 调度、权限判断、模型推理和 session 管理；CodeInsights 只负责桌面产品层：会话索引、工作区隔离、配置生成、凭证来源、事件标准化、权限 UI、停止/恢复、审计和历史回放。

首选技术路径：

- 使用 `opencode-ai` 提供的完整 opencode CLI/native runtime，启动受 CodeInsights 管理的本地 `opencode serve`。
- 使用 `@opencode-ai/sdk` 的 `createOpencodeClient()` 或生成客户端访问本地 server 的 OpenAPI/SSE 接口。
- Agent run 使用 `/session`、`/session/:id/prompt_async`、`/event`、`/session/:id/abort`、`/session/:id/permissions/:permissionID` 等 server API，而不是把 `opencode run --format json` 作为主路径。
- `opencode run --format json` 仅作为 CLI smoke、故障隔离和早期 fallback；它不应成为长期主实现，因为 server API 能覆盖 permission response、session status、MCP status、abort、message parts 和 diff 等更完整能力。
- npm 调研显示 2026-05-27 最新稳定版本为 `@opencode-ai/sdk@1.15.11` 与 `opencode-ai@1.15.11`；CLI 包不是 `opencode`，也不是 `@opencode-ai/cli`。

首版必须保持 feature flag：

```text
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1
```

未开启时，现有 Claude Code / Codex 行为不变。

## 1. 背景与目标

用户目标可以概括为：CodeInsights 要成为多种 Coding Agent 产品的代理层，而不是单独绑定 Claude Code、Codex 或 opencode。Agent 模式接入 opencode 的价值不在于增加一个模型 Provider，而在于接入完整 runtime：

- opencode 的 built-in tools、custom tools、MCP、agents、permissions、provider/model 支持由 opencode 原生维护。
- opencode 升级带来的新工具、推理策略、MCP/OAuth 能力、agent 能力，CodeInsights 只要保持 runtime contract 兼容即可自动受益。
- CodeInsights 的差异化在本地桌面体验、统一会话层、权限交互、工作区配置、审计、跨 runtime UI 和未来外部渠道接入。

因此本次接入的核心不是“调用一个 CLI 命令”，而是把当前已经用于 Codex 的 runtime registry 进一步抽象成多 Coding Agent runtime 的稳定扩展点。

## 2. 非目标

- 不重写 opencode 的 tool execution、MCP client、permission matcher、snapshot、provider adapter、LLM request pipeline。
- 不把 opencode 降级为普通 `Channel` / chat provider。
- 不把 opencode server 暴露到局域网；默认只绑定 `127.0.0.1`。
- 不把 CodeInsights 中的 MCP secret、channel API key 或 auth token 明文写入长期磁盘文件。
- 不在未经用户允许的情况下同步根 `README.md` / `AGENTS.md`。
- 首版不承诺 opencode 与 Claude Code 的所有交互能力完全等价；能力差异通过 `CodingAgentRuntimeCapabilities` 暴露。

## 3. 当前项目事实

### 3.1 已有 runtime 抽象

当前代码中已经存在：

- `packages/shared/src/types/agent.ts`
  - `CodingAgentRuntimeKind = 'claude-code' | 'codex'`
  - `AgentRuntimeSessionRef`
  - `AgentSessionMeta.runtimeKind`
- `packages/shared/src/agent/runtime-events.ts`
  - `AgentStreamEnvelope`
  - `AgentRuntimeEvent`
  - `AgentEventSource`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts`
  - `CodingAgentRuntime`
  - `CodingAgentRuntimeCapabilities`
  - `CodingAgentRuntimeRunInput`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`
  - runtime 注册与 session/settings 选择逻辑
- `apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`
  - `CodexAgentRuntime` 真实接入
- `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`
  - runtime 原生事件到 `AgentRuntimeEvent` 的映射
- `apps/electron/src/main/lib/agent-runtime-event-log.ts`
  - runtime envelope JSONL 持久化与回放
- `apps/electron/src/main/lib/agent-orchestrator.ts`
  - 根据 runtime selection 路由到 Claude legacy path 或 Codex runtime

这说明 opencode 不需要从零设计 product-layer，只需要扩展现有 runtime 抽象。

### 3.2 Codex 接入可复用经验

Codex runtime 已验证的工程模式：

- runtime kind 首次运行后绑定到 session，避免用户后来改 settings 污染老会话。
- `externalSessionId` 持久化原生 thread/session id。
- runtime events 是 Codex 历史回放主数据源，SDKMessage 只作为兼容展示。
- binary/auth/env/MCP/Git guard 独立封装在 `codex-runtime/`。
- MCP secret 不进入 SDK `config` argv，只通过子进程 env 间接注入。
- 对 workspace-write runtime 做 Git 命令前置防护和事后 refs/index 校验。
- feature flag 控制 rollout。

opencode 应复用这些原则，不应复制 Pipeline runner 或旧 Claude SDKMessage 语义。

### 3.3 当前硬编码点

opencode 接入前必须扩展的硬编码点：

- `CodingAgentRuntimeKind` 需要加入 `'opencode'`。
- `AgentEventSource` 需要加入 `'opencode_server' | 'opencode_cli'`。
- `settings-service.ts` 中 `AGENT_RUNTIME_KINDS` 目前只有 `claude-code` / `codex`。
- Renderer Agent Runtime 设置目前只展示 Codex runtime 的专用配置。
- `resolveAgentRuntimeSelection()` 目前只理解 Codex 的 `channelId/model`。
- `isAgentCodexRuntimeFeatureEnabled()` 属于 Codex 专用 helper，新增 runtime 后应抽象成 runtime feature flag helper。

建议首版做最小扩展，避免一次性重构为复杂 profile 系统；但文档和类型要预留未来更多 runtime。

## 4. opencode 调研结论

### 4.1 CLI 与 headless 模式

官方 CLI 默认启动 TUI；`opencode run` 支持非交互运行，适合脚本自动化。`run` 重要参数包括：

- `--session` / `--continue` / `--fork`：恢复或分叉 session。
- `--model`：使用 `provider/model` 形式指定模型。
- `--agent`：指定 opencode agent。
- `--file`：附加文件。
- `--format json`：输出 raw JSON events。
- `--attach`：连接已有 `opencode serve`。
- `--dir`：指定运行目录。
- `--variant`：provider-specific reasoning effort。
- `--thinking`：显示 thinking blocks。
- `--dangerously-skip-permissions`：自动批准未显式 deny 的权限请求，首版不应默认使用。

CLI 适合 smoke 和 fallback，但主接入不应依赖一次性 `run`，因为 CodeInsights 需要在 UI 内响应 permission、stop、恢复、MCP 状态和持续事件。

### 4.2 Server API

`opencode serve` 会启动 headless HTTP server，默认监听 `127.0.0.1:4096`，并提供 OpenAPI 3.1 spec 和 SSE events。

关键能力：

- `GET /global/health`：健康检查和版本。
- `GET /event`：server event SSE，首个事件为 `server.connected`。
- `GET /global/event`：global event SSE。
- `POST /session`：创建 session。
- `POST /session/:id/prompt_async`：异步发送 message。
- `POST /session/:id/message`：发送 message 并等待结果。
- `GET /session/:id/message`：读取消息和 parts。
- `POST /session/:id/abort`：中止运行中 session。
- `POST /session/:id/permissions/:permissionID`：响应 permission，body response 为 `once | always | reject`。
- `GET /mcp` / `POST /mcp`：查看或动态添加 MCP。
- `GET /agent`：列出 agents。
- `GET /config/providers` / `GET /provider`：获取 provider/model 信息。

Server 支持 `OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME` 做 HTTP Basic Auth。CodeInsights 管理的 server 必须启用随机 password，并只绑定 `127.0.0.1`。

### 4.3 JS/TS SDK

`@opencode-ai/sdk` 是基于 server OpenAPI 生成的类型安全客户端。

官方提供：

- `createOpencode()`：启动 server + 创建 client。
- `createOpencodeClient({ baseUrl })`：连接已有 server。
- `createOpencodeServer()`：spawn `opencode serve`。

工程判断：

- CodeInsights 首版应使用 SDK 的 client 类型和 API。
- 不建议直接使用 SDK 的 `createOpencodeServer()` 作为最终 server manager，因为当前 SDK server options 没有暴露 `cwd`、完整 `env`、binary path override 和 Electron packaged path 解析；CodeInsights 需要自己管理子进程环境、cwd、auth、日志脱敏和 binary。
- 可以复用 `createOpencodeClient()`，server 进程由 `OpencodeServerManager` 自行 spawn。

### 4.4 配置系统

opencode 支持 JSON / JSONC 配置，主要来源按优先级合并：

1. remote config
2. global config：`~/.config/opencode/opencode.json`
3. custom config：`OPENCODE_CONFIG`
4. project config：项目根 `opencode.json`
5. `.opencode` 目录：agents / commands / modes / plugins 等运行资产
6. custom config directory：`OPENCODE_CONFIG_DIR`
7. inline config：`OPENCODE_CONFIG_CONTENT`
8. managed config
9. macOS managed preferences

关键含义：

- 配置是合并，不是替换。
- CodeInsights 应生成可审计的 secretless config file，并用 `OPENCODE_CONFIG` 指向它。
- CodeInsights 生成的 agents / commands / modes / plugins 等运行资产应放入私有目录，并用 `OPENCODE_CONFIG_DIR` 指向它，避免污染用户项目 `.opencode/`。
- CodeInsights 的强制安全策略应通过 `OPENCODE_CONFIG_CONTENT` 注入到最高普通优先级，防止项目 config 放宽 permission、server、share 等边界；系统级 managed settings 仍可能覆盖它，smoke 需要检测并报告。
- `OPENCODE_CONFIG_CONTENT` 不得包含 secret。

### 4.5 Provider 与认证

opencode 使用 AI SDK 和 Models.dev，支持大量 Provider 与本地模型。

认证来源：

- TUI `/connect` 或 CLI `opencode auth login` 写入 `~/.local/share/opencode/auth.json`。
- Provider env vars。
- 项目 `.env`。
- config 中的 provider options，例如 `baseURL`。

CodeInsights 需要支持两种来源：

- native auth：复用用户本机 opencode 登录状态。
- channel auth：从 CodeInsights `Channel` 解密 API key，注入 opencode 子进程 env，并生成不含 secret 的 provider config。

channel auth 需要在 Phase 1 spike 中验证 provider config 的最小安全写法，尤其是 Custom/OpenAI-compatible endpoint 的 `provider` 配置、`baseURL` 与 env var 绑定方式。

### 4.6 MCP

opencode 原生支持 local 和 remote MCP：

- local：`mcp.{name}.type = "local"`，`command` 为数组，支持 `environment` 和 `timeout`。
- remote：`type = "remote"`，`url`、`headers`、`oauth`、`timeout`。
- remote OAuth 可自动处理，token 存储在 `~/.local/share/opencode/mcp-auth.json`。
- Server API 可 `GET /mcp` 查看状态，`POST /mcp` 动态添加 MCP。

安全要求：

- remote headers 应优先使用 `{env:VAR}` 形式，secret 只放 env。
- local MCP 的 `environment` 是否支持 `{env:VAR}` 需要实现前用真实 opencode 验证；未验证前不得把 secret 写入长期 config。
- 如果 local MCP secret 只能通过 config value 传递，首版应改用 0600 临时 config 或跳过该 server 并记录 `skipped`，不能明文落盘到 workspace runtime。

### 4.7 Permissions

opencode 使用 `permission` config 控制工具行为，rule 结果为：

- `allow`
- `ask`
- `deny`

可配置项包括：

- `read`
- `edit`
- `glob`
- `grep`
- `bash`
- `task`
- `skill`
- `lsp`
- `question`
- `webfetch`
- `websearch`
- `external_directory`
- `doom_loop`

默认行为偏 permissive：多数 permission 默认 allow，`doom_loop` 和 `external_directory` 默认 ask，`.env` 文件默认 deny。

CodeInsights 不能依赖 opencode 默认权限，应根据 `CodeInsightsPermissionMode` 显式生成 permission config，并通过 server permission API 把 ask 接到 CodeInsights UI。

## 5. 目标架构

### 5.1 总体数据流

```text
Renderer Agent UI
  -> preload / AGENT_IPC_CHANNELS.SEND_MESSAGE
  -> AgentOrchestrator
  -> CodingAgentRuntimeRegistry.resolve()
  -> OpencodeAgentRuntime
  -> OpencodeServerManager
  -> opencode serve (127.0.0.1 + random port + Basic Auth + generated config)
  -> @opencode-ai/sdk createOpencodeClient()
  -> /session + /prompt_async + /event + /permissions + /abort
  -> OpencodeEventAdapter
  -> AgentStreamEnvelope JSONL + Renderer transcript
```

### 5.2 新增模块建议

```text
apps/electron/src/main/lib/opencode-runtime/
├── opencode-binary.ts
├── opencode-env.ts
├── opencode-auth.ts
├── opencode-config.ts
├── opencode-mcp-config.ts
├── opencode-server-manager.ts
├── opencode-sdk-client.ts
└── index.ts

apps/electron/src/main/lib/agent-runtimes/
├── opencode-runtime.ts
├── opencode-event-adapter.ts
└── opencode-permission-policy.ts
```

职责：

- `opencode-binary.ts`：解析 `opencode-ai` 与平台 optional package 的 binary 路径，处理 `.asar.unpacked`。
- `opencode-env.ts`：构建 allowlist env，保留 PATH/HOME/SHELL 等必要变量，注入 CodeInsights channel secret env，清理不应泄漏的 token。
- `opencode-auth.ts`：解析 native auth、channel auth 和 smoke auth 状态。
- `opencode-config.ts`：生成 secretless `opencode.jsonc` / inline policy config，并计算 hash。
- `opencode-mcp-config.ts`：CodeInsights workspace MCP -> opencode `mcp` config。
- `opencode-server-manager.ts`：按 workspace/runtime hash 管理 `opencode serve` 进程、健康检查、Basic Auth、idle close、异常重启。
- `opencode-sdk-client.ts`：封装 `@opencode-ai/sdk` client 创建、Basic Auth fetch、错误分类。
- `opencode-runtime.ts`：实现 `CodingAgentRuntime`。
- `opencode-event-adapter.ts`：opencode SSE event / Message Part -> `AgentRuntimeEvent`。
- `opencode-permission-policy.ts`：CodeInsights permission mode -> opencode `permission` config。

### 5.3 Runtime capabilities

首版能力建议：

```ts
const OPENCODE_RUNTIME_CAPABILITIES = {
  runtimeKind: 'opencode',
  supportsStreamEvents: true,
  supportsResumeThread: true,
  supportsAbort: true,
  supportsQueueMessage: false,
  supportsSetPermissionMode: false,
  supportsPerToolPermission: true,
}
```

说明：

- `supportsResumeThread`：通过 opencode session id 恢复。
- `supportsAbort`：调用 `/session/:id/abort`，必要时 kill server 子进程。
- `supportsPerToolPermission`：opencode 有 permission API，但不是 Claude `canUseTool` callback；它是 server event + response API。CodeInsights 可把 `permission.updated` 映射成现有 PermissionBanner。
- `supportsQueueMessage`：首版先不支持运行中追加，避免与 opencode session status 竞争。
- `supportsSetPermissionMode`：首版不支持运行中切换；必须下个 run 生效，避免污染运行中 permission policy。

## 6. 类型与设置契约

### 6.1 共享类型

扩展：

```ts
export type CodingAgentRuntimeKind = 'claude-code' | 'codex' | 'opencode'

export type AgentEventSource =
  | 'claude_sdk'
  | 'codex_sdk'
  | 'codex_cli'
  | 'opencode_server'
  | 'opencode_cli'
  | 'codeinsights'
  | 'permission_service'
  | 'ask_user_service'
  | 'runtime_service'
  | 'event_log'
```

`AgentRuntimeSessionRef.externalSessionId` 对 opencode 表示 `session.id`。

建议扩展 runtime session metadata：

```ts
export interface AgentRuntimeSessionRef {
  kind: CodingAgentRuntimeKind
  externalSessionId: string
  channelId?: string | null
  model?: string
  agent?: string
  runtimeConfigHash?: string
  createdAt: number
  updatedAt: number
}
```

如果要保持最小改动，`agent` / `runtimeConfigHash` 可先不进 shared 类型，放在 `AgentRuntimeManifest` 或 runtime event log metadata；但方案上需要保留位置。

### 6.2 AppSettings

首版建议新增字段：

```ts
interface AppSettings {
  agentRuntimeKind?: 'claude-code' | 'codex' | 'opencode'
  agentOpencodeChannelId?: string | null
  agentOpencodeModelId?: string
  agentOpencodeAgentName?: string
  agentOpencodeUseNativeAuth?: boolean
  agentOpencodeAutoupdate?: false | 'notify'
  agentOpencodeSnapshotEnabled?: boolean
}
```

解释：

- `agentOpencodeChannelId = null`：显式使用 native opencode auth。
- `agentOpencodeModelId`：采用 opencode 原生 `provider/model` 格式，例如 `anthropic/claude-sonnet-4-5`、`openai/gpt-5.1-codex`。
- `agentOpencodeAgentName`：默认 `build`，plan 模式可自动切到 `plan`。
- `agentOpencodeAutoupdate`：packaged app 内建议默认 `false`，避免 runtime 自更新改变 Electron 打包内 binary。
- `agentOpencodeSnapshotEnabled`：默认沿用 opencode；如果后续与 CodeInsights Git guard 冲突再显式关闭。

中长期建议将 Codex/opencode 设置收敛成：

```ts
interface AgentRuntimeProfile {
  kind: CodingAgentRuntimeKind
  enabled: boolean
  channelId?: string | null
  model?: string
  options: Record<string, unknown>
}
```

首版不强制做该重构，避免扩大风险。

## 7. opencode Server 管理

### 7.1 为什么不直接用 `createOpencodeServer()`

官方 SDK 的 `createOpencodeServer()` 足够用于普通脚本，但 CodeInsights 需要更多控制：

- 指定 `cwd` 为当前 Agent workspace/session working directory。
- 指定 bundled opencode binary 路径，而不是依赖系统 PATH。
- 使用 allowlist env 和 secret 注入。
- 设置 `OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT`。
- 启用随机 Basic Auth。
- 解析 stdout、脱敏 stderr、健康检查。
- 管理 idle timeout、异常退出、Electron packaged path。
- 对 Git guard env / PATH shim 做强约束。

因此应自行实现 `OpencodeServerManager`，只复用 SDK client。

### 7.2 Server key

推荐按以下 key 复用 server，减少 MCP cold start：

```ts
interface OpencodeServerKey {
  workspaceId: string
  workingDirectory: string
  authSourceHash: string
  runtimeConfigHash: string
}
```

同一个 key 下可以复用 server；当 model、permission、MCP、provider、cwd、auth 变化时重启。

### 7.3 启动参数

```bash
opencode serve --hostname 127.0.0.1 --port <free-port>
```

环境：

```text
OPENCODE_SERVER_USERNAME=opencode
OPENCODE_SERVER_PASSWORD=<random-32-byte-url-safe>
OPENCODE_CONFIG=<generated-secretless-config-path>
OPENCODE_CONFIG_DIR=<generated-opencode-config-dir>
OPENCODE_CONFIG_CONTENT=<secretless-high-priority-policy-json>
```

安全要求：

- `hostname` 固定 `127.0.0.1`。
- `cors` 默认为空。
- server stdout/stderr 日志必须脱敏。
- password 只保存在内存。
- server 退出时清理 0600 临时文件和 PATH shim。

## 8. 配置生成策略

### 8.1 目录布局

```text
~/.codeinsights/
  agent-workspaces/
    {workspace-slug}/
      runtime/
        opencode/
          opencode.jsonc
          agents/
          commands/
          plugins/
          skills/
          tools/
          runtime-manifest.json
      sessions/
        {session-id}/
          cwd/
          attachments/
```

`opencode.jsonc` 不包含 secret，可长期保留并参与 hash。

### 8.2 生成的基础 config

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "provider/model",
  "small_model": "provider/small-model",
  "autoupdate": false,
  "share": "disabled",
  "server": {
    "hostname": "127.0.0.1",
    "cors": []
  },
  "permission": {
    "*": "ask"
  },
  "mcp": {},
  "agent": {}
}
```

### 8.3 高优先级 inline policy

`OPENCODE_CONFIG_CONTENT` 只放不含 secret 的强制策略：

```json
{
  "share": "disabled",
  "autoupdate": false,
  "permission": {
    "doom_loop": "deny"
  },
  "server": {
    "hostname": "127.0.0.1",
    "cors": []
  }
}
```

不要把 API key、HTTP header token、MCP token 放进 `OPENCODE_CONFIG_CONTENT`。

## 9. Auth 与 Provider 映射

### 9.1 Native auth

native 模式复用 opencode 自己的登录状态：

- `~/.local/share/opencode/auth.json`
- 环境变量
- 项目 `.env`

首版不复制 native auth 到 CodeInsights 私有目录，避免破坏用户现有 opencode 行为。真实 smoke 需要记录是否使用 native auth，并避免输出 auth 文件内容。

### 9.2 Channel auth

CodeInsights channel auth 流程：

1. 从 `channel-manager` 解密 API key。
2. 生成随机 env name，例如 `CODEINSIGHTS_OPENCODE_OPENAI_<hash>_API_KEY`。
3. 子进程 env 注入该变量。
4. opencode config 只引用 env name 或 provider env 配置。
5. 不把 secret 写入 `opencode.jsonc`、`OPENCODE_CONFIG_CONTENT`、命令行 argv 或日志。

Custom/OpenAI-compatible provider 的确切 config 需要 Phase 1 spike。候选形态：

```jsonc
{
  "provider": {
    "openai": {
      "options": {
        "baseURL": "https://example.com/v1"
      },
      "env": ["CODEINSIGHTS_OPENCODE_OPENAI_ABC_API_KEY"]
    }
  },
  "model": "openai/gpt-5.1-codex"
}
```

如果 opencode 对 Custom Provider 需要不同 schema，必须以 `https://opencode.ai/config.json` 和真实 server `/config/providers` 为准，不猜字段。

## 10. Permission 映射

### 10.1 推荐策略

| CodeInsights 模式 | opencode agent | opencode permission | 说明 |
| --- | --- | --- | --- |
| `plan` | `plan` | `edit: deny`, `bash: ask`, `webfetch/websearch: ask`, `external_directory: ask` | 计划与分析优先，禁止文件修改 |
| `auto` | `build` | `read/glob/grep: allow`, `edit/bash/task/skill/webfetch/websearch: ask`, `doom_loop: deny` | 默认安全交互 |
| `ask` | `build` | `*: ask`, `read/glob/grep: allow`, `doom_loop: deny` | 更保守 |
| `bypassPermissions` | `build` | `*: allow`, `doom_loop: deny` | 仍保留 CodeInsights Git guard，不等于无防护 |

`dangerously-skip-permissions` 首版不用于 server 主路径。只有用户显式选择 opencode 原生危险模式并经过 UI 警告后，才能允许等价能力。

### 10.2 Permission 事件

映射流程：

```text
opencode SSE permission.updated
  -> OpencodeEventAdapter
  -> AgentRuntimeEvent.permission_requested
  -> PermissionBanner
  -> 用户 allow / deny
  -> POST /session/:id/permissions/:permissionID
  -> AgentRuntimeEvent.permission_resolved
```

CodeInsights decision 到 opencode response：

| CodeInsights decision | opencode response |
| --- | --- |
| allow once | `once` |
| allow always/session | `always` |
| deny | `reject` |

首版不把 opencode `always` 写入 CodeInsights 长期规则；它只作用于当前 opencode session，避免不可见持久授权。

## 11. MCP 映射

### 11.1 stdio/local

CodeInsights:

```ts
{
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-everything'],
  env: { TOKEN: '...' }
}
```

opencode:

```jsonc
{
  "mcp": {
    "mcp_everything": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-everything"],
      "enabled": true,
      "environment": {}
    }
  }
}
```

Secret 处理规则：

- 非 secret env 可写入 secretless config。
- secret env 优先验证是否支持 `{env:VAR}` 间接引用。
- 如果不支持，使用 0600 临时 config 或 `POST /mcp` 动态注入；二者都必须在进程结束后清理。
- 无法安全注入时跳过 server，并在 UI / smoke summary 中显示 skip reason。

### 11.2 remote

remote headers 使用 env placeholder：

```jsonc
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:CODEINSIGHTS_OPENCODE_MCP_GITHUB_TOKEN}"
      },
      "enabled": true
    }
  }
}
```

### 11.3 OAuth MCP

opencode 能自动处理 remote MCP OAuth，并存储 token 到 `~/.local/share/opencode/mcp-auth.json`。首版只复用 native opencode OAuth 状态；CodeInsights 不代理 OAuth callback，除非后续单独设计。

## 12. Event Adapter

### 12.1 事件来源

主路径订阅：

- `/event` SSE
- 必要时补读 `/session/:id/message`
- 必要时补读 `/session/:id/todo`
- 必要时补读 `/session/:id/diff`

run 流程必须先订阅 SSE，再发送 `prompt_async`，避免错过早期 part。

### 12.2 映射表

| opencode event / part | CodeInsights runtime event |
| --- | --- |
| `session.created` | `sdk_session` |
| `message.updated` user | 可选，不作为 assistant 输出 |
| `message.part.updated` `text` + `delta` | `assistant_delta` |
| `message.part.updated` `text` completed | `assistant_message` |
| `message.part.updated` `reasoning` | `agent_task_progress` |
| `message.part.updated` `tool` pending/running | `tool_started` / `tool_progress` |
| `message.part.updated` `tool` completed/error | `tool_completed` |
| `message.part.updated` `patch` | `tool_started` / `tool_completed` (`PatchApply`) |
| `message.part.updated` `agent` / `subtask` | `agent_task_started/progress/completed` |
| `todo.updated` | `agent_task_*` |
| `permission.updated` | `permission_requested` |
| `permission.replied` | `permission_resolved` |
| `session.status` retry | `retry_scheduled` |
| `session.idle` | `run_completed` |
| `session.error` | `run_failed` |
| abort response / `MessageAbortedError` | `run_stopped` |

### 12.3 终态规则

- 同一 run 只能写入一个 terminal event。
- `session.idle` 只能在当前 run 的 prompt 已发送后作为完成。
- 如果 SSE 断开但 `/session/:id/message` 能补到完整 assistant message，应补发 message 后完成；否则 `run_failed`。
- 用户 stop 后，如果 opencode 后续仍发 idle，必须改写为 `run_stopped`，不要显示成功。

## 13. Runtime Run 算法

伪代码：

```ts
async *run(input: OpencodeCodingAgentRuntimeRunInput) {
  const runId = input.runId ?? randomUUID()
  yield run_started(...)

  const server = await serverManager.ensure({
    cwd: input.workingDirectory,
    config: buildOpencodeConfig(input),
    env: buildOpencodeEnv(input),
  })
  const client = createOpencodeClientWithBasicAuth(server)

  const sessionId = input.externalSessionId
    ?? (await client.session.create({ body: { title } })).data.id

  yield sdk_session(sessionId)

  const events = client.event.subscribe()
  await client.session.promptAsync({
    path: { id: sessionId },
    body: {
      model: parseProviderModel(input.model),
      agent: input.agentName,
      parts: buildOpencodeParts(input.prompt, input.attachments),
    },
  })

  for await (const event of events) {
    if (!isCurrentSessionEvent(event, sessionId)) continue
    for (const envelope of adapter.adapt(event)) yield envelope
    if (adapter.hasTerminal()) break
  }
}
```

Abort：

```ts
abort(sessionId) {
  client.session.abort({ path: { id: externalSessionId } })
  abortController.abort()
}
```

## 14. Binary 与打包

### 14.1 依赖

需要先按项目规则搜索确认版本；本次调研结果：

- `@opencode-ai/sdk@1.15.11`
- `opencode-ai@1.15.11`
- `opencode-ai` 当前 npm `bin` 暴露 `opencode -> bin/opencode.exe`，真实运行时应在安装后以 `require.resolve()` / symlink 实测确认入口与 `.asar.unpacked` 路径。
- 平台 optional packages：
  - `opencode-darwin-arm64`
  - `opencode-darwin-x64`
  - `opencode-linux-arm64`
  - `opencode-linux-x64`
  - `opencode-linux-arm64-musl`
  - `opencode-linux-x64-musl`
  - `opencode-linux-x64-baseline`
  - `opencode-linux-x64-baseline-musl`
  - `opencode-darwin-x64-baseline`
  - `opencode-windows-x64-baseline`
  - `opencode-windows-arm64`
  - `opencode-windows-x64`

`npm view opencode` 和 `npm view @opencode-ai/cli` 均为 404，不能用这两个包名。

### 14.2 构建策略

建议：

- `apps/electron/package.json` 增加 `@opencode-ai/sdk`、`opencode-ai` 和目标平台 optional dependencies。
- esbuild external 增加 `@opencode-ai/sdk` / `opencode-ai`，至少 external `opencode-ai`。
- `electron-builder.yml` files 增加 CLI 主包和平台子包。
- 实现 `resolveOpencodeCliPath()`，不要依赖 PATH。
- 打包后验证 `.asar.unpacked` 路径。

需要真实 spike 确认 opencode platform package 的二进制相对路径、`opencode-ai` bin shim 行为和 Electron 打包后的可执行权限，不要照搬 Codex 的 vendor layout。

## 15. Renderer / UX

### 15.1 设置界面

现有 `Agent Runtime` 设置应扩展为三选：

- Claude Code
- Codex
- opencode

opencode 选中后展示：

- 认证来源：本机 opencode auth / CodeInsights channel。
- 模型：`provider/model` 输入或从 `/config/providers` 读取。
- Agent：`build` / `plan` / custom。
- Snapshot：跟随 opencode / 禁用。
- Server 状态：未启动 / 运行中 / 端口 / 版本 / 最近错误。
- MCP 状态入口：显示 `/mcp` 返回的连接状态。

### 15.2 Agent Header

Agent Header 显示 runtime badge：

```text
Runtime: opencode
Model: provider/model
Agent: build
Permission: ask
```

不要为 opencode 单独做一套 message list。继续使用 runtime transcript model，差异只在 event adapter。

### 15.3 能力差异提示

运行中切换 permission 或 queue message 若 runtime 不支持，UI 应显示“下次发送生效”或禁用控件，不能乐观更新本地状态。

## 16. 分阶段实施计划

### Phase 0：方案冻结与依赖 spike

完成定义：

- 方案文档 review 通过。
- 真实确认 `@opencode-ai/sdk` / `opencode-ai` 包结构、binary 路径、server stdout 格式、Basic Auth client 写法。
- 不改业务行为。

验证：

```bash
npm view @opencode-ai/sdk version --json
npm view opencode-ai version optionalDependencies bin --json
```

### Phase 1：共享类型与设置契约

改动：

- `CodingAgentRuntimeKind` 加 `opencode`。
- `AgentEventSource` 加 `opencode_server` / `opencode_cli`。
- `AppSettings` 增加 opencode 字段。
- `settings-service.ts` normalization。
- renderer atoms 增加 opencode 设置。

测试：

```bash
bun test packages/shared/src/agent/runtime-events.test.ts
bun test apps/electron/src/main/lib/settings-service.test.ts
bun run --filter='@codeinsights/electron' typecheck
```

### Phase 2：opencode runtime core

改动：

- `opencode-binary.ts`
- `opencode-env.ts`
- `opencode-config.ts`
- `opencode-server-manager.ts`
- `opencode-sdk-client.ts`

测试：

- binary path 单测。
- env secret allowlist 单测。
- config 不含 secret 单测。
- fake server manager 单测。

### Phase 3：Event Adapter

改动：

- `opencode-event-adapter.ts`
- fixtures：message text、tool running/completed、permission ask/reply、session idle/error、todo、patch、abort。

测试：

```bash
bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts
```

### Phase 4：Runtime mock 接入

改动：

- `OpencodeAgentRuntime implements CodingAgentRuntime`
- runtime registry 注册 feature flag。
- orchestrator 路由与 session binding。

测试：

- fake opencode client stream。
- session 首次绑定与 resume。
- stop 改写终态。
- unsupported capability 不污染 settings。

### Phase 5：真实 server 集成

改动：

- 启动真实 `opencode serve`。
- 通过 `/global/health` 验证版本。
- 通过 `/event` + `/session/:id/prompt_async` 跑真实事件流。

Smoke：

```bash
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only binary
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only server
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only readonly
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only permission
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only abort
```

### Phase 6：Renderer 接入

改动：

- Agent Settings runtime 三选。
- opencode auth/model/agent 设置。
- runtime badge。
- permission banner 与 opencode response。
- runtime transcript replay。

验证：

- Jotai reducer 单测。
- Playwright/Electron fixture reload smoke。

### Phase 7：MCP / packaged / release readiness

改动：

- workspace MCP -> opencode config。
- packaged binary inclusion。
- troubleshooting 文档。
- next-session prompt / support README。

验证：

```bash
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' typecheck
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only packaged
bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only mcp
```

## 17. Smoke 设计

### 17.1 不需要真实模型的 smoke

- binary resolution：`opencode --version`。
- server boot：`opencode serve` + `/global/health`。
- config load：`/config` 返回 CodeInsights 生成的安全策略。
- MCP status：使用无 secret 的 local test MCP 或 fake MCP 验证 `/mcp`。
- permission config：`/config` 确认 permission policy。

### 17.2 需要真实模型/认证的 smoke

- native auth readonly：复用本机 opencode auth，要求 prompt 返回固定 token。
- channel auth readonly：显式 `OPENCODE_SMOKE_API_KEY`，不读取 ambient key。
- permission ask：诱导 bash/edit permission，UI/API respond `reject` 与 `once`。
- abort：长任务后调用 `/session/:id/abort`。
- resume：第二轮使用同一 opencode session id。
- file edit：在临时 cwd 创建受控文件，禁止 git refs/index 变化。

### 17.3 packaged smoke

- 打包后启动真实 app。
- 创建 opencode runtime fixture session 或真实 run。
- 重启 app 后验证 runtime events 回放。
- 验证 packaged binary 路径不是系统 PATH。

## 18. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| opencode SDK server manager 不支持 cwd/env/binary override | 无法满足 Electron 隔离 | 自写 `OpencodeServerManager`，只用 SDK client |
| opencode config schema 变化 | channel/MCP 映射失效 | 每次升级跑 schema/type diff 和 smoke |
| local MCP secret 只能写 config | secret 泄露 | 阻断或 0600 临时 config，未验证前不落盘 |
| opencode 默认权限偏宽 | 意外写文件/跑命令 | CodeInsights 强制生成 permission policy + Git guard |
| server 暴露到网络 | 本地 API 被访问 | 固定 127.0.0.1 + Basic Auth + no CORS |
| SSE 丢事件 | UI 不完整或终态丢失 | 先订阅后 prompt，终态补读 `/message` |
| 用户项目 opencode config 放宽策略 | 绕过 CodeInsights 安全 | 安全策略放入 `OPENCODE_CONFIG_CONTENT` 高优先级 |
| opencode 自更新改变 packaged binary | 打包不可复现 | packaged 默认 `autoupdate: false` |
| Git 操作污染仓库 | 破坏用户工作区 | PATH shim + git env 清理 + refs/index 后验 |

## 19. 文档与验收

实现完成后需要补齐：

- `docs/opencode-support/README.md`
- opencode runtime development checklist
- next-session prompt
- smoke test 记录
- SDK/CLI 升级兼容记录
- 故障排查

公开 `README.md` / `AGENTS.md` 只有在用户允许后再同步。

## 20. 参考来源

- [OpenCode CLI docs](https://opencode.ai/docs/cli/)
- [OpenCode Server docs](https://opencode.ai/docs/server/)
- [OpenCode SDK docs](https://opencode.ai/docs/sdk/)
- [OpenCode Config docs](https://opencode.ai/docs/config/)
- [OpenCode Permissions docs](https://opencode.ai/docs/permissions/)
- [OpenCode MCP servers docs](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Agents docs](https://opencode.ai/docs/agents/)
- [OpenCode Tools docs](https://opencode.ai/docs/tools/)
- [OpenCode Providers docs](https://opencode.ai/docs/providers/)
- npm registry: `@opencode-ai/sdk@1.15.11`、`opencode-ai@1.15.11`
- 当前仓库参考：`docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md`
- 当前仓库参考：`docs/agent-refactor/event-contract.md`
- 当前仓库参考：`apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`
