# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：codex/agent-codex-runtime-phase-0

当前状态：
- 已完成需求调研、主方案、开发进度清单、文档索引、下次启动提示词、Phase 0 基线冻结、Phase 1 共享类型与设置契约、Phase 2 Codex Runtime Core 抽取。
- 主方案与开发清单提交：feb46548 docs: 规划 Agent Codex Runtime 接入。
- Phase 0 提交：29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结。
- Phase 0 后状态同步提交：ecb84a81 docs: 同步 Agent Codex Runtime Phase 0 后续状态。
- Phase 1 提交：6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约。
- Phase 1 后状态同步提交：7ee862d4 docs: 同步 Agent Codex Runtime Phase 1 后续状态。
- Phase 2 提交：f04d893c refactor(codex): 抽取 Codex Runtime Phase 2 core。
- 最新文档状态同步提交请以 git log -1 --oneline 为准。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 主方案在 docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md。
- 文档索引在 docs/codex-support/README.md。
- 产品决策门禁已确认，采用清单推荐值；以后无需再就同一组推荐值询问。
- Phase 3-8 尚未开始；下一步从 Phase 3：Codex Event Adapter 开始。

Phase 2 已完成内容：
- 新增 apps/electron/src/main/lib/codex-runtime/，抽出 codex-binary、codex-channel、codex-auth、codex-env、codex-command-guard 和 index.ts。
- apps/electron/src/main/lib/codex-pipeline-node-runner.ts 已改为复用公共 Codex runtime core。
- Pipeline prompt、JSON Schema、节点结果解析、patch-work enrichment、stream event、v2 业务 Git guard snapshot / 事后校验保持在 Pipeline runner 内，外部行为不变。
- buildCodexEnv() 已改为基础 allowlist，避免透传 OPENAI_API_KEY、AWS、NPM、Anthropic 等宿主 secrets。
- API key 模式隔离 CODEX_HOME；native auth 模式只传明确 CODEX_HOME 并清理 ambient CODEX_API_KEY。
- command guard 支持 pipeline / agent purpose 文案，并保留 git / gh / hub shim、GIT_DIR=/__codeinsights_git_disabled__、remote pushurl 改写、GIT_TERMINAL_PROMPT=0、askpass / GCM 禁用和危险 Git env 清理。
- Git guard 边界仍是 Phase 2 的“前置 command/env guard + Pipeline v2 snapshot 事后检测/回滚”；gitless workspace 属于后续安全强化，不属于 Phase 3。
- Electron 包版本已升至 @codeinsights/electron 0.0.105。

已确认产品决策：
- Codex 首版接受无逐工具权限 UI，仅提供 sandbox 级权限说明。
- Codex 首版隐藏或禁用 rewind / fork / soft interrupt / queue message，并给出明确 tooltip。
- Agent Codex 默认认证来源使用本机 Codex auth / CODEX_API_KEY，不复用 Pipeline Codex channel。
- bypassPermissions 默认不允许 danger-full-access，必须单独高级开关。
- Codex 历史以 runtime events 为主数据。
- 首版允许仅使用 Codex 自身 MCP 配置，CodeInsights workspace MCP 映射后续单独验证。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关教训。
2. 运行 git status --short 和 git log -1 --oneline，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 的“最新开发状态快照”、第 4 节 Phase 2 执行记录和第 5 节 Phase 3。
4. 在 tasks/todo.md 写入本轮 Phase 3 计划。
5. 启动 Phase 3 前，确认本轮只做 Codex Event Adapter 和 fixtures，不混入 Phase 4 CodexAgentRuntime mock、Phase 5 Orchestrator runtime routing、Renderer UI 或真实 Codex 集成。

Phase 3 目标：
- 用 fixtures 驱动实现 Codex SDK ThreadEvent / item event 到 AgentStreamEnvelope / AgentRuntimeEvent 的映射。
- 新增 apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts、对应测试和 fixtures。
- 必要时只扩展 packages/shared/src/agent/runtime-events.ts 中的 runtime-neutral 契约，不改变 Claude 现有路径。
- 不接 Orchestrator，不创建真实 Codex client，不调用真实 Codex SDK runStreamed。
- 不伪造 Claude SDKMessage；Codex 历史以 runtime events 为主数据。

Phase 3 具体范围：
- 定义 adapter 状态：thread id、started items、completed items、previous text/output、terminal flag。
- 实现 thread.started -> sdk_session 兼容映射。
- 实现 agent_message started/updated/completed 映射。
- 实现 reasoning 折叠式 task 映射。
- 实现 command_execution -> Bash 工具活动映射。
- 实现 file_change -> PatchApply 工具活动映射。
- 实现 mcp_tool_call -> server.tool 工具活动映射。
- 实现 web_search -> WebSearch 工具活动映射。
- 实现 todo_list -> agent_task_* 映射。
- 实现 turn.completed -> usage_updated + run_completed。
- 实现 turn.failed 和顶层 error -> run_failed。
- 实现 append-only delta 差分，非 append-only 时退化为完整覆盖。
- 实现 terminal 去重。

Phase 3 推荐 fixtures：
- agent-message-stream.jsonl
- command-success.jsonl
- command-failed.jsonl
- file-change.jsonl
- mcp-tool-call-success.jsonl
- mcp-tool-call-failed.jsonl
- web-search.jsonl
- todo-list.jsonl
- turn-failed.jsonl
- abort-after-completed-race.jsonl

Phase 3 推荐验证：
- bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts
- bun test packages/shared/src/agent/runtime-events.test.ts
- bun run --filter='@codeinsights/electron' typecheck
- git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md
- 若改动影响共享契约或更广行为，再补跑 bun test --isolate 或 bun run typecheck。

重要纪律：
- 每完成一个阶段并通过该阶段验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文，说明完成内容、验证结果和未包含的无关改动。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- Phase 3 只做 Codex event adapter；不要实现 CodexAgentRuntime、Orchestrator routing、Agent UI、真实 SDK runStreamed 接入或打包发布验证。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
