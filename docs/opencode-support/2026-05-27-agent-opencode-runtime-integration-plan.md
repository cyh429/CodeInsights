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

### 0.1 Phase 0 spike 后的修正结论

2026-05-27 Phase 0 已用 `opencode-ai@1.15.11` 和 `@opencode-ai/sdk@1.15.11` 实测以下事实，后续实现必须以这些结论为准：

- `opencode-ai/bin/opencode.exe` 在 macOS arm64 安装后是真实 0755 Mach-O binary，并与 `opencode-darwin-arm64/bin/opencode` 同内容/同 inode hard link；Electron packaged 需要包含 `opencode-ai` 主包和目标平台 `opencode-{platform}-{arch}` optional packages。
- `opencode serve --port 0` 实测不会随机分配端口，而是绑定默认 `4096`；CodeInsights 必须自己分配空闲端口后显式传入。
- SDK v1 默认 `responseStyle: "fields"`，普通请求返回 `{ data, request, response }` 或 `{ error, request, response }`；`event.subscribe()` 返回 `{ stream }`，Basic Auth header 需要通过 SDK config 或调用 options 注入。
- SDK v1 permission 响应 body 是 `{ response: "once" | "always" | "reject" }`，没有 `remember` 字段；SDK v2 已有 `permission.list()` / `permission.reply()`，首版应优先评估 v2 permission 主路径，旧 session permission endpoint 作为兼容路径。
- `OPENCODE_CONFIG`、`OPENCODE_CONFIG_DIR`、`OPENCODE_CONFIG_CONTENT` 会合并成 resolved config，`OPENCODE_CONFIG_CONTENT` 可覆盖 scalar/array 并合并 object/map；`OPENCODE_CONFIG_DIR` 目录下的 `opencode.json` / `opencode.jsonc` 也会被加载。
- `{env:VAR}` 可用于 provider `options.apiKey`、local MCP `environment` 和 remote MCP `headers`，但 resolved `/config`、`/provider`、`/config/providers` 会包含替换后的真实 secret；任何日志、诊断和 event log 都不能原样记录这些响应。
- `enabled_providers` 会过滤 `/provider` 和 `/config/providers` 输出，但不会清理 `/config.provider` 原始 map；`provider.connected` 不能证明凭证有效。

### 0.2 方案的工程原则

opencode Runtime 的实现要遵循以下原则，这些原则比某个具体 API 形态更稳定：

1. Runtime-first：以 opencode 原生 session / server / config / MCP / permission 为事实来源，CodeInsights 只做代理层和产品层，不把 opencode 降级成普通 LLM Provider。
2. Contract-first：CodeInsights 内部只依赖 `CodingAgentRuntime` 与 `AgentRuntimeEvent` 契约，UI 不直接感知 opencode SSE 原始结构。
3. Secretless disk：任何长期落盘文件都不能包含 API key、Bearer token、MCP secret、Basic Auth password；secret 只存在于 Electron 主进程内存、子进程 env 或 0600 临时文件。
4. Session snapshot：Agent session 首次绑定 opencode runtime 后，必须固化 runtime kind、external session id、model、agent、auth source、permission policy hash 和 workspace cwd，后续 settings 改动不能污染旧会话 resume。
5. Feature flag rollout：opencode 首版必须可完全关闭；未开启时不能改变 Claude Code / Codex session routing、settings normalization 和 renderer 默认行为。
6. Smoke before release：每个实现 Phase 都必须有明确 smoke 或单测证据；真实模型 smoke 可以 gated，但 binary/server/config/permission/MCP secretless smoke 不应依赖外部 LLM。

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

### 3.4 Runtime 绑定不变量

opencode 接入时必须延续 Codex runtime 已经验证过的绑定纪律：

- 新建 Agent session 时，settings 只用于决定“本次首次运行选择哪个 runtime”；一旦 runtime 物化，session 应使用绑定快照继续运行。
- 已绑定 `runtimeKind = 'opencode'` 的 session 不能因为用户切回 Codex 设置而改走 Codex；必须继续用 opencode resume，除非用户显式创建新 session 或执行迁移动作。
- `externalSessionId` 对 opencode 是原生 `session.id`，但它不足以恢复完整上下文；还需要记录 `model`、`agent`、`workingDirectory`、`authSourceHash`、`runtimeConfigHash`。
- `runtimeConfigHash` 只能由不含 secret 的 config、permission policy、MCP 结构、provider metadata、agent name 等内容计算；不能把 API key 值参与 hash。
- 运行中的 permission mode 切换不能乐观写入 session 绑定；opencode 首版不支持运行中更新时，UI 只能提示“下次发送生效”。
- stop / abort 后旧 run 的 finally 不能清理新 run 状态；沿用项目 lessons 中的单调 generation / run token 规则。

### 3.5 与未来更多 Coding Agent 的关系

opencode 不应成为第三套特殊路径。实现时要把以下概念做成 runtime 中立：

| 通用概念 | Claude Code | Codex | opencode |
| --- | --- | --- | --- |
| 原生会话 id | SDK session id | thread id | session id |
| 原生事件来源 | SDK message stream | SDK / CLI events | server SSE / message parts |
| 权限响应 | SDK callback | runtime policy / CLI behavior | `/session/:id/permissions/:permissionID` |
| MCP 来源 | Claude settings / workspace | Codex config | opencode `mcp` config |
| 模型格式 | channel model | Codex model | `provider/model` |

