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
- Phase 6-8 尚未完成；下一步从 Phase 6：Renderer 设置、历史与 UX 开始。
- 最新文档状态同步提交请以 `git log -1 --oneline` 为准；当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 产品决策门禁已确认，采用清单推荐值，以后无需再询问同一组门禁。
- 用户已明确要求“不需要询问我，直接开发即可”；写入 tasks/todo.md 计划后直接执行。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
2. 运行 `git status --short` 和 `git log -1 --oneline`，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取开发清单的“最新开发状态快照”、第 7 节 Phase 5 执行记录和第 8 节 Phase 6。
4. 在 tasks/todo.md 写入本轮 Phase 6 计划，然后直接开始实现。
5. 启动 Phase 6 前确认本轮只做 Renderer 设置、history replay 与 UX 禁用态，不混入 Phase 7 真实 Codex SDK / CLI 集成或打包发布验证。

Phase 6 目标：
- 在 UI 中暴露 Codex runtime 配置，并让 Codex 会话历史基于 runtime events 回放。
- 新增 `getAgentSessionRuntimeEvents` IPC / preload API。
- Renderer 加载 Codex session 时读取 runtime events。
- 实现 runtime transcript selector 与 `RuntimeTranscript` 组件。
- Agent settings 增加 Runtime 选择：Claude Code / Codex。
- Codex 认证来源 UI：native auth / OpenAI 或 Custom channel。
- Codex channel 下拉只显示 enabled openai/custom。
- Codex 模型设置独立于 Claude `agentModelId`。
- Codex reasoning effort、network、web search 设置。
- Agent header 显示当前 session runtime。
- Codex session 禁用或隐藏 rewind/fork/soft interrupt/queue message。
- Codex runtime 下不展示 Claude per-tool PermissionBanner。
- 设置中无效 `agentCodexChannelId` 自动清理。
- Feature flag 关闭时 UI 不显示 Codex runtime 入口。

Phase 6 推荐测试：
- runtime transcript selector 合并 user message 和 runtime assistant/tool events。
- settings initializer 清理 deleted/disabled/unsupported channel。
- Codex session header badge 正确。
- unsupported capability UI 有明确文案。
- runtime events 缺失时有降级提示。

Phase 6 推荐验证：
- `bun test apps/electron/src/renderer`
- `bun run --filter='@codeinsights/electron' typecheck`
- 手动 UI smoke：feature flag 开启后能看到 Codex runtime 设置。
- 手动 UI smoke：feature flag 关闭后不显示 Codex runtime 设置。
- `git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/renderer tasks/todo.md`

重要纪律：
- 每完成一个阶段并通过验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文。
- 不修改根 README.md 或 AGENTS.md，除非用户明确允许。
- 不做真实 Codex SDK / CLI 集成，不做打包发布验证。
- Codex 仍使用 Phase 4 mock runtime 路径，不依赖本机登录或真实 API key。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
