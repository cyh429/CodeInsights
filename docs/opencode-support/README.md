# opencode Support 文档索引

本目录用于沉淀 CodeInsights Agent 模式接入 opencode runtime 的设计、开发进度、状态同步和后续兼容性说明。

## 当前主文档

- [Agent 模式 opencode Runtime 接入开发方案](./2026-05-27-agent-opencode-runtime-integration-plan.md)
- [Agent 模式 opencode Runtime 开发进度清单](./2026-05-27-agent-opencode-runtime-development-checklist.md)
- [Agent opencode Runtime 下次启动提示词](./next-session-prompt.md)

## 最新状态

更新时间：2026-05-27，Phase 1 契约冻结完成时

- 已完成：
  - 需求理解：CodeInsights 的目标是成为多 Coding Agent runtime 代理层，不重新实现 Agent 能力。
  - 主方案：已完成 opencode runtime 接入方案，并明确主路径是 managed `opencode serve` + `@opencode-ai/sdk` client。
  - 方案深化：已补齐 server lifecycle、secretless config、provider/MCP/permission 映射、event adapter、run/resume/stop、打包、UI、smoke 和风险细节。
  - 开发进度清单：已建立 Phase 0-8 的跟踪清单、产品/安全门禁、提交纪律、Smoke 矩阵和风险跟踪。
  - 工作流纪律：已把“阶段完成即提交、重启会话自动检查未提交阶段成果、提交信息使用详细中文”写入 `tasks/lessons.md`。
  - 状态入口：本文件与 `next-session-prompt.md` 已补齐，后续每个阶段收尾都要同步。
  - Phase 0：已用真实命令确认 opencode npm 包结构、server/API、SDK 返回形态、config/provider/MCP placeholder、permission body 和 binary 路径。
  - Phase 0 状态同步：已把真实提交基线、完成/未完成清单和下次启动提示词同步到 support 文档。
  - Phase 1：已完成 shared/settings/IPC 契约冻结。Agent 模式现在可在类型、settings、runtime selection 和诊断 IPC 层表达 `opencode` runtime；未实现 runtime core/server。
- 已提交：
  - `094d911d docs(agent): 完成 opencode Runtime 接入方案`
  - `06c62406 docs(agent): 深化 opencode Runtime 接入方案`
  - `4544b64a docs(agent): 建立 opencode Runtime 开发进度清单`
  - `19b5a71d docs(workflow): 强化阶段提交纪律`
  - `bbe8a80c docs(agent): 同步 opencode Runtime 最新状态`
  - `63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike`
  - `668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态`
  - `f4ac7325 feat(agent): 完成 opencode Runtime Phase 1 契约冻结`
  - Phase 1 后状态同步提交完成后，以 `git log -1 --oneline` 看到的本文件所在提交或其后的提交为最新基线。
- 已确认的关键设计：
  - opencode 是完整 Coding Agent Runtime，不是普通模型 Provider。
  - CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
  - 首版使用 feature flag：`CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1`。
  - `opencode run --format json` 只作为 smoke / fallback，不作为长期主路径。
  - 长期落盘配置必须 secretless，API key / token / Basic Auth password 不写入仓库或长期配置文件。
  - `opencode serve --port 0` 实测不会随机分配端口，而是绑定默认 `4096`；CodeInsights 必须自行分配空闲端口后显式传入。
  - SDK v1 `client.session.promptAsync()` 默认返回 `{ data, request, response }` fields 风格，204 时 `data` 是 `{}`；`event.subscribe()` 返回 `{ stream }`，Basic Auth header 必须通过 SDK config/调用 options 传入。
  - permission v1 响应 body 是 `{ response: "once" | "always" | "reject" }`，SDK 类型没有 `remember`；v2 新主路径是 `GET /permission` 与 `POST /permission/{requestID}/reply`。
  - `{env:VAR}` 可用于 provider `options.apiKey`、local MCP `environment` 和 remote MCP `headers`，但 resolved `/config`、`/provider`、`/config/providers` 会暴露替换后的 secret，日志和持久化必须脱敏或避免读取原样响应。
- 未完成：
  - Phase 2：opencode runtime core。
  - Phase 3：opencode event adapter。
  - Phase 4：runtime mock、registry 和 orchestrator routing。
  - Phase 5：真实 `opencode serve` 集成。
  - Phase 6：renderer 设置、权限交互和历史回放。
  - Phase 7：MCP、packaged binary 和 release readiness。
  - Phase 8：真实使用验收、故障排查、发布说明和公开文档同步准备。
- 下一步：
  - 从 Phase 2 开始，先实现不依赖真实模型的 opencode runtime core：binary/env/auth/config/server/client 基础设施。
  - Phase 2 不进入 renderer UI 或真实模型验收。
  - 所有 config / diagnostics 继续保持 secretless，避免记录 resolved provider/config 中的 secret。
- 暂缓 / 需要决策：
  - 默认认证来源：推荐 native opencode auth 优先，channel auth 显式选择。
  - channel auth 是否写入 opencode auth storage：推荐不写入，只用 env placeholder。
  - `bypassPermissions` 是否暴露：推荐首版不公开，即使启用也保留 Git guard。
  - native auth 是否隔离 HOME：推荐首版复用 opencode 原生全局 auth。
  - MCP OAuth 是否由 CodeInsights 代理：推荐首版不代理，只复用 opencode native OAuth。
  - 根 `README.md` / `AGENTS.md` 是否同步：用户明确允许后再改。

## 下次启动入口

下次启动时直接使用 [Agent opencode Runtime 下次启动提示词](./next-session-prompt.md)。

启动后先做四件事：

1. 读取项目指令和 `tasks/lessons.md`。
2. 运行 `git status --short` 和 `git log -3 --oneline`，确认最新基线。
3. 读取开发清单的“最新开发状态快照”和 Phase 2。
4. 在 `tasks/todo.md` 写入 Phase 2 计划，然后开始 opencode runtime core 实现。

## 设计定位

opencode 在 CodeInsights 中应作为第三个 Coding Agent Runtime 接入，和 Claude Code / Codex 处在同一层级。CodeInsights 负责桌面产品层、会话、工作区、配置、事件可视化、权限 UI、审计和本地存储；底层 Agent 能力由完整 opencode runtime 提供。

## 后续建议拆分文档

- opencode SDK / CLI 升级兼容记录。
- opencode server lifecycle 和 Basic Auth 管理记录。
- opencode config / provider / auth source 映射记录。
- opencode permission policy 与 CodeInsights UI 映射记录。
- opencode MCP secretless 注入与 OAuth 行为记录。
- opencode packaged binary 多平台验证记录。
- opencode runtime 真实 smoke test 记录。
