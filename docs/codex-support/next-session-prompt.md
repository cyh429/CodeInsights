# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前状态：
- 已完成需求调研、主方案、开发进度清单、文档索引、下次启动提示词和 Phase 0 基线冻结。
- 主方案与开发清单已提交：feb46548 docs: 规划 Agent Codex Runtime 接入。
- 前序文档状态同步提交：c546bc4e docs: 同步 Agent Codex Runtime 开发状态。
- Phase 0 基线冻结已提交：29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结。
- 最新状态同步提交请以 git log -1 --oneline 为准。
- 当前开发状态应以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 主方案在 docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md。
- 文档索引在 docs/codex-support/README.md。
- Phase 0 已完成：已记录 Claude Agent、Pipeline Codex、runtime events 基线；已通过 bun run typecheck、bun test --isolate、bun run electron:build、git diff --check。
- 产品决策门禁尚未明确确认，见开发清单第 1 节。
- Phase 1-8 尚未开始；下一步必须先处理产品决策门禁，再进入 Phase 1“共享类型与设置契约”。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关教训。
2. 运行 git status --short 和 git log -1 --oneline，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 的“最新开发状态快照”、第 1 节产品决策门禁、第 3 节 Phase 1。
4. 在 tasks/todo.md 写入本轮计划。
5. 先处理产品决策门禁：如果用户没有明确确认，请先询问是否采用清单推荐值；用户确认前不要开始 Phase 1 代码改动。

产品决策推荐值：
- Codex 首版接受无逐工具权限 UI，仅提供 sandbox 级权限说明。
- Codex 首版隐藏或禁用 rewind / fork / soft interrupt / queue message，并给出明确 tooltip。
- Agent Codex 默认认证来源使用本机 Codex auth / CODEX_API_KEY，不复用 Pipeline Codex channel。
- bypassPermissions 默认不允许 danger-full-access，必须单独高级开关。
- Codex 历史以 runtime events 为主数据。
- 首版允许仅使用 Codex 自身 MCP 配置，CodeInsights workspace MCP 映射后续单独验证。

如果用户确认推荐值：
1. 将产品决策结果写回 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md，并在 tasks/todo.md 记录。
2. 启动 Phase 1：共享类型与设置契约。
3. Phase 1 提交边界只包含 shared/settings/session 契约，不混入 Codex runtime core、event adapter、UI 或真实 Codex 集成。

Phase 1 目标：
- 增加 runtime-neutral 类型：CodingAgentRuntimeKind、AgentRuntimeSessionRef、AgentSessionMeta.runtimeKind、AgentSessionMeta.runtimeSession。
- 保留 sdkSessionId 作为 Claude legacy 字段并明确迁移语义。
- 扩展 AgentEventSource、run_started.runtimeKind 和 usage 字段。
- 扩展 AppSettings.agentRuntimeKind。
- 补充 shared/settings/session manager 相关单测。
- 验证命令至少包含 bun run typecheck、相关 bun test、git diff --check；必要时跑 bun test --isolate。

重要纪律：
- 每完成一个阶段并通过该阶段验证后，立即提交该阶段相关文件。
- 提交前确认 git status，只 stage 本阶段相关文件。
- 提交信息使用详细中文，说明完成内容、验证结果和未包含的无关改动。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- 不要把 Phase 2 Codex runtime core、Phase 3 event adapter、Phase 5 Orchestrator routing 提前混进 Phase 1。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
