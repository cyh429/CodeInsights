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
- Phase 7-8 尚未完成；下一步从 Phase 7：真实 Codex 集成与打包验证开始。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 产品决策门禁已确认，采用清单推荐值，以后无需再询问同一组门禁。
- 用户已明确要求“不需要询问我，直接开发即可”；写入 tasks/todo.md 计划后直接执行。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard、runtime binding 和“不再等待确认”相关教训。
2. 运行 `git status --short` 和 `git log -1 --oneline`，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取开发清单的“最新开发状态快照”、第 8 节 Phase 6 执行记录和第 9 节 Phase 7。
4. 在 tasks/todo.md 写入本轮 Phase 7 计划，然后直接开始实现。
5. 启动 Phase 7 前确认本轮只做真实 Codex SDK / CLI 集成与指定验证，不混入 Phase 8 文档发布、发布说明或长期维护。

Phase 7 目标：
- 在真实 Codex SDK / CLI 环境中验证 Agent Codex runtime 的关键路径和 packaged app 行为。
- 确认 `@openai/codex-sdk` / `@openai/codex` 版本。
- 确认 esbuild external 包含 Codex SDK / CLI。
- 确认 electron-builder files 包含 SDK、CLI 和平台 binary 包。
- 确认 macOS arm64 binary 可解析。
- 确认 macOS x64 与 Windows x64 binary 策略。
- 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 做真实 smoke。
- native auth 模式：新建 Codex 会话并发送只读请求。
- channel API key 模式：新建 Codex 会话并发送只读请求。
- workspace-write 模式：让 Codex 修改一个隔离测试文件。
- read-only plan 模式：确认不能写文件。
- stop 长任务，最终状态为 stopped。
- resume 同一 Codex thread，确认上下文延续。
- 重启应用，确认 history reload。
- web search / MCP 按当前支持情况记录真实结果。
- 打包后运行 Agent Codex smoke。

Phase 7 推荐验证：
- `bun run typecheck`
- `bun test --isolate`
- `bun run electron:build`
- `CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`
- 手动 smoke 记录 native auth 结果。
- 手动 smoke 记录 channel API key 结果。
- 手动 smoke 记录 packaged app 结果。
- `git diff --check -- apps/electron/package.json apps/electron/electron-builder.yml apps/electron/scripts docs/codex-support tasks/todo.md`

重要纪律：
- 每完成一个阶段并通过验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文。
- 不修改根 README.md 或 AGENTS.md，除非用户明确允许。
- 默认测试不能依赖本机登录、真实 API key 或真实 Codex 服务；真实 smoke 结果要和 mock 单测分离记录。
- 保持 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` feature flag 边界，真实集成不应让关闭 flag 时暴露 Codex runtime 入口。
- 保持 Codex auth 隔离：native auth / API key / custom channel 不得混用宿主全局 `CODEX_HOME` 或泄漏宿主 secrets。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
