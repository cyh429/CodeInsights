# Agent 模式 opencode Runtime 开发进度清单

状态：Phase 3 已完成，runtime mock / orchestrator routing 未开始
日期：2026-05-27
主方案：[Agent 模式 opencode Runtime 接入开发方案](./2026-05-27-agent-opencode-runtime-integration-plan.md)
适用范围：CodeInsights Electron Agent 模式新增 `opencode` Coding Agent Runtime

## 0. 使用方式

本清单用于跟踪 Agent 模式接入 opencode runtime 的迭代开发进度。后续开发必须按阶段推进：每个阶段开始前确认范围，完成后更新 checkbox、补充验证证据、在 `tasks/todo.md` 追加阶段 Review，并按项目纪律单独提交该阶段成果。

状态约定：

- `[ ]` 未开始
- `[~]` 进行中，阶段提交前必须改回 `[ ]`、`[x]` 或 `[!]`
- `[x]` 已完成并通过该阶段验收
- `[!]` 阻塞，需要外部凭证、用户决策或上游 runtime 行为确认

执行原则：

- opencode 是完整 Coding Agent runtime，不是普通模型 Provider。
- CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless。
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` 未开启时，Claude Code / Codex 行为必须保持不变。
- 每个阶段只提交该阶段相关文件，不提交打包产物、临时 smoke 目录、`.DS_Store` 或无关改动。
- 根 `README.md` / `AGENTS.md` 只有在用户明确允许后再同步。

## 0.1 最新开发状态快照

更新时间：2026-05-27，Phase 3 最新启动基线补写完成时

当前结论：

- [x] opencode 接入主方案已完成并提交：`094d911d docs(agent): 完成 opencode Runtime 接入方案`。
- [x] opencode 接入主方案已深化并提交：`06c62406 docs(agent): 深化 opencode Runtime 接入方案`。
- [x] 主路径决策已明确：managed `opencode serve` + `@opencode-ai/sdk` client；`opencode run --format json` 仅作 smoke / fallback。
- [x] npm 包调研已确认：`@opencode-ai/sdk@1.15.11`、`opencode-ai@1.15.11`；`opencode` 和 `@opencode-ai/cli` 包名不可用。
- [x] Phase 0 真实 spike 已完成：npm 元数据、临时安装、binary、server health/SSE、SDK response shape、session/prompt_async、permission body、config/provider/MCP placeholder 均已确认。
- [x] Phase 0 关键修正已写回主方案：`--port 0` 不作为随机端口；permission v1 无 `remember`；v2 permission reply 是新主路径；resolved config/provider API 会暴露 env 替换后的 secret，不能原样记录。
- [x] Phase 0 已单独提交：`63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike`。
- [x] 开发进度清单已创建并提交：`4544b64a docs(agent): 建立 opencode Runtime 开发进度清单`。
- [x] 阶段提交纪律已强化并提交：`19b5a71d docs(workflow): 强化阶段提交纪律`。
- [x] Support README 与 next-session prompt 已补齐并同步：`668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态`。
- [x] Phase 0 依赖 spike 与基线冻结已完成。
- [x] Phase 1 共享类型与 settings 契约已完成：shared/runtime events/settings/IPC/runtime selection 均可表达 `opencode`，且未进入 runtime core/server 实现。
- [x] Phase 1 已单独提交：`f4ac7325 feat(agent): 完成 opencode Runtime Phase 1 契约冻结`。
- [x] Phase 1 后状态同步已单独提交：`a793172c docs(agent): 同步 opencode Phase 1 后续开发状态`。
- [x] Phase 1 最新启动基线已固化：`5c110ae1 docs(agent): 固化 opencode Phase 1 最新启动基线`。
- [x] Phase 2 opencode runtime core 已完成：binary/env/auth/config/MCP/server manager/client wrapper 均有不依赖真实模型的单测覆盖。
- [x] Phase 2 按受影响包规则提升 `@codeinsights/electron` patch 版本到 `0.0.114`。
- [x] Phase 2 后状态同步已单独提交：`d6768e0e docs(agent): 同步 opencode Phase 2 后续开发状态`。
- [x] Phase 2 最新启动基线已固化：`daa0795a docs(agent): 固化 opencode Phase 2 最新开发状态`。
- [x] Phase 3 event adapter 已完成：纯状态机 adapter、opencode fixtures、recovered metadata 和错误分类 mapping 均已通过单测。
- [x] Phase 3 按受影响包规则提升 `@codeinsights/shared` patch 版本到 `0.1.46`，提升 `@codeinsights/electron` patch 版本到 `0.0.115`。
- [x] Phase 3 已单独提交：`7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter`。
- [x] Phase 3 后状态同步已单独提交：`d2b718ad docs(agent): 同步 opencode Phase 3 后续开发状态`。
- [x] Phase 3 最新启动基线已固化：真实开发基线为 `bdef679f docs(agent): 固化 opencode Phase 3 最新启动基线`。
- [ ] Phase 4 runtime mock / orchestrator routing 未开始。
- [ ] Phase 5 真实 opencode server 集成未开始。
- [ ] Phase 6 renderer / UX 接入未开始。
- [ ] Phase 7 MCP / packaged / release readiness 未开始。
- [ ] Phase 8 真实使用验收与长期文档未开始。

当前仓库状态要求：

- 下次启动先运行 `git status --short` 和 `git log -3 --oneline`。
- 预期最新开发基线为 `bdef679f docs(agent): 固化 opencode Phase 3 最新启动基线`；其父级状态同步提交为 `d2b718ad docs(agent): 同步 opencode Phase 3 后续开发状态`。
- 若有无关用户改动，不要回滚；先辨认是否影响当前 Phase。
- 如果看到 `apps/electron/out/` 或其他打包产物，不默认 stage / commit。
- 每完成一个 Phase，必须先运行该 Phase 的验证，再单独提交。
- 每个阶段收尾时同步本清单、`docs/opencode-support/README.md` 和 `docs/opencode-support/next-session-prompt.md`，确保下次启动能直接接上。

下一步入口：

1. 确认 Phase 3 实现提交与 Phase 3 后状态同步均已提交。
2. 进入 Phase 4，开始 runtime mock、registry 和 orchestrator routing。
3. 不要直接跳到 renderer UI 或真实模型验收；Phase 4 先完成 mock runtime、session binding、event log 与 history replay。

## 0.2 当前完成/未完成总览

| 类别 | 状态 | 说明 |
| --- | --- | --- |
| 需求理解 | [x] | 已明确 CodeInsights 是多 Coding Agent runtime 代理层 |
| 主方案 | [x] | 已覆盖架构、配置、权限、MCP、event adapter、run 算法、UI、smoke、风险 |
| 开发清单 | [x] | 本文件已创建并通过文档验证 |
| Support README | [x] | 已补齐 opencode support 状态索引 |
| Next-session prompt | [x] | 已补齐下次启动可复制提示词 |
| Phase 0 | [x] | 依赖 spike 与基线冻结已完成 |
| Phase 1 | [x] | shared/settings/IPC 契约已完成，未实现 runtime core |
| Phase 2 | [x] | opencode binary/env/config/server/client core |
| Phase 3 | [x] | event adapter 与 fixtures |
| Phase 4 | [ ] | runtime mock、registry、orchestrator routing |
| Phase 5 | [ ] | 真实 `opencode serve` 集成 |
| Phase 6 | [ ] | renderer 设置、权限交互、历史回放 |
| Phase 7 | [ ] | MCP、packaged binary、release readiness |
| Phase 8 | [ ] | 真实验收、故障排查、公开文档同步准备 |

## 0.3 阶段提交纪律

每个 Phase 完成后：

- [ ] 更新本清单对应 checkbox 和验证记录。
- [ ] 在 `tasks/todo.md` 追加阶段 Review。
- [ ] 运行该阶段要求的验证命令。
- [ ] 运行 `git status --short`，确认只包含本阶段相关文件。
- [ ] 单独提交，提交信息用中文说明阶段成果、验证结果、未包含内容。

提交边界：

- 文档阶段只提交 `docs/opencode-support/**` 和 `tasks/todo.md`。
- shared 契约阶段只提交 `packages/shared/**`、必要 Electron settings / preload / IPC 类型文件、测试和任务记录。
- runtime core 阶段只提交 `apps/electron/src/main/lib/opencode-runtime/**`、相关 tests、依赖配置和任务记录。
- renderer 阶段只提交 renderer / preload / IPC 相关文件、测试和任务记录。
- packaged / smoke 阶段不提交生成的 `out/`、DMG、临时配置目录或真实凭证文件。

## 1. 产品与安全决策门禁

这些门禁未明确前，不进入公开 UI 默认可用或真实发布阶段。

| 状态 | 决策项 | 推荐值 | 阶段影响 |
| --- | --- | --- | --- |
| [x] | 主接入方式 | managed `opencode serve` + SDK client | Phase 2-5 |
| [x] | CLI `run --format json` 定位 | smoke / fallback，不作主路径 | Phase 5 |
| [x] | feature flag | `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` | Phase 1-6 |
| [ ] | 默认认证来源 | native opencode auth 优先，channel auth 显式选择 | Phase 6 |
| [x] | channel auth 是否写入 opencode auth storage | 否，只用 env placeholder；Phase 0 已确认 provider/MCP env placeholder 可行 | Phase 2 / Phase 5 |
| [ ] | `bypassPermissions` 是否暴露 | 首版不公开；即使启用也保留 Git guard | Phase 6 |
| [ ] | native auth 是否隔离 HOME | 首版复用 opencode 原生全局 auth | Phase 5 |
| [ ] | MCP OAuth 是否由 CodeInsights 代理 | 首版不代理，只复用 opencode native OAuth | Phase 7 |
| [ ] | 根 README / AGENTS 是否同步 | 用户明确允许后再改 | Phase 8 |

门禁验收：

- [ ] 决策写回本清单或主方案。
- [ ] settings 默认值和 UI 文案与门禁一致。
- [ ] 若用户选择非推荐值，补充风险说明和新增测试项。

## 2. Phase 0：方案冻结与依赖 spike

目标：把 opencode 的 npm 包结构、Server API、SDK 返回形态、配置优先级和权限/MCP 行为用真实命令确认，冻结实现前提。

依赖：主方案和本清单已提交。

任务：

- [x] 记录启动基线：`git status --short`、`git log -3 --oneline`。
- [x] 确认当前 Bun / Electron / TypeScript 版本和项目命令仍可运行。
- [x] 查询并记录 `@opencode-ai/sdk` 版本、dependencies、dist-tags。
- [x] 查询并记录 `opencode-ai` 版本、bin、optionalDependencies。
- [x] 确认 `npm view opencode` 和 `npm view @opencode-ai/cli` 仍为 404，并记录为包名不可用。
- [x] 在临时分支或临时目录安装 opencode 依赖，不污染业务实现提交。
- [x] 实测 `opencode --version`。
- [x] 实测 `opencode serve --hostname 127.0.0.1 --port <free-port>`。
- [x] 实测 `OPENCODE_SERVER_PASSWORD` Basic Auth。
- [x] 实测 `/global/health` 返回结构。
- [x] 实测 `/event` 首包 `server.connected`。
- [x] 实测 `@opencode-ai/sdk createOpencodeClient()` 返回结构，确认 `.data` / `.stream` 访问方式。
- [x] 实测 `event.subscribe()` async iterator / stream 结构。
- [x] 实测 `POST /session` body 与返回 session id。
- [x] 实测 `POST /session/:id/prompt_async` body 字段名和 204 返回。
- [x] 实测 `POST /session/:id/permissions/:permissionID` body；SDK v1 类型为 `{ response }`，没有 `remember`。
- [x] 实测 `OPENCODE_CONFIG`、`OPENCODE_CONFIG_DIR`、`OPENCODE_CONFIG_CONTENT` 优先级。
- [x] 实测 provider config 使用 `{env:VAR}` 注入 `options.apiKey`。
- [x] 实测 OpenAI-compatible provider 使用 `@ai-sdk/openai-compatible` / `@ai-sdk/openai` 的区别。
- [x] 实测 local MCP `environment` 是否支持 `{env:VAR}`。
- [x] 实测 remote MCP `headers` 是否支持 `{env:VAR}`。
- [x] 实测 `enabled_providers` 对 custom provider 的行为。
- [x] 实测 resolved config 可检测 CodeInsights inline policy 覆盖结果；系统级 managed preferences 未模拟，Phase 5 smoke 继续保留检测。
- [x] 记录 opencode platform binary 的真实路径和可执行权限。
- [x] 明确 Electron packaged 场景需要包含的 package 列表。

验证：

```bash
npm view @opencode-ai/sdk version dependencies dist-tags --json
npm view opencode-ai version optionalDependencies bin dist-tags --json
npm view opencode version --json
npm view @opencode-ai/cli version --json
bun run typecheck
bun test --isolate
git diff --check
```

退出标准：

- [x] 所有 spike 结论写入本清单或主方案。
- [x] 已确认 SDK method / response 访问方式，不再靠猜字段。
- [x] 已确认 channel auth 不需要写入 opencode auth storage。
- [x] 已确认 MCP secret 注入策略可走 env placeholder。
- [x] 未改业务行为，仅有 spike 文档和任务记录更新。
- [x] Phase 0 单独提交完成：`63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike`。

### 2.1 Phase 0 验证记录

- 启动基线：`git status --short` 为空，`git log -3 --oneline` 最新为 `bbe8a80c docs(agent): 同步 opencode Runtime 最新状态`。
- 完成提交：`63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike`。
- 项目版本：Bun `1.3.13`；Electron 依赖 `^39.5.1`；TypeScript 依赖 `^5.0.0`。
- npm 元数据：`@opencode-ai/sdk@1.15.11` 依赖 `cross-spawn@7.0.6`；`opencode-ai@1.15.11` 暴露 bin `opencode -> ./bin/opencode.exe`，optional packages 包含 `opencode-darwin-arm64`、`opencode-darwin-x64`、`opencode-darwin-x64-baseline`、Linux glibc/musl/baseline、Windows x64/arm64 等。
- 包名不可用：`npm view opencode version --json` 和 `npm view @opencode-ai/cli version --json` 均返回 npm `E404`。
- 临时安装目录：`/tmp/codeinsights-opencode-phase0-main`；没有修改仓库 `package.json`、`bun.lock` 或业务代码。
- binary：当前 darwin-arm64 平台安装后 `node_modules/opencode-ai/bin/opencode.exe` 是 0755 Mach-O arm64，可执行并输出 `1.15.11`；它与 `node_modules/opencode-darwin-arm64/bin/opencode` 是同内容/同 inode hard link。Electron packaged 需要包含 `opencode-ai` 主包和目标平台 `opencode-{platform}-{arch}` optional packages。
- server：`opencode serve --hostname 127.0.0.1 --port <free-port> --pure` 可启动；`OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME` 开启 Basic Auth，无认证和错误认证均为 401，正确认证的 `GET /global/health` 返回 `{ healthy: true, version: "1.15.11" }`。
- 端口：`opencode serve --help` 显示 `--port` 默认 0，但实测不传端口或传 `--port 0` 会监听默认 `4096`；CodeInsights 必须自行找 free port 并显式传入。
- SSE：`GET /event` 首包是 `data: {"id":"evt_...","type":"server.connected","properties":{}}`；SDK `event.subscribe()` 返回 `{ stream }`，需要显式把 Basic Auth header 放进 SDK config 或调用 options。
- SDK response：`createOpencodeClient()` 默认 `responseStyle: "fields"`，普通请求返回 `{ data, request, response }` 或 `{ error, request, response }`；`responseStyle: "data"` 时直接返回 data。`session.create()` 返回 `Session`，`session.promptAsync()` 调用 `POST /session/{id}/prompt_async`，204 时 fields 风格 `data` 为 `{}`，HTTP 直连 body 为空。
- session API：`POST /session` 可无模型创建 session，返回 id 前缀 `ses_`；`prompt_async` body 使用 `model: { providerID, modelID }`、`agent`、`noReply`、`system`、`tools`、`parts`。
- permission API：SDK v1 没有 `client.permission`，根方法是 `client.postSessionIdPermissionsPermissionId()`；body 为 `{ response: "once" | "always" | "reject" }`，响应 200 boolean。SDK v2 新主路径包含 `permission.list()` 和 `permission.reply({ requestID, reply?, message? })`，旧 session permission endpoint 为兼容路径。`remember` 不在生成类型中，首版不能依赖。
- config：`OPENCODE_CONFIG` 会加载指定 JSON/JSONC；`OPENCODE_CONFIG_DIR` 既能承载 assets，也会加载目录下 `opencode.json` / `opencode.jsonc`；`OPENCODE_CONFIG_CONTENT` 会覆盖 scalar/array，同名 object/map 按 key 合并。`/config` 返回 resolved config，可用于检测 inline policy 是否生效。
- secret 安全：`{env:VAR}` 会被替换成真实 env 值；替换后的值会出现在 `/config`、`/provider`、`/config/providers` 响应中，包括 provider key / `options.apiKey`。CodeInsights 不得把这些响应原样写入日志、event log 或长期诊断文件。
- provider：`@ai-sdk/openai-compatible` 和 `@ai-sdk/openai` 都可作为 custom provider `npm` 值被加载；无真实模型请求时只能确认配置可加载，协议差异仍由目标端点类型决定。`enabled_providers` 会过滤 `/provider` 和 `/config/providers` 的 provider 列表，但不会清理 `/config.provider` 原始 map。`provider.connected` 不能作为凭证有效性的强信号。
- MCP：local MCP `environment` 与 remote MCP `headers` 均支持 `{env:VAR}`，实测子进程 env 和 fake remote header 会收到替换后的值。因为 resolved API 会暴露替换后 secret，MCP 诊断也必须只输出 server 名、状态和脱敏摘要。

回滚点：

- 如果 SDK / Server API 与方案差异大，停止进入 Phase 1，先更新主方案。
- 如果 local MCP secret 不能安全注入，标记 Phase 7 MCP secret 为 `[!]`，首版跳过带 secret MCP。

## 3. Phase 1：共享类型、设置与 IPC 契约

目标：让 shared 类型、settings 和 IPC 能表达 `opencode` runtime，但 feature flag 关闭时不改变现有行为。

依赖：Phase 0 完成。

预期改动范围：

- `packages/shared/src/types/agent.ts`
- `packages/shared/src/agent/runtime-events.ts`
- `apps/electron/src/main/lib/settings-service.ts`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`
- 必要的 preload / renderer settings 类型
- 对应测试文件

任务：

- [x] `CodingAgentRuntimeKind` 增加 `'opencode'`。
- [x] `AgentEventSource` 增加 `'opencode_server'` 和 `'opencode_cli'`。
- [x] 增加或扩展 runtime event metadata：`runtimeKind`、`runId`、`externalSessionId`、`externalMessageId`、`externalPartId`、`sequence`、`occurredAt`。
- [x] 扩展 `AgentRuntimeSessionRef` 或 runtime manifest 类型，支持 `agent`、`runtimeConfigHash`、`authSourceHash`。
- [x] 扩展 `AppSettings`：`agentOpencodeChannelId`、`agentOpencodeModelId`、`agentOpencodeAgentName`、`agentOpencodeUseNativeAuth`、`agentOpencodeAutoupdate`、`agentOpencodeSnapshotEnabled`。
- [x] settings normalization 区分 `null` 和 `undefined` 的 auth source 语义。
- [x] feature flag 未启用时，settings 中的 opencode 字段不触发 runtime 切换。
- [x] 增加 runtime capabilities 中立字段，不把 Codex 专用 helper 复制成 opencode 专用分支。
- [x] 设计诊断 IPC：runtime capabilities、opencode server status、opencode model refresh。
- [x] 补充 runtime selection 测试：新 session、旧 session、feature flag on/off。
- [x] 补充 settings migration / normalization 测试。

验证：

```bash
bun test packages/shared
bun test apps/electron/src/main/lib/settings-service.test.ts
bun test apps/electron/src/main/lib/agent-runtimes
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron/src/main apps/electron/src/preload apps/electron/src/renderer tasks/todo.md docs/opencode-support
```

退出标准：

- [x] feature flag 关闭时，现有 Claude Code / Codex tests 不变。
- [x] shared 类型可表达 opencode runtime。
- [x] settings 可保存和读取 opencode 字段，且不保存 transient server secret。
- [x] Phase 1 单独提交完成。

### 3.1 Phase 1 验证记录

- 启动基线：`git status --short` 为空，`git log -3 --oneline` 最新为 `668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态`。
- 完成提交：`f4ac7325 feat(agent): 完成 opencode Runtime Phase 1 契约冻结`。
- 契约范围：shared runtime kind / event source / event metadata / session snapshot、settings normalization、runtime selection、diagnostic IPC、preload / renderer settings 类型已完成。
- Runtime binding 修正：`agent-session-manager` 已改为保留非 Claude Code runtime 的 `runtimeSession`，避免未来 opencode session snapshot 被 normalization 丢弃。
- Feature flag 行为：registry 默认只启用 `claude-code` / `codex`；settings 中的 `opencode` 在未传入 enabled runtime kinds 时回退为 Claude Code；已绑定 opencode session 仍按 session binding 返回。
- 保持边界：未安装 opencode 依赖，未实现 opencode runtime core/server/event adapter/UI，未修改根 `README.md` / `AGENTS.md`。
- 验证通过：
  - `bun test packages/shared`
  - `bun test apps/electron/src/main/lib/settings-service.test.ts`
  - `bun test apps/electron/src/main/lib/agent-runtimes`
  - `bun test apps/electron/src/main/lib/agent-session-manager.test.ts`
  - `bun test apps/electron/src/renderer/lib/agent-runtime-ui.test.ts`
  - `bun run --filter='@codeinsights/electron' typecheck`
  - `git diff --check -- packages/shared apps/electron/src/main apps/electron/src/preload apps/electron/src/renderer tasks/todo.md docs/opencode-support`

回滚点：

- 类型扩展破坏现有 session JSON 读取时，优先补 runtime schema fallback，而不是改历史数据。

## 4. Phase 2：opencode Runtime Core

目标：实现不依赖真实模型的 opencode core 基础设施：binary/env/auth/config/MCP/server manager/client wrapper。

依赖：Phase 1 完成。

预期新增模块：

```text
apps/electron/src/main/lib/opencode-runtime/
├── opencode-auth.ts
├── opencode-binary.ts
├── opencode-config.ts
├── opencode-env.ts
├── opencode-mcp-config.ts
├── opencode-sdk-client.ts
├── opencode-server-manager.ts
└── index.ts
```

任务：

- [x] 实现 `resolveOpencodeCliPath()`，支持 custom path、packaged path、dev node_modules path。
- [x] 实现 binary version 检测和 source 标记：`bundled` / `workspace` / `custom` / `system-path`。
- [x] 实现 env allowlist，保留必要 `PATH` / `HOME` / `SHELL`，过滤危险变量。
- [x] 实现 channel secret env scoped name 生成，不输出 secret。
- [x] 实现 native auth / channel auth / smoke auth source fingerprint。
- [x] 实现 `authSourceHash`，只存 secret hash 前缀。
- [x] 实现 secretless config builder。
- [x] 实现 `OPENCODE_CONFIG_CONTENT` inline policy builder。
- [x] 实现 `OPENCODE_CONFIG_DIR` 私有 agents / commands / plugins / skills / tools 目录生成。
- [x] 实现 atomic write，目录 `0700`，文件 `0600`。
- [x] 实现 symlink / realpath 安全检查。
- [x] 实现 provider config builder：native auth、channel auth、custom OpenAI-compatible provider。
- [x] 实现 `enabled_providers` 生成策略。
- [x] 实现 permission policy builder。
- [x] 实现 MCP config builder，支持 local / remote / OAuth placeholder。
- [x] 实现 MCP name sanitize 和冲突检测。
- [x] 实现 `OpencodeServerManager` 状态机：idle / starting / healthy / degraded / stopping / stopped / failed。
- [x] 实现 server key、并发 ensure promise、health timeout、Basic Auth、idle close、app quit cleanup。
- [x] 实现 `createOpencodeClient` wrapper，注入 Basic Auth fetch、timeout、错误分类、redacted request logs。
- [x] 单测覆盖 config 不含 secret。
- [x] 单测覆盖 env 不能覆盖 Git guard / proxy / OPENCODE / CODEINSIGHTS 保留变量。
- [x] 单测覆盖 server lifecycle fake executor。

验证：

```bash
bun test apps/electron/src/main/lib/opencode-runtime
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- apps/electron/src/main/lib/opencode-runtime apps/electron/package.json electron-builder.yml tasks/todo.md docs/opencode-support
```

退出标准：

- [x] 不启动真实模型即可通过 core 单测。
- [x] 所有 redacted summary 不含 API key、Basic Auth password、MCP token。
- [x] server manager fake 测试覆盖启动、失败、停止、清理。
- [x] Phase 2 单独提交完成。

回滚点：

- 如果 package binary 解析不稳定，保留 custom path 开关和 clear error，不进入 Phase 5。

### 4.1 Phase 2 验证记录

- 启动基线：`git status --short` 为空，`git log -3 --oneline` 最新为 `5c110ae1 docs(agent): 固化 opencode Phase 1 最新启动基线`。
- 改动范围：新增 `apps/electron/src/main/lib/opencode-runtime/**` core 模块与测试；`apps/electron/package.json` patch 版本提升到 `0.0.114`；同步本清单、support README、next-session prompt 和 `tasks/todo.md`。
- 完成内容：binary/env/auth/config/MCP/server manager/client wrapper 基础设施；全部使用本地接口和 fake executor，不依赖真实模型、真实 opencode server 或未安装 SDK。
- 安全结果：长期 config、inline policy、redacted summary 均不包含 API key、Bearer token、Basic Auth password、MCP secret；MCP 与 channel secret 只经 scoped env name 间接注入。
- 验证通过：
  - `bun test apps/electron/src/main/lib/opencode-runtime`
  - `bun run --filter='@codeinsights/electron' typecheck`
  - `git diff --check -- apps/electron/src/main/lib/opencode-runtime apps/electron/package.json electron-builder.yml tasks/todo.md docs/opencode-support`
  - opencode support Markdown code fence 与相对链接检查
- 保持边界：未安装 `@opencode-ai/sdk` / `opencode-ai`，未修改根 `README.md` / `AGENTS.md`，未进入 renderer UI、event adapter 完整映射、orchestrator routing 或真实模型验收，未修改 `electron-builder.yml`。
- 完成提交：`25bfec59 feat(agent): 完成 opencode Runtime Phase 2 Core 基础设施`。

## 5. Phase 3：opencode Event Adapter

目标：把 opencode SSE event / message part 稳定转换成 CodeInsights runtime event，支持去重、补读、终态控制。

依赖：Phase 2 完成。

预期改动范围：

- `apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.ts`
- `apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts`
- `apps/electron/src/main/lib/agent-runtimes/__fixtures__/opencode/**`
- 可能扩展 `packages/shared/src/agent/runtime-events.ts`

任务：

- [x] 定义 opencode raw event fixture 类型，不用 `any`。
- [x] fixture 覆盖 `server.connected`。
- [x] fixture 覆盖 `session.created` / `session.idle` / `session.error`。
- [x] fixture 覆盖 user message updated，确认不作为 assistant 输出。
- [x] fixture 覆盖 text delta。
- [x] fixture 覆盖 text snapshot completed。
- [x] fixture 覆盖 reasoning part。
- [x] fixture 覆盖 tool pending / running / completed / error。
- [x] fixture 覆盖 patch part。
- [x] fixture 覆盖 agent / subtask part。
- [x] fixture 覆盖 todo updated。
- [x] fixture 覆盖 permission updated / replied。
- [x] fixture 覆盖 abort / stopped。
- [x] 实现 `OpencodeEventAdapter` 纯状态机。
- [x] 实现 part-level text 累积，避免 delta / snapshot 重复。
- [x] 实现去重 key。
- [x] 实现 terminal single-write guard。
- [x] 实现 stop 后迟到 idle 改写或忽略。
- [x] 实现 recovered event metadata。
- [x] 实现错误分类 mapping。
- [x] 补充 runtime event validator 测试。

验证：

```bash
bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts
bun test packages/shared/src/agent/runtime-events.test.ts
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md docs/opencode-support
```

退出标准：

- [x] delta 与 snapshot 不重复显示。
- [x] permission ask / reply 可映射到现有 PermissionBanner 所需字段。
- [x] 同一 run 只产生一个 terminal event。
- [x] SSE 断开补读 fixture 能生成 recovered event。
- [x] Phase 3 单独提交完成。

回滚点：

- 如果 opencode event 结构比预期更复杂，先保守映射 text / tool / terminal / permission，不扩展 UI 展示。

### 5.1 Phase 3 验证记录

- 启动基线：`git status --short` 为空，`git log -3 --oneline` 最新为 `daa0795a docs(agent): 固化 opencode Phase 2 最新开发状态`。
- 完成提交：`7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter`。
- 改动范围：新增 `apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.ts`、`opencode-event-adapter.test.ts`、`__fixtures__/opencode-events/**`；扩展 shared runtime metadata `recovered?: boolean`；同步 `tasks/todo.md`；提升 `@codeinsights/shared` 到 `0.1.46`、`@codeinsights/electron` 到 `0.0.115`。
- 完成内容：opencode raw event / part 类型、纯状态机 adapter、event key 去重、part-level 文本累积、tool/task start/completion 去重、terminal single-write guard、stop 后迟到 success 屏蔽、recovered metadata、Provider/API/abort 等错误分类 mapping。
- 验证通过：
  - `bun test apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.test.ts`
  - `bun test packages/shared/src/agent/runtime-events.test.ts`
  - `bun run --filter='@codeinsights/electron' typecheck`
  - `git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md docs/opencode-support`
- 保持边界：未安装 `@opencode-ai/sdk` / `opencode-ai`，未进入 renderer UI、真实 `opencode serve` 集成、runtime registry / orchestrator routing 或真实模型验收，未修改根 `README.md` / `AGENTS.md`。

## 6. Phase 4：Runtime Mock 接入与 Orchestrator 路由

目标：在不启动真实 opencode server 的情况下，把 `OpencodeAgentRuntime` 接入 registry、orchestrator、session binding 和 event log。

依赖：Phase 3 完成。

预期改动范围：

- `apps/electron/src/main/lib/agent-runtimes/opencode-runtime.ts`
- `apps/electron/src/main/lib/agent-runtimes/opencode-permission-policy.ts`
- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`
- `apps/electron/src/main/lib/agent-orchestrator.ts`
- `apps/electron/src/main/lib/agent-runtime-event-log.ts`
- `apps/electron/src/main/lib/agent-session-manager.ts`
- 对应 tests

任务：

- [ ] 实现 `OpencodeAgentRuntime implements CodingAgentRuntime`。
- [ ] 注入 fake opencode client / fake server manager，支持 mock tests。
- [ ] registry feature flag 下注册 opencode runtime。
- [ ] runtime selection 支持 opencode settings。
- [ ] 新 session 首次运行写入 opencode manifest / session ref。
- [ ] 已绑定 opencode session resume 时不受当前 settings 污染。
- [ ] session manifest 缺失但 metadata 有 opencode ref 时阻断或给出兼容路径。
- [ ] stop 调用 opencode runtime abort，并使用 run token 防止迟到 finally。
- [ ] unsupported queue / permission mode switch 不污染 local state。
- [ ] event log 写入 opencode runtime events。
- [ ] history replay 能从 mock opencode events 生成 transcript。
- [ ] 补充 orchestrator routing tests。
- [ ] 补充 session binding tests。
- [ ] 补充 stop race tests。

验证：

```bash
bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts
bun test apps/electron/src/main/lib/agent-orchestrator.test.ts
bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts
bun test apps/electron/src/main/lib/agent-session-manager.test.ts
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- apps/electron/src/main/lib packages/shared tasks/todo.md docs/opencode-support
```

退出标准：

- [ ] feature flag 开启时 mock opencode run 可完成。
- [ ] feature flag 关闭时 opencode 不参与 runtime selection。
- [ ] session 首次绑定和 resume 行为有测试。
- [ ] stop 终态稳定为 `run_stopped`。
- [ ] Phase 4 单独提交完成。

回滚点：

- 如果 orchestrator 改动影响 Claude legacy path，立刻拆小改动或补 adapter 层，不继续扩散。

## 7. Phase 5：真实 opencode Server 集成

目标：启动真实 `opencode serve`，通过 SDK client 完成 server health、event subscribe、session create、prompt async、abort、permission response 的最小闭环。

依赖：Phase 4 完成。

任务：

- [ ] 添加 `@opencode-ai/sdk`、`opencode-ai` 和平台 optionalDependencies，安装前记录版本搜索结果。
- [ ] 调整 `apps/electron/package.json` build external。
- [ ] 实现真实 `OpencodeServerManager` spawn。
- [ ] 实现 Basic Auth fetch wrapper。
- [ ] 实现 `/global/health` smoke。
- [ ] 实现 `/event` subscribe smoke。
- [ ] 实现 session create smoke。
- [ ] 实现 prompt async readonly smoke，默认无凭证则 skipped。
- [ ] 实现 permission ask / reject / once smoke。
- [ ] 实现 abort smoke。
- [ ] 实现 resume smoke。
- [ ] 实现 config resolved smoke，确认 server hostname / cors / permission policy。
- [ ] 实现 channel auth smoke，显式 `OPENCODE_SMOKE_API_KEY`，不读取 ambient key。
- [ ] 实现 native auth smoke，复用用户 opencode auth 时不输出 auth 文件内容。
- [ ] 记录真实 opencode version / SDK version。
- [ ] 确认 `auth.set()` 不用于 channel key 持久化。
- [ ] 补充 smoke summary JSON 输出。

验证：

```bash
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only binary
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only server
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only config
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only permission
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only abort
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- apps/electron scripts docs/opencode-support tasks/todo.md
```

退出标准：

- [ ] 无真实模型时 binary / server / config / permission config smoke 可通过。
- [ ] 有 native auth 或显式 smoke key 时 readonly prompt smoke 可通过。
- [ ] smoke summary 不输出 API key、Basic Auth password、MCP token。
- [ ] server 退出后临时文件清理完成。
- [ ] Phase 5 单独提交完成。

回滚点：

- 如果真实 server API 与 Phase 0 spike 结论不一致，先更新 wrapper 和文档，不进入 renderer 阶段。

## 8. Phase 6：Renderer 设置、权限交互与历史回放

目标：让用户在 Agent 设置中选择 opencode runtime，并在 Agent UI 中看到 runtime badge、权限请求、错误诊断和历史回放。

依赖：Phase 5 完成。

预期改动范围：

- `apps/electron/src/renderer/atoms/**`
- `apps/electron/src/renderer/components/settings/**`
- `apps/electron/src/renderer/components/agent/**`
- `apps/electron/src/renderer/hooks/**`
- `apps/electron/src/preload/**`
- `apps/electron/src/main/ipc.ts`
- 对应 tests

任务：

- [ ] Agent Runtime 设置三选：Claude Code / Codex / opencode。
- [ ] feature flag 未启用时显示实验功能关闭态。
- [ ] opencode auth source UI：native auth / CodeInsights channel。
- [ ] opencode model 输入或 provider/model picker。
- [ ] opencode agent 选择：build / plan / custom。
- [ ] Server 状态显示：未启动 / 运行中 / 版本 / 最近错误。
- [ ] MCP 状态入口显示 `/mcp` 摘要。
- [ ] Agent Header runtime badge 显示 runtime/model/agent/permission。
- [ ] PermissionBanner 支持 opencode tool preview、cwd、risk label。
- [ ] PermissionBanner 支持 reject / once / session allow。
- [ ] 缺少 preview 时隐藏 session allow。
- [ ] 运行中 permission 切换显示“下次发送生效”。
- [ ] queue message 不支持时禁用或提示。
- [ ] 历史回放不依赖 opencode server 存活。
- [ ] reload 后 opencode transcript 仍可显示。
- [ ] binary missing / auth missing / model missing 错误可解释。
- [ ] Jotai atoms 保持现有状态管理方式，不引入新状态库。
- [ ] 补充 renderer tests。
- [ ] 补充 Electron / Playwright fixture smoke。

验证：

```bash
bun test apps/electron/src/renderer
bun test apps/electron/src/main/lib/agent-orchestrator.test.ts
bun run --filter='@codeinsights/electron' typecheck
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer
git diff --check -- apps/electron/src/renderer apps/electron/src/preload apps/electron/src/main tasks/todo.md docs/opencode-support
```

退出标准：

- [ ] UI 可保存和加载 opencode settings。
- [ ] runtime badge 和 permission interaction 可见。
- [ ] reload history smoke 通过。
- [ ] feature flag off 构建通过且不显示 opencode 可用态。
- [ ] Phase 6 单独提交完成。

回滚点：

- 如果 UI 变更影响 Agent 主消息区可用性，先隐藏 opencode 设置入口，保留 runtime core。

## 9. Phase 7：MCP、Packaged Binary 与发布准备

目标：完成 workspace MCP 到 opencode config 的安全映射、packaged app binary 验证、release readiness 和故障排查基础。

依赖：Phase 6 完成。

任务：

- [ ] workspace MCP local -> opencode `mcp.{name}.type = "local"`。
- [ ] workspace MCP remote -> opencode `mcp.{name}.type = "remote"`。
- [ ] remote headers 使用 `{env:VAR}`。
- [ ] local environment 使用 `{env:VAR}`，若 smoke 不通过则跳过 secret local MCP。
- [ ] OAuth MCP 首版只复用 opencode native OAuth 状态。
- [ ] `POST /mcp` 动态添加仅用于 smoke 或临时能力，不写入长期主路径。
- [ ] fake MCP tool discovery smoke。
- [ ] MCP config-only smoke。
- [ ] MCP tool-call smoke，如需真实模型则 gated。
- [ ] 更新 `electron-builder.yml` files，包含 `opencode-ai` 和目标 platform packages。
- [ ] packaged app binary smoke，证明不走系统 PATH。
- [ ] packaged app 启动 opencode server smoke。
- [ ] packaged reload history smoke。
- [ ] macOS arm64 packaged 验证。
- [ ] macOS x64 packaged 验证，如无 runner 则标记 `[!]`。
- [ ] Windows x64 packaged 验证，如无环境则标记 `[!]`。
- [ ] Linux packaged 验证按发布计划决定。
- [ ] 故障排查草稿：binary missing、server auth failed、provider auth missing、model not found、MCP auth failed、permission stuck、SSE interrupted。
- [ ] 发布说明草稿。

验证：

```bash
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' typecheck
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only packaged
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only mcp
git diff --check -- apps/electron electron-builder.yml docs/opencode-support tasks/todo.md
```

退出标准：

- [ ] packaged app 使用 bundled opencode binary。
- [ ] MCP secretless config smoke 通过。
- [ ] 至少一个平台 packaged smoke 通过。
- [ ] 多平台未验证项明确标记 `[!]`，不伪装为通过。
- [ ] Phase 7 单独提交完成。

回滚点：

- 如果 packaged binary 无法稳定包含，保留 dev-only feature flag，不进入公开发布。

## 10. Phase 8：真实使用验收、文档发布与长期维护

目标：完成真实 Agent 使用场景验收，补齐 support 文档索引、next-session prompt、故障排查、发布说明和长期维护记录。

依赖：Phase 7 完成。

真实验收场景：

- [ ] native auth readonly：使用本机 opencode auth，固定 prompt 返回短文本。
- [ ] channel auth readonly：使用显式 `OPENCODE_SMOKE_API_KEY`，不读取 ambient key。
- [ ] permission reject：诱导 bash / edit，拒绝后 run 继续或给出可解释失败。
- [ ] permission once：允许 `git status` 只读命令。
- [ ] session allow：仅当前 opencode session 生效，不写入长期规则。
- [ ] file edit：临时目录中修改受控文件，Git refs / index 不变。
- [ ] resume：同一 CodeInsights session 二次发送复用 opencode session id。
- [ ] stop：长任务能停止，最终态为 `run_stopped`。
- [ ] reload：app 重启后历史 transcript 不依赖 opencode server。
- [ ] MCP config-only：无 secret MCP 出现在 `/mcp`。
- [ ] MCP tool discovery：fake MCP tool list 可见。
- [ ] MCP tool-call：真实模型调用 MCP tool，如无凭证则 `[!]`。

文档任务：

- [ ] 新增 `docs/opencode-support/README.md`。
- [ ] 新增或更新 `docs/opencode-support/next-session-prompt.md`。
- [ ] 在 checklist 中记录所有真实 smoke 结果。
- [ ] 记录 SDK / CLI 升级兼容检查步骤。
- [ ] 记录已知限制。
- [ ] 记录故障排查。
- [ ] 写发布说明草稿。
- [ ] 如用户允许，同步根 `README.md` / `AGENTS.md`。

验证：

```bash
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run typecheck
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun test --isolate
CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run electron:build
git diff --check -- docs/opencode-support tasks/todo.md README.md AGENTS.md
```

退出标准：

- [ ] 真实验收场景结果全部记录为 passed / skipped / failed。
- [ ] skipped 必须有 reason。
- [ ] support README 和 next-session prompt 已同步最新 HEAD。
- [ ] 根文档只有用户允许后才改。
- [ ] Phase 8 单独提交完成。

回滚点：

- 如果真实模型或凭证缺失，只标记 gated smoke skipped，不阻塞无凭证可验证项。

## 11. Smoke 测试矩阵

| Smoke | 是否需要真实模型 | 是否需要凭证 | 阶段 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- |
| binary resolution | 否 | 否 | Phase 5 | [ ] | |
| server health | 否 | 否 | Phase 5 | [ ] | |
| Basic Auth | 否 | 否 | Phase 5 | [ ] | |
| config resolved | 否 | 否 | Phase 5 | [ ] | |
| permission config | 否 | 否 | Phase 5 | [ ] | |
| event subscribe | 否 | 否 | Phase 5 | [ ] | |
| readonly native auth | 是 | native auth | Phase 8 | [ ] | |
| readonly channel auth | 是 | `OPENCODE_SMOKE_API_KEY` | Phase 8 | [ ] | |
| permission reject | 可能 | 可能 | Phase 8 | [ ] | |
| permission once | 可能 | 可能 | Phase 8 | [ ] | |
| abort | 可能 | 可能 | Phase 5 / 8 | [ ] | |
| resume | 是 | native/channel | Phase 8 | [ ] | |
| file edit guarded | 是 | native/channel | Phase 8 | [ ] | |
| MCP config-only | 否 | 否 | Phase 7 | [ ] | |
| MCP tool discovery | 否 | 否 | Phase 7 | [ ] | |
| MCP tool-call | 是 | native/channel | Phase 8 | [ ] | |
| packaged binary | 否 | 否 | Phase 7 | [ ] | |
| packaged app reload | 否 | 否 | Phase 7 / 8 | [ ] | |

Smoke summary 规则：

- [ ] 输出 JSON summary。
- [ ] 每项状态只能是 `passed`、`failed`、`skipped`。
- [ ] `skipped` 必须有 reason。
- [ ] 不输出 API key、Basic Auth password、MCP token、auth 文件内容。
- [ ] binary path 可以输出，但按项目日志策略缩写 home 目录。

## 12. 风险跟踪

| 风险 | 阶段 | 状态 | 应对 |
| --- | --- | --- | --- |
| opencode SDK / Server API 与文档不一致 | Phase 0 / 5 | [ ] | Phase 0 spike 先确认，wrapper 隔离差异 |
| channel key 被写入 opencode auth storage | Phase 2 / 5 | [ ] | 禁止用 `auth.set()` 承载 channel key |
| local MCP secret 不能 env placeholder | Phase 0 / 7 | [ ] | 跳过或 0600 临时 config |
| opencode 默认 permission 偏宽 | Phase 2 / 5 | [ ] | 强制生成 permission policy |
| Git 操作污染用户仓库 | Phase 5 / 8 | [ ] | Git guard + refs/index 后验 |
| settings 改变污染旧会话 | Phase 1 / 4 | [ ] | runtime manifest 固化绑定 |
| SSE 丢事件或重复事件 | Phase 3 / 5 | [~] | Phase 3 已完成 adapter 去重与 recovered 补读 metadata；Phase 5 仍需真实 SSE smoke |
| stop 后迟到 success | Phase 3 / 4 | [~] | Phase 3 已完成 terminal single-write + stopped flag；Phase 4 仍需 orchestrator stop race |
| packaged binary 缺失 | Phase 7 | [ ] | electron-builder files + packaged smoke |
| server 进程泄漏 | Phase 2 / 5 | [ ] | app quit cleanup + idle timeout |
| managed config 覆盖安全策略 | Phase 0 / 5 | [ ] | smoke 检测 resolved config 并阻断 |
| Renderer 过度分叉 | Phase 6 | [ ] | 使用 runtime capabilities，不写 opencode 专用 message list |

## 13. 阶段记录模板

每完成一个 Phase，在对应阶段下追加：

```text
Phase N 执行记录：

- 分支：
- 起始提交：
- 完成提交：
- 改动范围：
- 验证命令：
- 验证结果：
- skipped 项：
- 已知限制：
- 下阶段入口：
```

## 14. 后续维护项

这些不阻塞首版，但需要在 Phase 8 或后续维护中评估：

- [ ] Runtime Profile 抽象，把 Claude Code / Codex / opencode settings 收敛成统一 profile 列表。
- [ ] Runtime diagnostics 面板，展示 binary、server、provider、MCP、permission policy。
- [ ] opencode remote MCP OAuth 由 CodeInsights 代理 callback。
- [ ] opencode custom tools / plugins workspace UI。
- [ ] Pipeline 节点支持选择 opencode runtime。
- [ ] 多平台 CI packaged smoke。
- [ ] SDK / CLI 定期升级复核 automation。

## 15. 参考

- 主方案：[Agent 模式 opencode Runtime 接入开发方案](./2026-05-27-agent-opencode-runtime-integration-plan.md)
- 当前仓库参考：`docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`
- 当前仓库参考：`apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`
- 当前仓库参考：`apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`
- 当前仓库参考：`apps/electron/src/main/lib/agent-runtime-event-log.ts`