新增抽象时优先补 `CodingAgentRuntimeCapabilities`、runtime manifest 和 runtime event adapter，不要把 renderer 写成 `if runtime === 'opencode'` 的分叉。

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
- `POST /session/:id/permissions/:permissionID`：v1 兼容 permission 响应接口，body 为 `{ response: "once" | "always" | "reject" }`，返回 boolean；生成类型没有 `remember`。
- `GET /permission` / `POST /permission/:requestID/reply`：v2 permission 主路径，reply body 为 `{ reply?: "once" | "always" | "reject", message?: string }`，Phase 1-2 需要决定首版 wrapper 是否直接走 v2。
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
- `createOpencodeClient({ baseUrl, fetch, responseStyle })` 支持自定义 fetch；CodeInsights 应用这个入口注入 Basic Auth header、统一 timeout、错误分类和请求日志脱敏。
- SDK 文档显示默认 `responseStyle` 为 `fields`，示例常用 `.data`；实现前必须用真实类型确认返回结构，并在 `opencode-sdk-client.ts` 中封装成项目内部稳定返回，避免业务层散落 `.data` / `.stream` 细节。
- `event.subscribe()` 返回 SSE stream；首版 adapter 只消费 server event，不直接让 renderer 订阅 opencode server。

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
- CodeInsights 生成的 agents / commands / modes / plugins 等运行资产应放入私有目录，并用 `OPENCODE_CONFIG_DIR` 指向它，避免污染用户项目 `.opencode/`。Phase 0 已确认 `OPENCODE_CONFIG_DIR` 也会加载目录下的 `opencode.json` / `opencode.jsonc`，因此该目录本身也必须按 `0700` 管理，且不能混入含 secret 的 config 文件。
- CodeInsights 的强制安全策略应通过 `OPENCODE_CONFIG_CONTENT` 注入到最高普通优先级，防止项目 config 放宽 permission、server、share 等边界；系统级 managed settings 仍可能覆盖它，smoke 需要检测并报告。
- `OPENCODE_CONFIG_CONTENT` 不得包含 secret。
- `{env:VAR}` 替换后的真实值会出现在 resolved config/provider API 响应里；`OpencodeServerManager` 和诊断 IPC 只能记录脱敏摘要，不能把 `/config`、`/provider`、`/config/providers` 原样持久化。

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

channel auth 的推荐写法是使用 config 变量替换，而不是调用 server `auth.set()` 持久写入 opencode auth storage：

```jsonc
{
  "provider": {
    "codeinsights-openai-compatible": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "CodeInsights Channel",
      "options": {
        "baseURL": "https://example.com/v1",
        "apiKey": "{env:CODEINSIGHTS_OPENCODE_CHANNEL_API_KEY}"
      },
      "models": {
        "gpt-5.1-codex": {
          "name": "gpt-5.1-codex"
        }
      }
    }
  },
  "model": "codeinsights-openai-compatible/gpt-5.1-codex"
}
```

Phase 1 spike 必须验证：

- built-in provider 是否都接受 `provider.{id}.options.apiKey = "{env:...}"`。Phase 0 已确认 custom provider 支持 `{env:...}`，但 built-in provider 的真实请求仍需凭证 smoke。
- OpenAI-compatible provider 使用 `@ai-sdk/openai-compatible` 还是 `@ai-sdk/openai`，取决于目标端点是 `/v1/chat/completions` 还是 `/v1/responses`。Phase 0 已确认两者都可作为 custom provider `npm` 值被 server 加载；真实协议差异留到有凭证/endpoint 的 smoke。
- `baseURL`、`headers`、`models` 的 schema 与 `https://opencode.ai/config.json` 一致。
- `/provider` 和 `/config/providers` 返回的 provider/model id 是否和 `model` 字段完全一致。Phase 0 已确认 `enabled_providers` 会过滤这两个 endpoint，但不会清理 `/config.provider` 原始 map。
- server `PUT /auth/:id` 是否会写入 `~/.local/share/opencode/auth.json`；如果会，首版不得用它承载 CodeInsights channel key。Phase 0 已确认 channel auth 可通过 env placeholder 覆盖，不需要写入 opencode auth storage。
- `provider.connected` 不是凭证有效性的强信号；缺失或 dummy key 的 custom provider 仍可能被列为 connected。

### 4.6 MCP

opencode 原生支持 local 和 remote MCP：

- local：`mcp.{name}.type = "local"`，`command` 为数组，支持 `environment` 和 `timeout`。
- remote：`type = "remote"`，`url`、`headers`、`oauth`、`timeout`。
- remote OAuth 可自动处理，token 存储在 `~/.local/share/opencode/mcp-auth.json`。
- Server API 可 `GET /mcp` 查看状态，`POST /mcp` 动态添加 MCP。

安全要求：

- remote headers 应优先使用 `{env:VAR}` 形式，secret 只放 env。
- opencode config 支持 `{env:VAR}` 变量替换；Phase 0 已验证 local MCP `environment` 和 remote MCP `headers` 都会替换为 env 值。
- resolved API 会暴露替换后的 MCP secret，MCP 状态 UI 和日志只能输出 server 名称、状态和脱敏摘要。
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

### 5.4 Runtime 内部边界

`OpencodeAgentRuntime` 只做四件事：

1. 将 CodeInsights run input 转为 opencode session / message / permission / abort API。
2. 管理 opencode server lifecycle 和 SDK client。
3. 把 opencode event / message part 转为 `AgentRuntimeEvent`。
4. 把 terminal state、errors、external session id 返回给 Orchestrator。

它不应该：

