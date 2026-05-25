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
- Phase 4 CodexAgentRuntime Mock 接入已完成；最新提交请以 `git log -1 --oneline` 为准。
- Phase 5-8 尚未完成；下一步从 Phase 5：Orchestrator Runtime Routing 开始。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 产品决策门禁已确认，采用清单推荐值，以后无需再询问同一组门禁。
- 用户已明确要求“不需要询问我，直接开发即可”；写入 tasks/todo.md 计划后直接执行。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 和“不再等待确认”相关教训。
2. 运行 `git status --short` 和 `git log -1 --oneline`，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取开发清单的“最新开发状态快照”、第 6 节 Phase 4 执行记录和第 7 节 Phase 5。
4. 在 tasks/todo.md 写入本轮 Phase 5 计划，然后直接开始实现。
5. 启动 Phase 5 前确认本轮只做 Orchestrator runtime routing，不混入 Phase 6 Renderer UI 或 Phase 7 真实 Codex 集成。

Phase 5 目标：
- 让 Agent Orchestrator 基于 session/settings 选择 Claude Code 或 Codex runtime，保持 Claude 默认行为。
- 新增 `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`。
- 必要时新增 `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`，包装现有 Claude runner。
- 更新 `agent-service.ts` / `agent-orchestrator.ts` / `agent-runtime-event-log.ts` / `agent-session-manager.ts` / `main/ipc/agent-handlers.ts` 中与 runtime routing 相关的最小代码。
- Codex 仍使用 Phase 4 mock runtime 路径，不调用真实 Codex SDK / CLI，不依赖本机登录或真实 API key。

Phase 5 具体范围：
- 新增 `CodingAgentRuntimeRegistry`。
- 解析 runtime 优先级：session `runtimeKind` > legacy `sdkSessionId` > settings > default。
- 新 session 首次运行后持久化 `runtimeKind` 和 `runtimeSession`。
- 运行中禁止切换 runtime。
- Orchestrator 统一消费 `AgentStreamEnvelope`。
- Orchestrator 不直接依赖 Codex `ThreadEvent`。
- Codex run 写 runtime event log。
- Claude run 行为保持不变。
- stop 同时触发 active abort controller 和 runtime abort。
- complete 前二次检查 active session / abort state。
- runtime unsupported capability 透传到 UI 可处理的错误或状态。

Phase 5 推荐测试：
- mock Claude runtime 默认被选择。
- legacy `sdkSessionId` 会话被选择为 `claude-code`。
- settings 选择 Codex 时新会话使用 Codex。
- 已绑定 Claude session 不被 settings 切到 Codex。
- 已绑定 Codex session 不被 settings 切到 Claude。
- stop 后不落 `run_completed`。
- Codex `thread.started` 持久化 `runtimeSession.externalSessionId`。
- runtime 抛错后 active run 清理。

Phase 5 推荐验证：
- `bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`
- `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`
- `bun run --filter='@codeinsights/electron' typecheck`
- `git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc tasks/todo.md`

重要纪律：
- 每完成一个阶段并通过验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- 不接 Renderer UI，不做真实 Codex SDK / CLI 集成，不做打包发布验证。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
