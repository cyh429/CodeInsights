# Codex Support 文档索引

本目录用于沉淀 CodeInsights 接入 Codex runtime 的设计、调研、实施记录和后续兼容性说明。

## 当前主文档

- [Agent 模式 Codex Runtime 接入开发方案](./2026-05-25-agent-codex-runtime-integration-plan.md)
- [Agent 模式 Codex Runtime 开发进度清单](./2026-05-25-agent-codex-runtime-development-checklist.md)
- [Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)

## 最新状态

更新时间：2026-05-26 Phase 7 成功路径 smoke 补跑后

- 已完成：需求调研、主方案、二次细化、开发进度清单、文档索引、下次启动提示词、产品决策门禁确认、Phase 0 基线冻结与实施准备、Phase 1 共享类型与设置契约、Phase 2 Codex Runtime Core 抽取、Phase 3 Codex Event Adapter、Phase 4 CodexAgentRuntime Mock 接入、Phase 5 Orchestrator Runtime Routing、Phase 6 Renderer 设置/历史/UX、Phase 7 真实 Codex runtime 接入、打包验证、安全加固和 smoke 记录。
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
  - 本轮 smoke 补跑状态同步提交完成后以 `git log -1 --oneline` 为准
- 未完成 / 阻塞：Phase 7 native / workspace-write / read-only / resume / web-search / history reload 成功路径仍需有效 Codex native auth 或 `CODEX_SMOKE_API_KEY` 补跑；历史记录中过本机 native auth 返回 `401 invalid_api_key`，本轮隔离 native smoke / CLI 探针均创建 thread 后超时，OpenAI / ChatGPT / GitHub 连通性探针也超时；channel API key smoke 因缺少 `CODEX_SMOKE_API_KEY` 跳过；Phase 8 文档发布维护尚未开始。
- 下一步：先恢复 Codex 所需网络连通性，再从 [开发进度清单](./2026-05-25-agent-codex-runtime-development-checklist.md) 第 9 节 Phase 7 残余 smoke 补跑开始；成功路径补跑通过后，再进入第 10 节 Phase 8“文档、发布与长期维护”。
- 下次启动：直接使用 [Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)，并先确认最新实现提交为 `1b94f9ad` 或其后的文档同步提交；`apps/electron/out/` 是本地打包产物，不应默认纳入提交。

## 设计定位

Codex 在 CodeInsights 中应作为 Coding Agent Runtime 接入，而不是普通 OpenAI 模型 Provider。CodeInsights 负责桌面产品层、会话、工作区、配置、事件可视化、权限策略、审计和本地存储；底层 Agent 能力由完整 Codex runtime 提供。

## 后续建议拆分文档

- Codex SDK / CLI 升级兼容记录。
- Codex MCP / plugin / skills 与 CodeInsights workspace 能力映射。
- Codex permission / approval event 支持调研。
- Codex packaged binary 多平台验证记录。
- Codex Agent runtime 真实 smoke test 记录。