- 直接操作 renderer atoms。
- 直接读写 `channels.json` 明文内容。
- 在 adapter 里启动子进程或读取 settings。
- 复制 opencode tool result 解析逻辑到 UI。
- 把 opencode 原始事件完整暴露给 renderer 作为长期契约。

### 5.5 运行时 manifest

建议为每个 opencode session 写入 manifest，位置可放在现有 Agent session metadata 或 runtime event log metadata 中：

```json
{
  "kind": "opencode",
  "externalSessionId": "ses_xxx",
  "model": "codeinsights-openai-compatible/gpt-5.1-codex",
  "agent": "build",
  "workingDirectory": "/abs/session/cwd",
  "authSource": "channel",
  "authSourceHash": "sha256:...",
  "runtimeConfigHash": "sha256:...",
  "opencodeVersion": "1.15.11",
  "createdAt": 1790400000000,
  "updatedAt": 1790400000000
}
```

manifest 写入规则：

- 首个 `sdk_session` 事件前后都可以写，但同一 run 只能写一次。
- resume 前必须先读取 manifest；读取失败时不应静默新建 session。
- manifest 不包含 secret，不包含 Basic Auth password，不包含 env 原始值。
- `workingDirectory` 需要经过 realpath / symlink 安全校验，避免历史 session 指向 workspace 外。

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

### 6.1.1 运行时事件扩展建议

opencode 的事件比 Claude SDKMessage 更细，建议在 shared 层补以下 runtime event metadata 字段，全部可选，避免破坏 Codex：

```ts
export interface AgentRuntimeEventBase {
  source: AgentEventSource
  runtimeKind?: CodingAgentRuntimeKind
  runId?: string
  externalSessionId?: string
  externalMessageId?: string
  externalPartId?: string
  sequence?: number
  occurredAt?: number
}
```

使用这些字段解决三个问题：

- 去重：`externalMessageId + externalPartId + eventType + sequence` 可作为重复 SSE 的过滤依据。
- 回放：runtime event log 可以按 `occurredAt / sequence` 重建 transcript。
- 调试：server 断线、补读 `/message` 和 adapter 生成事件能关联回原生 opencode message part。

如果当前 `AgentRuntimeEvent` 已有近似字段，应复用现有字段名，不为了 opencode 新增并行概念。

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

### 6.3 Settings normalization

`settings-service.ts` 需要对 opencode 字段做运行时 normalization：

- `agentRuntimeKind` 未设置时保持现有默认，不自动启用 opencode。
- feature flag 未启用时，即使磁盘 settings 里有 `opencode`，也要回退到安全默认并保留原字段不删除。
- `agentOpencodeModelId` 必须是非空字符串，推荐格式校验为 `provider/model`；不符合时只阻断 opencode run，不影响其他 runtime。
- `agentOpencodeAgentName` 默认为 `build`，plan permission mode 可在 run input 层改为 `plan`，不要全局改 settings。
- `agentOpencodeChannelId = null` 表示 native auth；`undefined` 表示沿用默认选择逻辑。两者要区分。
- 保存 settings 时不能把 transient server port、Basic Auth password、smoke secret 写入 settings。

### 6.4 IPC 契约影响

首版尽量不新增 Agent message IPC；可在现有 settings IPC 中扩展字段。需要新增的 IPC 只限于诊断类：

- `agentRuntime:listCapabilities`：返回可用 runtime、feature flag、binary 状态。
- `agentRuntime:getOpencodeServerStatus`：返回 server 是否运行、版本、端口、最近错误摘要。
- `agentRuntime:refreshOpencodeModels`：触发 `/provider` 或 `/config/providers` 读取，不输出 secret。

如果为了快速落地不新增这些 IPC，renderer 设置页仍要能显示“opencode 未启用 / binary 未找到 / auth 未配置”的可解释错误。

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
- 不使用 `--port 0` 依赖随机端口；先由 CodeInsights 绑定临时 socket 获取空闲端口，释放后显式传给 `opencode serve --port <free-port>`。
- `cors` 默认为空。
- server stdout/stderr 日志必须脱敏。
- password 只保存在内存。
- server 退出时清理 0600 临时文件和 PATH shim。

### 7.4 Server lifecycle 状态机

`OpencodeServerManager` 建议维护明确状态：

```ts
type OpencodeServerState =
  | 'idle'
  | 'starting'
  | 'healthy'
  | 'degraded'
  | 'stopping'
  | 'stopped'
  | 'failed'
```

状态转换：

- `idle -> starting`：首次 run 或 settings smoke 触发。
- `starting -> healthy`：`GET /global/health` 返回 `{ healthy: true, version }`，并且 `/event` 首包 `server.connected` 可读。
- `starting -> failed`：进程退出、health timeout、Basic Auth 失败、端口不可达。
- `healthy -> degraded`：SSE 断开但 health 仍可用；允许补读 `/message`，并可重连一次。
- `healthy/degraded -> stopping`：idle timeout、settings changed、app quit、fatal error。
- `stopping -> stopped`：子进程退出且临时文件清理完成。

实现要求：

- 同一个 `OpencodeServerKey` 的并发 `ensure()` 必须复用同一个启动 Promise。
- server health timeout 建议 5s，packaged app 可放宽到 10s。
- startup stderr 只保留脱敏摘要，最多 N KB，防止 secret 或超长日志进入 JSONL。
- `SIGTERM` 后给 2s grace period；未退出再 kill。
- app quit 时统一关闭所有 server，不能留下后台 opencode 进程。

