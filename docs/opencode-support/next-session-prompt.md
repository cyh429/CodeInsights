# Agent opencode Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 opencode Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：agent-mode-opencode

当前状态：
- opencode 接入主方案已完成并提交：094d911d docs(agent): 完成 opencode Runtime 接入方案。
- opencode 接入主方案已深化并提交：06c62406 docs(agent): 深化 opencode Runtime 接入方案。
- opencode Runtime 开发进度清单已建立并提交：4544b64a docs(agent): 建立 opencode Runtime 开发进度清单。
- 阶段提交纪律已强化并提交：19b5a71d docs(workflow): 强化阶段提交纪律。
- opencode support README 与 next-session prompt 已在后续状态同步提交中补齐；最新提交号以 `git log -1 --oneline` 为准，预期至少包含 19b5a71d 之后的状态同步提交。
- 当前还没有进入业务实现；Phase 0-8 均未开始。

已完成内容：
- 需求理解：CodeInsights 的长期目标是成为多 Coding Agent runtime 代理层，不重新实现 Claude Code / Codex / opencode 的 Agent 能力。
- 主路径决策：采用 managed `opencode serve` + `@opencode-ai/sdk` client。
- CLI 定位：`opencode run --format json` 仅作为 smoke / fallback，不作为长期主实现。
- feature flag：首版使用 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1`，未开启时 Claude Code / Codex 行为不变。
- 包名调研：2026-05-27 已确认 `@opencode-ai/sdk@1.15.11` 与 `opencode-ai@1.15.11`；`opencode` 和 `@opencode-ai/cli` 包名不可用。
- 开发清单：已覆盖状态约定、产品与安全门禁、Phase 0-8、验证命令、Smoke 矩阵、风险跟踪、阶段记录模板和维护项。

未完成内容：
- Phase 0：依赖 spike 与基线冻结。
- Phase 1：共享类型、settings 与 IPC 契约。
- Phase 2：opencode binary/env/config/server/client runtime core。
- Phase 3：opencode event adapter 与 fixtures。
- Phase 4：runtime mock、registry 和 orchestrator routing。
- Phase 5：真实 `opencode serve` 集成。
- Phase 6：renderer 设置、权限交互与历史回放。
- Phase 7：MCP、packaged binary 与 release readiness。
- Phase 8：真实使用验收、故障排查、发布说明和公开文档同步准备。

请先执行：
1. 读取项目指令和 tasks/lessons.md，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -3 --oneline`，确认工作树状态和最新提交；不要回滚用户改动。若看到 `apps/electron/out/` 或其他打包产物，不要默认 stage / commit。
3. 读取 docs/opencode-support/README.md、docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md 和 docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md。
4. 在 tasks/todo.md 写入本轮 Phase 0 计划，然后直接开始执行 Phase 0。

Phase 0 目标：
- 用真实命令确认 opencode npm 包结构、Server API、SDK 返回形态、配置优先级、permission body、MCP env/header placeholder、provider config 和 binary 路径。
- 不污染业务实现提交；如果需要临时安装依赖，优先使用临时目录或明确记录改动边界。
- 如果 SDK / Server API 与方案差异明显，停止进入 Phase 1，先更新主方案和开发清单。

Phase 0 必做验证入口：
- `npm view @opencode-ai/sdk version dependencies dist-tags --json`
- `npm view opencode-ai version optionalDependencies bin dist-tags --json`
- `npm view opencode version --json`
- `npm view @opencode-ai/cli version --json`
- `bun run typecheck`
- `bun test --isolate`
- `git diff --check`

关键工程边界：
- 不把 opencode 当作普通模型 Provider；它是完整 Coding Agent Runtime。
- 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless；不要把 API key、Bearer token、Basic Auth password、MCP secret 写入仓库、长期 config 或日志。
- 不修改根 README.md / AGENTS.md，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新开发清单、support README、next-session prompt 和 tasks/todo.md Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
- 只 stage 当前阶段相关文件，不 stage 打包产物、临时 smoke 目录、.DS_Store 或无关用户改动。

下一步优先级：
1. 从 Phase 0 开始，不要跳到 UI 或真实 server 集成。
2. 先冻结依赖/API/config/permission/MCP 的真实形态。
3. Phase 0 提交后，再进入 Phase 1 的 shared/settings/IPC 契约。
```
