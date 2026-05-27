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
- opencode support README 与 next-session prompt 已补齐并同步：bbe8a80c docs(agent): 同步 opencode Runtime 最新状态。
- Phase 0 依赖 spike 与基线冻结已完成并提交：63aab807 docs(agent): 完成 opencode Runtime Phase 0 依赖 spike。
- Phase 0 后最新状态、完成/未完成清单和本提示词已在状态同步提交中补齐：668b8268 docs(agent): 同步 opencode Phase 0 后续开发状态。
- Phase 1 共享类型、settings 与 IPC 契约已完成并通过验证：f4ac7325 feat(agent): 完成 opencode Runtime Phase 1 契约冻结。
- Phase 1 后最新状态、完成/未完成清单和本提示词已同步并提交：a793172c docs(agent): 同步 opencode Phase 1 后续开发状态。
- 当前还没有进入 opencode runtime core/server 实现；Phase 2-8 均未开始。

已完成内容：
- 需求理解：CodeInsights 的长期目标是成为多 Coding Agent runtime 代理层，不重新实现 Claude Code / Codex / opencode 的 Agent 能力。
- 主路径决策：采用 managed `opencode serve` + `@opencode-ai/sdk` client。
- CLI 定位：`opencode run --format json` 仅作为 smoke / fallback，不作为长期主实现。
- feature flag：首版使用 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1`，未开启时 Claude Code / Codex 行为不变。
- 包名调研：2026-05-27 已确认 `@opencode-ai/sdk@1.15.11` 与 `opencode-ai@1.15.11`；`opencode` 和 `@opencode-ai/cli` 包名不可用。
- 开发清单：已覆盖状态约定、产品与安全门禁、Phase 0-8、验证命令、Smoke 矩阵、风险跟踪、阶段记录模板和维护项。
- Phase 0 spike：已确认 server/API/SDK/config/provider/MCP/permission/binary 真实形态。重点结论：`--port 0` 不随机分配端口；SDK v1 默认 fields 风格；`event.subscribe()` 返回 `{ stream }`；permission v1 body 为 `{ response }` 且没有 `remember`；v2 permission 有 `permission.list()` / `permission.reply()`；provider/MCP `{env:VAR}` 可用但 resolved API 响应会暴露替换后的 secret，不能原样日志化。
- Phase 1 契约：shared 支持 `CodingAgentRuntimeKind = 'opencode'`、`opencode_server` / `opencode_cli` event source、runtime metadata 和 opencode session snapshot；settings 支持 secretless opencode 字段并区分 `null` native auth 与 `undefined` 未配置；registry 未启用 opencode 时不会由 settings 触发切换，已绑定 opencode session 不被改绑；诊断 IPC 契约已冻结。

未完成内容：
- Phase 2：opencode binary/env/config/server/client runtime core。
- Phase 3：opencode event adapter 与 fixtures。
- Phase 4：runtime mock、registry 和 orchestrator routing。
- Phase 5：真实 `opencode serve` 集成。
- Phase 6：renderer 设置、权限交互与历史回放。
- Phase 7：MCP、packaged binary 与 release readiness。
- Phase 8：真实使用验收、故障排查、发布说明和公开文档同步准备。

请先执行：
1. 读取项目指令和 tasks/lessons.md，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -3 --oneline`，确认工作树状态和最新提交；预期最新基线为 `a793172c docs(agent): 同步 opencode Phase 1 后续开发状态`，或其后的 Phase 2 开发提交。不要回滚用户改动。若看到 `apps/electron/out/` 或其他打包产物，不要默认 stage / commit。
3. 读取 docs/opencode-support/README.md、docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md 和 docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md，重点看 Phase 0 结论、Phase 1 验证记录和 Phase 2。
4. 在 tasks/todo.md 写入本轮 Phase 2 计划，然后直接开始执行 Phase 2。

Phase 2 目标：
- 实现不依赖真实模型的 opencode runtime core 基础设施：binary/env/auth/config/MCP/server manager/client wrapper。
- 继续保持长期落盘配置 secretless，不记录 API key、Bearer token、Basic Auth password、MCP secret 或 resolved config/provider 原文。
- 不进入 renderer UI、真实模型验收或 event adapter 完整映射；Phase 2 先完成 core 单测。

Phase 2 建议验证入口：
- `bun test apps/electron/src/main/lib/opencode-runtime`
- `bun run --filter='@codeinsights/electron' typecheck`
- `git diff --check -- apps/electron/src/main/lib/opencode-runtime apps/electron/package.json electron-builder.yml tasks/todo.md docs/opencode-support`

关键工程边界：
- 不把 opencode 当作普通模型 Provider；它是完整 Coding Agent Runtime。
- 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless；不要把 API key、Bearer token、Basic Auth password、MCP secret 写入仓库、长期 config 或日志。
- 不修改根 README.md / AGENTS.md，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新开发清单、support README、next-session prompt 和 tasks/todo.md Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
- 只 stage 当前阶段相关文件，不 stage 打包产物、临时 smoke 目录、.DS_Store 或无关用户改动。

下一步优先级：
1. 从 Phase 2 开始，不要跳到 renderer UI、真实模型 smoke 或发布文档。
2. 先完成 opencode binary/env/auth/config/server/client core，并用 fake executor / fake client 单测覆盖。
3. Phase 2 提交后，再进入 Phase 3 的 opencode event adapter 与 fixtures。
```