### 7.5 Server key 与重启策略

`runtimeConfigHash` 变化时是否重启取决于变化类型：

| 变化 | 是否重启 | 原因 |
| --- | --- | --- |
| model only | 不一定 | `prompt_async` body 可带 model |
| agent only | 不一定 | `prompt_async` body 可带 agent |
| permission policy | 是 | 防止运行中权限策略不一致 |
| MCP config | 是 | MCP tool discovery 通常在 server 启动或 config reload 时发生 |
| provider baseURL/auth source | 是 | 避免旧 client 使用旧凭证或旧 endpoint |
| cwd / workspace | 是 | opencode project、snapshot、external_directory 都依赖 cwd |
| Basic Auth password | 是 | client 与 server auth 必须一致 |

首版可以保守：`runtimeConfigHash` 任意变化都重启。优化复用策略放到后续版本。

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

### 8.4 原子写入与 hash

`opencode-config.ts` 应提供一个纯函数和一个写入函数：

```ts
interface BuildOpencodeConfigResult {
  configPath: string
  configDir: string
  configContent: string
  inlinePolicyContent: string
  runtimeConfigHash: string
  redactedSummary: Record<string, unknown>
}
```

规则：

- `configContent` 用稳定 JSON stringify，排序 key，减少 hash 抖动。
- 写入前检查目标路径所有已存在父级不是 symlink；写入使用临时文件 + rename。
- 文件权限建议 `0600`，目录权限建议 `0700`。
- `redactedSummary` 可写入 runtime log，但不能包含 secret、完整 header、完整 env。
- hash 输入应包含 config schema version、opencode target version、permission policy version 和 CodeInsights runtime adapter version。

### 8.5 私有 `.opencode` 资产

使用 `OPENCODE_CONFIG_DIR` 时，目录结构应尽量贴近 opencode 约定：

```text
runtime/opencode/config-dir/
├── agents/
│   ├── codeinsights-build.md
│   └── codeinsights-plan.md
├── commands/
├── plugins/
├── skills/
└── tools/
```

首版建议只生成 agent，不生成 plugin / custom tool：

- `codeinsights-build`：默认开发 agent，permission 由全局 policy 控制。
- `codeinsights-plan`：只读计划 agent，显式 `edit: deny`、危险 bash deny。

这样可以复用 opencode agent 能力，但不引入自定义工具维护负担。

### 8.6 与用户项目配置的关系

CodeInsights 不能假设用户项目没有 `opencode.json` 或 `.opencode/`：

- 用户项目 config 可以提供模型、agents、commands 等增强能力。
- CodeInsights 强制安全策略必须放在更高优先级的 inline config。
- 如果系统级 managed settings 与 CodeInsights 策略冲突，应在 smoke 和 UI 中显示“被系统 managed config 覆盖”，不要继续运行危险配置。
- 方案不应删除、移动或改写用户项目内的 `opencode.json` / `.opencode/`。

## 9. Auth 与 Provider 映射

### 9.1 Native auth

native 模式复用 opencode 自己的登录状态：

- `~/.local/share/opencode/auth.json`
- 环境变量
- 项目 `.env`

首版不复制 native auth 到 CodeInsights 私有目录，避免破坏用户现有 opencode 行为。真实 smoke 需要记录是否使用 native auth，并避免输出 auth 文件内容。

native auth 的边界：

- 允许 opencode 自己读取用户全局 auth，因为这是用户选择“本机 opencode auth”的语义。
- 不在 CodeInsights 中解析或展示 auth 文件内容。
- smoke summary 只记录“native auth detected / not detected / provider connected count”，不记录 provider token。
- 如果用户选择 native auth，同时 CodeInsights channel 设置存在，不应把 channel API key 注入子进程。
- native auth 失败时错误要指向 opencode 原生命令：`opencode auth login` 或 TUI `/connect`，不要提示用户去 CodeInsights channel 填 key。

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

### 9.3 Auth source hash

`authSourceHash` 用于判断 server 是否需要重启，但不能泄漏 secret：

```ts
interface AuthSourceFingerprintInput {
  source: 'native' | 'channel' | 'smoke'
  channelId?: string
  providerId?: string
  baseURL?: string
  apiKeyStableFingerprint?: string
}
```

`apiKeyStableFingerprint` 不能直接用完整 key；可使用 `sha256(secret)`，只存 hash 前缀，如 `sha256:8b1a...`。这样能在 key 变化时重启 server，又不会暴露 key。

### 9.4 Provider allowlist 与禁用

channel auth 模式下建议生成：

```jsonc
{
  "enabled_providers": ["codeinsights-openai-compatible"],
  "disabled_providers": []
}
```

目的：

- 避免 opencode 同时加载用户全局 auth 中的其他 provider，导致模型选择或请求走错账号。
- 让 `/provider` 返回更可预测，减少 UI 误选。
- 如果用户选择 native auth，则不要强制 `enabled_providers`，保留 opencode 原生 provider 选择体验。

如果 opencode schema 或行为显示 `enabled_providers` 会破坏 custom provider，则 Phase 1 spike 要记录并改用更窄的 model 固定策略。

## 10. Permission 映射

### 10.1 推荐策略

