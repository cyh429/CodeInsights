# Codex Support 文档索引

本目录用于沉淀 CodeInsights 接入 Codex runtime 的设计、调研、实施记录和后续兼容性说明。

## 当前主文档

- [Agent 模式 Codex Runtime 接入开发方案](./2026-05-25-agent-codex-runtime-integration-plan.md)
- [Agent 模式 Codex Runtime 开发进度清单](./2026-05-25-agent-codex-runtime-development-checklist.md)
- [Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)

## 最新状态

更新时间：2026-05-25

- 已完成：需求调研、主方案、二次细化、开发进度清单、文档索引、下次启动提示词。
- 已提交：主方案与开发清单提交为 `feb46548 docs: 规划 Agent Codex Runtime 接入`；最新状态同步提交以 `git log -1 --oneline` 为准。
- 未完成：产品决策门禁、Phase 0-8 全部开发阶段。
- 下一步：从 [开发进度清单](./2026-05-25-agent-codex-runtime-development-checklist.md) 的 Phase 0 开始做基线冻结与实施准备。

## 设计定位

Codex 在 CodeInsights 中应作为 Coding Agent Runtime 接入，而不是普通 OpenAI 模型 Provider。CodeInsights 负责桌面产品层、会话、工作区、配置、事件可视化、权限策略、审计和本地存储；底层 Agent 能力由完整 Codex runtime 提供。

## 后续建议拆分文档

- Codex SDK / CLI 升级兼容记录。
- Codex MCP / plugin / skills 与 CodeInsights workspace 能力映射。
- Codex permission / approval event 支持调研。
- Codex packaged binary 多平台验证记录。
- Codex Agent runtime 真实 smoke test 记录。
