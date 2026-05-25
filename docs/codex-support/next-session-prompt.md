# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：codex/agent-codex-runtime-phase-0

当前状态：
- Phase 0 基线冻结已完成并提交：29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结。
- Phase 1 共享类型与设置契约已完成并提交：6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约。
- Phase 2 Codex Runtime Core 抽取已完成并提交：f04d893c refactor(codex): 抽取 Codex Runtime Phase 2 core。
- Phase 2 后状态同步已提交：ac2e06d6 docs: 同步 Agent Codex Runtime Phase 2 后续状态。
- Phase 3 Codex Event Adapter 已完成并提交：98914a42 feat(agent): 完成 Codex Runtime Phase 3 事件适配。
- 最新文档状态同步提交请以 git log -1 --oneline 为准。
- 产品决策门禁已确认，采用开发清单推荐值，以后无需再询问同一组门禁。
- Phase 4-8 尚未完成；下一步从 Phase 4：CodexAgentRuntime Mock 接入开始。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 主方案在 docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md。
- 文档索引在 docs/codex-support/README.md。

已完成内容摘要：
- Phase 1：新增 runtime kind / runtimeSession / Agent Codex settings 契约；Codex session 历史以 runtime events 为主数据，不长期伪造成 Claude SDKMessage。
- Phase 2：新增 apps/electron/src/main/lib/codex-runtime/ 公共 core，抽出 codex-binary、codex-channel、codex-auth、codex-env、codex-command-guard 和 index.ts；Pipeline Codex runner 已复用公共 core，Pipeline 外部行为保持不变。
- Phase 2 安全边界：API key 模式隔离 CODEX_HOME；native auth 模式只传明确 CODEX_HOME 并清理 ambient CODEX_API_KEY；buildCodexEnv() 使用基础 allowlist，避免透传宿主 secrets；command guard 保留 git / gh / hub shim、GIT_DIR=/__codeinsights_git_disabled__、remote pushurl 改写、GIT_TERMINAL_PROMPT=0、askpass / GCM 禁用和危险 Git env 清理。
- Phase 3：新增 apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts、codex-event-adapter.test.ts 和 10 个 JSONL fixtures；用 fixtures 驱动把 @openai/codex-sdk@0.130.0 的 ThreadEvent 映射为 AgentStreamEnvelope / AgentRuntimeEvent。
- Phase 3 覆盖：agent_message、reasoning、command_execution、file_change、mcp_tool_call、web_search、todo_list、error；实现 append-only delta、非 append-only 完整覆盖、usage_updated + run_completed、run_failed、terminal 去重和 completed 后 abort/failure race。
- Phase 3 边界：未接 Orchestrator，未创建真实 Codex client，未调用真实 runStreamed，未接 Renderer UI，未修改 README.md 或 AGENTS.md，未伪造 Claude SDKMessage。
- Electron 包版本当前为 @codeinsights/electron 0.0.106。

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
3. 读取 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 的“最新开发状态快照”、第 5 节 Phase 3 执行记录和第 6 节 Phase 4。
4. 在 tasks/todo.md 写入本轮 Phase 4 计划。
5. 启动 Phase 4 前，确认本轮只做 CodexAgentRuntime mock 接入和 permission policy，不混入 Phase 5 Orchestrator runtime routing、Phase 6 Renderer UI 或 Phase 7 真实 Codex 集成。

Phase 4 目标：
- 实现主进程 Codex runtime runner，使用 mock Codex SDK 完成 start/resume/abort/failure 测试。
- 新增或更新 apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts。
- 新增 apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts 和 codex-runtime.test.ts。
- 新增 apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.ts 和 codex-permission-policy.test.ts。
- 必要时新增 apps/electron/src/main/lib/codex-runtime/codex-sdk-client.ts，必须可注入 mock。
- 复用 Phase 2 codex-runtime core 和 Phase 3 codex-event-adapter，不复制 auth/env/guard 或 ThreadEvent 映射逻辑。
- 不接 Orchestrator 默认路由，不改 Renderer UI，不调用真实 Codex SDK / CLI，不依赖本机登录或真实 API key。

Phase 4 具体范围：
- 定义 CodingAgentRuntime 主进程接口。
- 定义 CodingAgentRuntimeCapabilities。
- 实现 Codex SDK client factory，可注入 mock。
- 实现 CodexAgentRuntime.run()。
- 支持 startThread()。
- 支持 resumeThread(externalSessionId)。
- 支持 runStreamed() async generator。
- 支持 AbortSignal。
- 支持 workingDirectory、additionalDirectories、model。
- 支持 modelReasoningEffort、networkAccessEnabled、webSearchMode。
- 支持 sandboxMode、approvalPolicy 映射。
- 支持 thread.started 后暴露 external session id。
- queueMessage() 返回 structured unsupported。
- setPermissionMode() 返回 structured unsupported。
- 错误分类为 codex_auth_missing、codex_binary_missing、codex_channel_invalid、codex_turn_failed 等。

Phase 4 推荐测试：
- mock startThread 成功。
- mock resumeThread 成功。
- mock stream throw 映射 run_failed。
- mock turn.failed 映射 run_failed。
- abort before stream 映射 run_stopped。
- abort during stream 映射 run_stopped。
- stream 正常结束但 signal 已 aborted 时优先 run_stopped。
- unsupported capability 返回结构化结果。
- permission policy 单测覆盖 plan、auto、bypassPermissions。

Phase 4 推荐验证：
- bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts
- bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts
- bun run --filter='@codeinsights/electron' typecheck
- git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime tasks/todo.md
- 若改动影响共享契约或更广行为，再补跑 bun test --isolate 或 bun run typecheck。

重要纪律：
- 每完成一个阶段并通过该阶段验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文，说明完成内容、验证结果和未包含的无关改动。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- Phase 4 只做 CodexAgentRuntime mock 接入；不要实现 Orchestrator routing、Agent UI、真实 SDK runStreamed 集成或打包发布验证。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