| CodeInsights 模式 | opencode agent | opencode permission | 说明 |
| --- | --- | --- | --- |
| `plan` | `plan` | `edit: deny`, `bash: ask`, `webfetch/websearch: ask`, `external_directory: ask` | 计划与分析优先，禁止文件修改 |
| `auto` | `build` | `read/glob/grep: allow`, `edit/bash/task/skill/webfetch/websearch: ask`, `doom_loop: deny` | 默认安全交互 |
| `ask` | `build` | `*: ask`, `read/glob/grep: allow`, `doom_loop: deny` | 更保守 |
| `bypassPermissions` | `build` | `*: allow`, `doom_loop: deny` | 仍保留 CodeInsights Git guard，不等于无防护 |

`dangerously-skip-permissions` 首版不用于 server 主路径。只有用户显式选择 opencode 原生危险模式并经过 UI 警告后，才能允许等价能力。

### 10.1.1 建议生成的 permission policy

`plan`：

```jsonc
{
  "permission": {
    "*": "ask",
    "read": { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    "glob": "allow",
    "grep": "allow",
    "edit": "deny",
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "git diff*": "allow",
      "git log*": "allow",
      "git commit*": "deny",
      "git push*": "deny",
      "git reset*": "deny"
    },
    "webfetch": "ask",
    "websearch": "ask",
    "external_directory": "ask",
    "doom_loop": "deny"
  }
}
```

`ask / auto`：

```jsonc
{
  "permission": {
    "*": "ask",
    "read": { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    "glob": "allow",
    "grep": "allow",
    "edit": "ask",
    "bash": {
      "*": "ask",
      "git status*": "allow",
      "git diff*": "allow",
      "git log*": "allow",
      "git commit*": "deny",
      "git push*": "deny",
      "git reset*": "deny",
      "rm -rf*": "deny"
    },
    "task": "ask",
    "skill": "ask",
    "lsp": "ask",
    "question": "ask",
    "webfetch": "ask",
    "websearch": "ask",
    "external_directory": "ask",
    "doom_loop": "deny"
  }
}
```

注意：opencode granular rules 是“最后匹配规则获胜”。生成器必须把 catch-all 放前面、deny/allow 细规则放后面，并用测试覆盖顺序。

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

permission response 字段处理建议：

- CodeInsights “allow once” -> v1 `{ response: "once" }`；v2 `{ reply: "once" }`。
- CodeInsights “allow always/session” -> v1 `{ response: "always" }`；v2 `{ reply: "always" }`。首版语义仍按 CodeInsights 当前 session 授权展示，不能暗示写入长期规则。
- CodeInsights “deny” -> v1 `{ response: "reject" }`；v2 `{ reply: "reject" }`。
- SDK 类型没有 `remember`，server 对额外字段即使宽容也不能作为契约；adapter 中保留统一函数 `toOpencodePermissionResponse()`，并集中选择 v1 兼容路径或 v2 permission 主路径。

### 10.3 Permission 请求展示字段

PermissionBanner 至少需要显示：

- tool / permission name：如 `bash`、`edit`、`external_directory`。
- action preview：命令、文件路径、URL 或 MCP tool 名。
- opencode suggested patterns：如果 event 提供“always 会批准哪些 pattern”，只作为本 session 说明，不写入长期规则。
- cwd / workspace：避免用户不知道命令在哪个目录运行。
- risk label：写文件、外部目录、网络、shell、MCP 分别标识。

缺少 preview 时，默认只允许 reject 或一次性 allow，不展示 always。

### 10.4 Git guard 与 opencode permission 的关系

permission policy 是第一层，Git guard 是第二层：

- 即使 opencode policy 误放行 `git commit`，Git guard 也要阻断。
- 即使用户选择 `bypassPermissions`，Git guard 默认仍启用。
- Git guard 需要覆盖绝对路径 `/usr/bin/git`、`/opt/homebrew/bin/git`，不能只靠 PATH shim。
- 运行后仍要校验 refs、index、local config 和工作区补丁，沿用 Codex runtime 的验证经验。

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

MCP name 生成规则：

- 只允许 `[a-zA-Z0-9_-]`，其他字符替换为 `_`。
- 防止和 opencode built-in tool、其他 MCP server 名冲突。
- 保留原始 displayName 给 UI，但 config key 使用 sanitized name。

local MCP 命令规则：

- `command` 必须是数组形式，禁止 shell string。
- 不自动包 `sh -c` / `cmd.exe /c`。
- env 合并时拒绝覆盖 `PATH`、`HOME`、`SHELL`、`OPENCODE_*`、`CODEINSIGHTS_*`、`GIT_*`、proxy 变量和 provider API key 变量。
- secret env 使用 `CODEINSIGHTS_OPENCODE_MCP_<NAME>_<KEY>` 这类 scoped env name 注入。

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

### 11.4 动态 MCP API 的取舍

Server API 提供 `POST /mcp` 动态添加 MCP。首版仍建议优先 config file：

- config file 可审计、可 hash、可复现 server key。
- 动态 API 适合作为 smoke 或后续 UI “临时添加 MCP”能力。
- 动态添加如果涉及 secret，仍要确认 server 是否持久化该配置；未确认前不能传明文 token。

### 11.5 MCP smoke 约束

MCP smoke 分三层：

1. config-only：生成无 secret MCP config，启动 server 后 `/mcp` 可见。
2. tool discovery：本地 fake MCP 返回固定 tool list，验证 opencode 能加载。
3. tool call：真实模型调用 MCP tool，可作为 gated smoke，不阻塞首版无凭证验证。

任何 smoke summary 都不能输出 MCP env、headers、OAuth token 路径内容。

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

### 12.4 Adapter 状态模型

`OpencodeEventAdapter` 应该是可测试的纯状态机：

