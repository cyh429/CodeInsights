# Codex Support 文档索引

本目录用于沉淀 CodeInsights 接入 Codex runtime 的设计、调研、实施记录和后续兼容性说明。

## 当前主文档

- [Agent 模式 Codex Runtime 接入开发方案](./2026-05-25-agent-codex-runtime-integration-plan.md)
- [Agent 模式 Codex Runtime 开发进度清单](./2026-05-25-agent-codex-runtime-development-checklist.md)
- [Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)

## 最新状态

更新时间：2026-05-27 Phase 8 文档同步后

- 已完成：需求调研、主方案、二次细化、开发进度清单、文档索引、下次启动提示词、产品决策门禁确认、Phase 0 基线冻结与实施准备、Phase 1 共享类型与设置契约、Phase 2 Codex Runtime Core 抽取、Phase 3 Codex Event Adapter、Phase 4 CodexAgentRuntime Mock 接入、Phase 5 Orchestrator Runtime Routing、Phase 6 Renderer 设置/历史/UX、Phase 7 真实 Codex runtime 接入、打包验证、安全加固、native/read-only/workspace-write/resume/web-search/stop/history reload/MCP smoke 记录、API key 残余复核记录，以及 Phase 8 support 文档、故障排查、发布说明和长期维护记录。
- 已提交：
  - `feb46548 docs: 规划 Agent Codex Runtime 接入`
  - `c546bc4e docs: 同步 Agent Codex Runtime 开发状态`
  - `29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结`
  - `ecb84a81 docs: 同步 Agent Codex Runtime Phase 0 后续状态`
  - `6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约`
  - `7ee862d4 docs: 同步 Agent Codex Runtime Phase 1 后续状态`
  - `f04d893c refactor(codex): 抽取 Codex Runtime Phase 2 core`
  - `ac2e06d6 docs: 同步 Agent Codex Runtime Phase 2 后续状态`
  - `98914a42 feat(agent): 完成 Codex Runtime Phase 3 事件适配`
  - `2c7ebb94 feat(agent): 完成 Codex Runtime Phase 4 mock runner`
  - `40441fe8 feat(agent): 完成 Codex Runtime Phase 5 编排路由`
  - `58164e35 feat(agent): 完成 Codex Runtime Phase 6 渲染端接入`
  - `1b94f9ad test(agent): 完成 Codex Runtime Phase 7 真实集成验证`
  - `7d864d16 docs(agent): 同步 Codex Runtime Phase 7 后续状态`
  - `a02cbbf5 docs(agent): 同步 Codex Runtime Phase 7 smoke 补跑状态`
  - `4e210364 docs(agent): 固化 Codex Runtime 最新开发状态`
  - `1ebde36e docs(agent): 同步 Codex Runtime Phase 7 再次补跑状态`
  - `a439d541 test(agent): 修正 Codex native smoke 中转配置`
  - `79c7fc92 test(agent): 补齐 Codex history reload UI smoke`
  - `dae13cd7 feat(agent): 完成 Codex workspace MCP 注入`
  - `525327cd docs(agent): 同步 Codex Runtime 最新开发状态`
  - `217ed1f0 docs(agent): 记录 Codex API key smoke 残余复核`
  - `7467ab24 docs(agent): 同步 Codex Runtime 最新进度`
  - `b2d8bc5f docs(agent): 记录 Codex API key 最终残余复核`
  - `d989ae4f docs(agent): 同步 Codex Runtime 最新状态`
  - `2cd195b1 docs(agent): 暂缓 Codex API key smoke`
- 已补跑通过：修正 native smoke 隔离逻辑后会复制 `~/.codex/config.toml` 中的中转 API 配置，并尊重其中 `model_reasoning_effort`；native / read-only / workspace-write / resume / web-search / stop 成功路径均已通过真实 smoke；history reload 已通过 `79c7fc92` 新增的 fixture-based packaged UI reload smoke，覆盖重开后的读取与渲染链路；workspace MCP 已安全映射到 Codex 原生 `mcp_servers` 配置，MCP env/header secret 通过环境变量间接注入而不进入 SDK `--config` argv，并通过 `mcp.config-injection` smoke 验证 stdio/http 配置可识别。
- 最新复核：2026-05-26 当前环境未设置 `CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`；执行 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 后 `channel-api-key.readonly` 仍 skipped，脚本确认 `@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、binary `codex-cli 0.130.0`，未显式 opt-in `OPENAI_API_KEY`。
- 未完成 / 暂缓：channel API key smoke 已复核为 skipped，2026-05-27 用户明确要求暂时不做“有凭证则补跑 / 无凭证则记录阻塞”两项；该项保留为已知未完成验证，不再作为 Phase 8 启动阻塞。
- Phase 8 文档同步：主方案已回填实际 runtime registry、CodexAgentRuntime、runtime events 历史、真实 smoke、MCP 注入、安全边界和 API key smoke 暂缓；开发清单已新增 SDK / CLI 升级兼容记录、已知限制、故障排查和发布说明草稿。
- 下一步：按需补齐暂缓的 channel API key smoke、真实模型 MCP tool-call smoke、多平台 packaged binary 验证，以及在获得用户明确允许后同步根 README / AGENTS。
- 下次启动：直接使用 [Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)，并先确认最新提交为 `2cd195b1 docs(agent): 暂缓 Codex API key smoke` 或其后的 Phase 8 文档提交；`apps/electron/out/` 是本地打包产物，不应默认纳入提交。

## 设计定位

Codex 在 CodeInsights 中应作为 Coding Agent Runtime 接入，而不是普通 OpenAI 模型 Provider。CodeInsights 负责桌面产品层、会话、工作区、配置、事件可视化、权限策略、审计和本地存储；底层 Agent 能力由完整 Codex runtime 提供。

## 后续建议拆分文档

- Codex SDK / CLI 升级兼容记录。
- Codex MCP / plugin / skills 与 CodeInsights workspace 能力映射。
- Codex permission / approval event 支持调研。
- Codex packaged binary 多平台验证记录。
- Codex Agent runtime 真实 smoke test 记录。
- Codex channel API key 成功路径验证记录。
- Codex 真实模型 MCP tool-call 验证记录。
