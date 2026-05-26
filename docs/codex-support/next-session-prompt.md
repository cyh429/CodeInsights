# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：codex/agent-codex-runtime-phase-0

当前状态：
- Phase 0 基线冻结已完成并提交：29e48a93。
- Phase 1 共享类型与设置契约已完成并提交：6127b46c。
- Phase 2 Codex Runtime Core 已完成并提交：f04d893c。
- Phase 3 Codex Event Adapter 已完成并提交：98914a42。
- Phase 4 CodexAgentRuntime Mock 接入已完成并提交：2c7ebb94。
- Phase 5 Orchestrator Runtime Routing 已完成并提交：40441fe8。
- Phase 6 Renderer 设置、历史与 UX 已完成并提交：58164e35。
- Phase 7 真实 Codex SDK / CLI 接入、打包验证、安全加固和 smoke 记录已完成并提交：1b94f9ad。
- Phase 7 smoke 补跑状态已同步并提交：a02cbbf5。
- 最新开发状态文档已固化：4e210364。
- Phase 7 native config 修正与成功路径补跑已完成并提交：a439d541。
- Phase 7 history reload fixture-based packaged UI reload smoke 已完成并提交：79c7fc92。新增 `smoke:agent-history-reload-ui`，通过 CDP 启动 packaged app 两次并确认真实 UI 展示 Codex 历史标题、用户消息和 assistant 消息；该验证覆盖重开读取与渲染，不替代真实 Codex 写入链路。
- Phase 7 CodeInsights workspace MCP 到 Codex 原生配置注入已完成：Agent Codex runtime 会把工作区 enabled stdio/http MCP 映射到 SDK `config.mcp_servers`；stdio env 使用 `env_vars`、HTTP headers 使用 `env_http_headers`，真实 secret 通过 Codex 子进程 env 间接注入，不进入 SDK `--config` argv；workspace MCP env 不能覆盖 Git guard/base env，HTTP header name 暂限 SDK-safe bare key；`smoke:agent-codex -- --only mcp` 的 `mcp.config-injection` 已通过，Codex CLI `mcp list --json` 可识别生成的 stdio/http 配置。
- 最新提交号以 `git log -1 --oneline` 为准，预期最新提交为本轮 MCP 注入提交或其后的状态同步提交。
- 2026-05-26 已修正 native smoke 隔离逻辑：复制主机 `~/.codex/auth.json` 时也复制同源 `config.toml`，保留中转 API `model_provider` / `base_url` 配置；同时不再默认强制 `modelReasoningEffort: "minimal"`，改为尊重 `config.toml`，仅在设置 `CODEX_SMOKE_REASONING_EFFORT` 时覆盖。
- Phase 7 native / read-only / workspace-write / resume / web-search / stop 成功路径已通过真实 smoke：native thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932`，read-only thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5`，workspace-write thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d`，resume thread `019e63a6-5806-7013-a8af-651efad3ffe5`，web-search thread `019e63a7-0b84-7993-bf33-028d39b15593`。
- Phase 7 仍有残余阻塞项：channel API key smoke 需要 `CODEX_SMOKE_API_KEY` 补跑；不得默认读取 ambient `OPENAI_API_KEY`。
- Phase 8 文档、发布与长期维护尚未开始。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 产品决策门禁已确认，采用清单推荐值，以后无需再询问同一组门禁。
- 用户已明确要求“不需要询问我，直接开发即可”；写入 tasks/todo.md 计划后直接执行。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
2. 运行 `git status --short` 和 `git log -3 --oneline`，确认工作树状态和最新提交；预期最新提交为本轮 MCP 注入提交或其后的状态同步提交。不要回滚用户改动。若只看到 `apps/electron/out/` 未跟踪，它是 Phase 7 打包产物，不要默认 stage / commit。
3. 读取开发清单的“最新开发状态快照”、第 9 节 Phase 7 执行记录、第 10 节 Phase 8 和第 13 节当前未解决问题。
4. 在 tasks/todo.md 写入本轮计划，然后直接开始执行。
5. 启动前确认本轮边界：先补齐 Phase 7 残余的 channel API key smoke（若提供凭证）；该残余项通过后再进入 Phase 8。不要把未验证成功路径写成已通过，也不要修改根 README.md / AGENTS.md，除非用户明确允许。

下一步优先级：
1. 若提供了 `CODEX_SMOKE_API_KEY`，重跑 channel API key 模式 smoke；不要默认读取 ambient `OPENAI_API_KEY`，除非显式 opt-in。
2. 若凭证未提供，将 channel API key smoke 保持为 `[!]` 阻塞，记录真实环境，不伪造成功。
3. 残余项关闭后，进入 Phase 8：同步主方案与实际实现、补充真实 smoke test 记录、SDK / CLI 升级兼容记录、已知限制、故障排查和发布说明草稿。

Phase 7 已通过验证：
- `bun run typecheck`
- `bun test --isolate`，600 pass / 0 fail
- `bun run electron:build`
- `CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`
- `binary.darwin-arm64` smoke，Codex 输出 `codex-cli 0.130.0`
- `stop.long-run` smoke，最终终态 `run_stopped`
- `native-auth.readonly` smoke，终态 `run_completed`
- `readonly-plan.no-write` smoke，终态 `run_completed`
- `workspace-write.file-edit` smoke，终态 `run_completed`
- `resume.context` smoke，终态 `run_completed`
- `web-search.current-support` smoke，终态 `run_completed`
- `smoke:agent-history-reload-ui` fixture-based packaged UI reload smoke，两次启动均确认历史标题、用户消息和 Codex assistant 消息出现在真实 UI
- `smoke:agent-codex -- --only mcp` MCP config injection smoke，Codex CLI `mcp list --json` 可识别 CodeInsights workspace MCP 映射出的原生 stdio/http `mcp_servers` 配置；smoke 的 CLI override 从真实 helper 输出派生
- packaged app Codex binary / wrapper 版本检查
- packaged app 使用隔离配置目录启动 smoke
- 安全复审无 Critical / High / Medium

重要纪律：
- 每完成一个阶段并通过验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件；不要 stage `apps/electron/out/` 等打包产物，除非用户明确要求。
- 提交信息用详细中文，说明完成内容、验证结果和残余风险。
- 不修改根 README.md 或 AGENTS.md，除非用户明确允许。
- 默认测试不能依赖本机登录、真实 API key 或真实 Codex 服务；真实 smoke 结果要和 mock 单测分离记录。
- 保持 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` feature flag 边界，关闭 flag 时不应暴露 Codex runtime 入口。
- 保持 Codex auth 隔离：native auth / API key / custom channel 不得混用宿主全局 `CODEX_HOME` 或泄漏宿主 secrets。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