```ts
interface OpencodeAdapterState {
  runId: string
  sessionId: string
  promptSent: boolean
  stopped: boolean
  terminalWritten: boolean
  seenEventKeys: Set<string>
  textParts: Map<string, string>
  toolParts: Map<string, OpencodeToolPartSnapshot>
  messageOrder: string[]
}
```

职责：

- 根据 event / part 生成 0..N 个 `AgentStreamEnvelope`。
- 维护 part 累积文本，避免 delta 和 snapshot 混用导致重复文本。
- 对重复 SSE 或补读 message 做去重。
- 在 stop 后屏蔽后续 success terminal。
- 不访问文件系统、不请求 server、不读 settings。

### 12.5 去重 key

建议去重 key：

```text
${sessionId}:${messageId}:${partId}:${eventType}:${partState}:${contentHash}:${sequence}
```

如果 event 没有 sequence：

- 对 text delta：用 `messageId + partId + accumulatedLength + deltaHash`。
- 对 tool start：用 `messageId + partId + toolName + callId`。
- 对 terminal：用 `runId + terminalType`，强制单 terminal。

### 12.6 补读策略

补读 `/session/:id/message` 的场景：

- SSE 连接在 terminal 前断开。
- adapter 收到 `message.updated` 但缺 part 详情。
- UI reload 后需要重建最新 assistant message。
- run 完成但 transcript 缺失最后一段文本。

补读规则：

- 补读只补当前 session 当前 run 相关 message，避免把历史全量重复写入本次 run。
- 补读生成的 event source 标记为 `opencode_server`，metadata 标明 `recovered: true`。
- 如果补读和 SSE 都有同一 part，以更完整的 snapshot 覆盖 UI 展示，但 event log 不删除历史 delta。

### 12.7 错误分类

opencode 错误需要映射成用户能理解的 CodeInsights 错误：

| 原始错误 | CodeInsights 错误 | 用户提示 |
| --- | --- | --- |
| binary not found | `runtime_binary_missing` | opencode runtime 未安装或打包缺失 |
| health timeout | `runtime_server_start_timeout` | opencode server 启动超时 |
| 401 Basic Auth | `runtime_server_auth_failed` | 本地 server 鉴权失败，请重启 runtime |
| provider auth missing | `runtime_provider_auth_missing` | 当前 opencode provider 未认证 |
| model not found | `runtime_model_not_found` | 模型 id 不存在或 provider 未启用 |
| permission rejected | 非 fatal tool result | 用户拒绝了工具调用 |
| abort | `run_stopped` | 用户已停止 |
| SSE disconnect before terminal | `runtime_stream_interrupted` | 事件流中断，已尝试恢复 |

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

### 13.1 run 前置检查

`run()` 开始前按顺序执行：

1. 检查 feature flag。
2. 读取或创建 runtime manifest。
3. 校验 `workingDirectory` realpath 在 workspace/session cwd 内。
4. 校验 binary path、可执行权限和版本。
5. 构建 secretless config 与 env。
6. 计算 `runtimeConfigHash` / `authSourceHash`。
7. ensure server，并检查 health。
8. 先订阅 event stream，再发送 prompt。

任一步失败都要产生 `run_failed`，并写入 redacted error summary。

### 13.2 prompt body 构建

`POST /session/:id/prompt_async` body 按 server docs 与 SDK 类型生成：

```ts
interface OpencodePromptBody {
  messageID?: string
  model?: string
  agent?: string
  noReply?: boolean
  system?: string
  tools?: Record<string, boolean>
  parts: OpencodePromptPart[]
}
```

首版建议：

- `model` 显式传 `input.model`，即使 config 里已有默认 model。
- `agent` 显式传 `input.agentName`。
- `parts` 至少包含一个 text part；附件先转为 opencode 支持的 file/image part，无法安全映射时以文本 `<file>` fallback。
- `tools` 首版不作为主要权限控制入口，避免和 `permission` config 混用；只在禁用某类 MCP/tool 时使用。
- `system` 只放 CodeInsights 必要 workspace context，不复制大量 UI 文案。

### 13.3 Resume 算法

resume 规则：

- 有 manifest 且 `externalSessionId` 存在：复用 opencode session id。
- 调用 `GET /session/:id` 验证存在；404 时不要自动新建同名 session，应提示用户 runtime session 丢失。
- 如果 `runtimeConfigHash` 变化，允许继续使用原 session，但必须启动新 server，并在 event log 记录 `runtime_config_changed`。
- 如果 `workingDirectory` 不存在或越界，阻断 resume。
- 如果 model/channel settings 改变但 manifest 绑定了旧值，默认使用 manifest 旧值；UI 可提示“此会话使用创建时的 runtime 配置”。

### 13.4 Stop 算法

stop 需要双通道：

1. 对 opencode session 调 `/session/:id/abort`。
2. 对本地 run loop `AbortController.abort()`。

如果 `/abort` 失败但本地 AbortController 成功：

- 先写 `run_stopping`。
- 给 server 一次 health / status 查询机会。
- 若 opencode 仍运行，可 kill server 并写 `run_stopped`，但要标记 `forced: true`。

stop 后任何迟到的 `session.idle`、message completed、tool completed 都不能把 run 改回 success。

### 13.5 并发与 queue

首版维持“同一 session 单 run”：

- 同一 CodeInsights session 有 active run 时，新的 send 应返回 `session_busy`。
- 不使用 opencode queue message 能力，即使 server 支持多 message。
- 不同 CodeInsights session 可以复用同一个 opencode server，但事件必须按 `sessionId` 过滤。
- 共享 server 下 stop 只能 abort 对应 opencode session，不能 kill server，除非 server 已失控。

## 14. Binary 与打包

### 14.1 依赖

需要先按项目规则搜索确认版本；本次调研结果：

- `@opencode-ai/sdk@1.15.11`
- `opencode-ai@1.15.11`
- `opencode-ai` 当前 npm `bin` 暴露 `opencode -> bin/opencode.exe`；Phase 0 已确认 postinstall 后该文件就是真实 0755 native binary，不是 JS shim。
- 当前 macOS arm64 平台包路径为 `node_modules/opencode-darwin-arm64/bin/opencode`，与 `node_modules/opencode-ai/bin/opencode.exe` 同内容/同 inode hard link。
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

Phase 0 已确认 opencode platform package 的二进制相对路径、`opencode-ai` bin postinstall 行为和本地可执行权限；Electron 打包后的 `.asar.unpacked` 路径仍需 Phase 7 packaged smoke 验证。

### 14.3 Binary 解析顺序

`resolveOpencodeCliPath()` 推荐顺序：

1. 用户显式配置的 custom path。
2. packaged app 内 `app/node_modules/opencode-ai/bin/opencode.exe` 或对应 symlink。
3. packaged app 内 platform package binary。
4. dev workspace `apps/electron/node_modules/.bin/opencode`。
5. dev workspace `node_modules/.bin/opencode`。

不建议默认回退系统 PATH，因为 packaged smoke 需要证明使用的是受控 runtime。开发模式可以允许 PATH fallback，但要在 UI 和日志中标记 `source: system-path`。

### 14.4 esbuild / electron-builder

打包配置建议：

- `opencode-ai` 必须 external，因为它通过 platform optional package 分发 binary。
- `@opencode-ai/sdk` 可以先 external，降低 ESM/CJS 打包风险；如果后续证明可安全 bundle，再收敛。
- `electron-builder.yml` 需要包含 `opencode-ai/**/*` 和目标 platform packages。
- macOS x64 / arm64 仍遵守 optionalDependencies 的平台筛选限制，不能假设一个 runner 同时拿到两种架构 binary。
- CI 矩阵需要分别验证 darwin-arm64、darwin-x64、win32-x64；Linux 如计划发布再加入。

### 14.5 升级策略

opencode 升级时至少跑：

```bash
npm view @opencode-ai/sdk version dependencies --json
npm view opencode-ai version optionalDependencies bin --json
opencode --version
opencode serve --hostname 127.0.0.1 --port <port>
```

升级检查项：

- SDK 方法名和返回结构是否变化。
- Server API body 是否变化，尤其是 `prompt_async` 和 `permissions`。
- config schema 是否新增/废弃字段。
- optional package 名称或 binary 路径是否变化。
- 默认 permission 是否变化。
- autoupdate 行为是否影响 packaged runtime。

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

设置页交互规则：

- feature flag 未启用：opencode 选项显示为实验功能关闭，不可选或带明确开关说明。
- binary 未找到：允许保存设置，但运行前阻断，并提供诊断按钮。
- native auth：显示“使用 opencode 原生认证”，提供 `opencode auth login` 指引，不读取 auth 文件内容。
- channel auth：复用现有 Channel 选择器；模型输入提示必须使用 `provider/model`。
- model refresh：只有 server 可启动且 auth 配置可用时才启用；失败时展示 redacted error。
- permission mode：运行中切换时显示“下次发送生效”，不改 active run。

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

### 15.4 PermissionBanner 文案

中文 UI 建议：

- 标题：`opencode 请求执行工具`
- 主体：显示工具名、目标文件/命令/URL、工作目录。
- 一次允许：`允许本次`
- 当前会话允许：`本会话允许`
- 拒绝：`拒绝`
- 危险提示：`该操作可能修改文件或执行命令，请确认工作区和命令内容。`

如果 opencode event 缺少足够上下文，隐藏“本会话允许”，只保留“允许本次 / 拒绝”。

### 15.5 历史回放

历史回放必须只依赖 CodeInsights runtime event log 和 session messages，不依赖 opencode server 仍然存在：

- app 重启后，已完成 run 的 transcript 可以完整显示。
- opencode server 不运行时，历史消息不应报错。
- 只有用户继续发送新消息时才 ensure server。
- 对补读得到的 recovered events，要能和历史 SSE delta 共存，不重复显示。

## 16. 分阶段实施计划

### Phase 0：方案冻结与依赖 spike

完成定义：

- 方案文档 review 通过。
- 真实确认 `@opencode-ai/sdk` / `opencode-ai` 包结构、binary 路径、server stdout 格式、Basic Auth client 写法。
- 真实确认 `createOpencodeClient()` 返回结构、`event.subscribe()` stream 形态、`permissions` SDK body 类型。
- 真实确认 `OPENCODE_CONFIG_CONTENT`、`OPENCODE_CONFIG_DIR`、`{env:VAR}` 在 provider / MCP 字段中的行为。
- 不改业务行为。

验证：

```bash
npm view @opencode-ai/sdk version --json
npm view opencode-ai version optionalDependencies bin --json
npm view opencode version --json
npm view @opencode-ai/cli version --json
```

`opencode` / `@opencode-ai/cli` 预期为 404；验证脚本应把 404 记录为“包名不可用”，不是失败。

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

完成定义：

- 不启动真实模型也能验证 config、env、binary、server key。
- 所有 redacted summary 不含 secret。
- server manager fake 测试覆盖 starting / healthy / failed / stopping。

### Phase 3：Event Adapter

改动：

- `opencode-event-adapter.ts`
- fixtures：message text、tool running/completed、permission ask/reply、session idle/error、todo、patch、abort。

测试：

```bash
bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts
```

完成定义：

- delta 与 snapshot 不重复。
- permission ask/reply 能映射。
- stop 后迟到 idle 不会写 success。
- SSE 断开补读能生成 recovered event。

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

完成定义：

- Orchestrator 能按 settings 选择 opencode。
- session 首次绑定后 settings 改变不影响 resume。
- runtime event log 可回放 mock transcript。

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

完成定义：

- 无真实模型时，binary/server/config/permission config smoke 通过。
- 有 native auth 或显式 smoke key 时，readonly prompt smoke 通过。
- smoke summary 不输出 API key、Basic Auth password、MCP token。

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

完成定义：

- 设置页可切换 runtime、auth source、model、agent。
- Agent Header 能显示 opencode runtime badge。
- PermissionBanner 能完成 reject / once response。
- app reload 后历史 transcript 不依赖 opencode server。

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

完成定义：

- packaged app 使用 bundled opencode binary，不走系统 PATH。
- MCP secretless config smoke 通过。
- README / AGENTS 公开同步草稿完成，但只有用户允许后再修改根文档。
- support README、development checklist、next-session prompt 完成。

### Phase 8：真实使用验收

建议增加独立验收阶段，不和 packaged 混在一起：

- native auth readonly：使用本机 opencode auth，固定 prompt 返回短文本。
- channel auth readonly：使用显式 `OPENCODE_SMOKE_API_KEY`，不读取 ambient `OPENAI_API_KEY`。
- permission reject：诱导 bash/edit，拒绝后 run 继续或给出可解释失败。
- permission once：允许 `git status` 只读命令。
- file edit：临时目录中修改受控文件，Git refs/index 不变。
- resume：同一 CodeInsights session 二次发送复用 opencode session id。
- stop：长任务能停止，并且最终态是 stopped。

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

### 17.4 smoke summary 格式

建议所有 opencode smoke 输出统一 JSON summary：

```json
{
  "runtime": "opencode",
  "opencodeVersion": "1.15.11",
  "sdkVersion": "1.15.11",
  "checks": [
    {
      "name": "server.health",
      "status": "passed",
      "durationMs": 128,
      "details": {
        "hostname": "127.0.0.1",
        "auth": "basic",
        "binarySource": "bundled"
      }
    }
  ],
  "redactions": {
    "secretValuesPrinted": false
  }
}
```

规则：

- `status` 只能是 `passed | failed | skipped`。
- skipped 必须有 reason。
- 不输出 env、headers、auth file 内容。
- binary path 可输出，但 home 目录可按现有项目日志策略缩写。

### 17.5 文档验证

每次更新本方案至少跑：

```bash
awk 'BEGIN{n=0} /^```/{n++} END{exit(n%2)}' docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md
perl -ne 'while(/\]\(([^)]+)\)/g){$u=$1; next if $u =~ /^(https?:|mailto:|#)/; print "$ARGV:$.:$u\n"; $bad=1} END{exit($bad ? 1 : 0)}' docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md
git diff --check -- docs/opencode-support tasks/todo.md
```

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
| channel auth 被写入 opencode auth.json | secret 进入用户全局文件 | 首版不用 `auth.set()` 承载 channel key，只用 env placeholder |
| event adapter 重复显示文本 | UI transcript 混乱 | part-level 状态机 + 去重 key + fixture |
| settings 改变污染旧会话 | resume 到错误模型/账号 | runtime manifest 固化绑定快照 |
| managed config 覆盖安全策略 | CodeInsights policy 失效 | smoke 读取 resolved config 并阻断冲突 |
| MCP server token 泄漏到日志 | 凭证泄露 | env allowlist + redacted summary + 禁止输出 headers |
| server 进程泄漏 | 后台占用端口/资源 | app quit cleanup + idle timeout + forced kill |

## 19. 文档与验收

实现完成后需要补齐：

- `docs/opencode-support/README.md`
- opencode runtime development checklist
- next-session prompt
- smoke test 记录
- SDK/CLI 升级兼容记录
- 故障排查

公开 `README.md` / `AGENTS.md` 只有在用户允许后再同步。

### 19.1 最终验收清单

- opencode runtime feature flag 关闭时，Claude Code / Codex 全部现有测试通过。
- feature flag 开启时，settings 可选择 opencode，但默认不强制迁移旧 session。
- opencode server 只监听 `127.0.0.1`，启用 Basic Auth，no CORS。
- 所有长期配置文件 secretless。
- runtime event log 可重放 opencode 历史 transcript。
- permission reject / once / session allow 均可走通。
- stop、resume、reload、packaged binary 都有 smoke 证据。
- 文档记录已知限制，尤其是 native auth、channel auth、MCP OAuth 与 packaged 多平台验证范围。

### 19.2 后续演进方向

首版完成后再考虑：

- Runtime Profile 抽象，把 Codex/opencode settings 统一成 profile 列表。
- Runtime diagnostics 面板，展示 server、binary、provider、MCP 和 permission policy 状态。
- opencode remote MCP OAuth 由 CodeInsights 代理 callback。
- 支持 opencode custom tools / plugins 的 workspace UI。
- Pipeline 节点复用 opencode runtime，成为 Claude/Codex/opencode 可选执行器。

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
