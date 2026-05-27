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
- Phase 1 最新启动基线已固化：5c110ae1 docs(agent): 固化 opencode Phase 1 最新启动基线。
- Phase 2 opencode runtime core 已完成并通过验证：25bfec59 feat(agent): 完成 opencode Runtime Phase 2 Core 基础设施。
- Phase 2 后最新状态、完成/未完成清单和本提示词已同步并提交：d6768e0e docs(agent): 同步 opencode Phase 2 后续开发状态。
- Phase 2 最新启动基线已固化：daa0795a docs(agent): 固化 opencode Phase 2 最新开发状态。
- Phase 3 opencode event adapter 与 fixtures 已完成并通过验证：7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter。
- Phase 4-8 均未开始。

已完成内容：
- 需求理解：CodeInsights 的长期目标是成为多 Coding Agent runtime 代理层，不重新实现 Claude Code / Codex / opencode 的 Agent 能力。
- 主路径决策：采用 managed `opencode serve` + `@opencode-ai/sdk` client。
- CLI 定位：`opencode run --format json` 仅作为 smoke / fallback，不作为长期主实现。
- feature flag：首版使用 `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1`，未开启时 Claude Code / Codex 行为不变。
- 包名调研：2026-05-27 已确认 `@opencode-ai/sdk@1.15.11` 与 `opencode-ai@1.15.11`；`opencode` 和 `@opencode-ai/cli` 包名不可用。
- 开发清单：已覆盖状态约定、产品与安全门禁、Phase 0-8、验证命令、Smoke 矩阵、风险跟踪、阶段记录模板和维护项。
- Phase 0 spike：已确认 server/API/SDK/config/provider/MCP/permission/binary 真实形态。重点结论：`--port 0` 不随机分配端口；SDK v1 默认 fields 风格；`event.subscribe()` 返回 `{ stream }`；permission v1 body 为 `{ response }` 且没有 `remember`；v2 permission 有 `permission.list()` / `permission.reply()`；provider/MCP `{env:VAR}` 可用但 resolved API 响应会暴露替换后的 secret，不能原样日志化。
- Phase 1 契约：shared 支持 `CodingAgentRuntimeKind = 'opencode'`、`opencode_server` / `opencode_cli` event source、runtime metadata 和 opencode session snapshot；settings 支持 secretless opencode 字段并区分 `null` native auth 与 `undefined` 未配置；registry 未启用 opencode 时不会由 settings 触发切换，已绑定 opencode session 不被改绑；诊断 IPC 契约已冻结。
- Phase 2 core：新增 `apps/electron/src/main/lib/opencode-runtime/`，包含 binary/env/auth/config/MCP/server manager/client wrapper。实现保持不依赖真实模型和真实 opencode server；长期配置、inline policy、redacted summary 不包含 API key、Bearer token、Basic Auth password、MCP secret；MCP/channel secret 只通过 scoped env placeholder 间接注入。
- Phase 3 event adapter：新增 `apps/electron/src/main/lib/agent-runtimes/opencode-event-adapter.ts`、BDD fixtures 和单测；将 opencode SSE event / message part 转换成 CodeInsights runtime event；覆盖 server.connected、session lifecycle、user message 忽略、text delta/snapshot、tool pending/running/completed/error、patch、agent/subtask、todo、permission ask/reply、abort/stop、recovered 补读和错误分类；支持去重、part-level 文本累积、terminal single-write guard、stop 后迟到 success 屏蔽；`@codeinsights/shared` patch 版本已提升到 `0.1.46`，`@codeinsights/electron` patch 版本已提升到 `0.0.115`。

未完成内容：
- Phase 4：runtime mock、registry 和 orchestrator routing。
- Phase 5：真实 `opencode serve` 集成。
- Phase 6：renderer 设置、权限交互与历史回放。
- Phase 7：MCP、packaged binary 与 release readiness。
- Phase 8：真实使用验收、故障排查、发布说明和公开文档同步准备。

请先执行：
1. 读取项目指令和 tasks/lessons.md，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -3 --oneline`，确认工作树状态和最新提交；预期至少包含 `7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter`。不要回滚用户改动。若看到 `apps/electron/out/` 或其他打包产物，不要默认 stage / commit。
3. 读取 docs/opencode-support/README.md、docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md 和 docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md，重点看 Phase 0-3 结论、Phase 3 验证记录和 Phase 4。
4. 在 tasks/todo.md 写入本轮 Phase 4 计划，然后直接开始执行 Phase 4。

Phase 4 目标：
- 在不启动真实 opencode server 的情况下，把 `OpencodeAgentRuntime` 接入 runtime mock、registry、orchestrator routing、session binding、event log 和 history replay。
- 使用 fake opencode client / fake server manager 驱动 mock run，复用 Phase 3 `OpencodeEventAdapter` 输出 runtime events。
- 覆盖 feature flag on/off、新 session 首次绑定、已绑定 session resume 不受 settings 污染、missing manifest 处理、stop race、unsupported queue / permission mode switch 不污染 local state。
- 不进入 renderer UI、真实模型验收或真实 `opencode serve` 集成；Phase 4 先完成 mock runtime 与 orchestrator routing 单测。

Phase 4 建议验证入口：
- `bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts`
- `bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`
- `bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`
- `bun test apps/electron/src/main/lib/agent-session-manager.test.ts`
- `bun run --filter='@codeinsights/electron' typecheck`
- `git diff --check -- apps/electron/src/main/lib packages/shared tasks/todo.md docs/opencode-support`

关键工程边界：
- 不把 opencode 当作普通模型 Provider；它是完整 Coding Agent Runtime。
- 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless；不要把 API key、Bearer token、Basic Auth password、MCP secret 写入仓库、长期 config 或日志。
- 不修改根 README.md / AGENTS.md，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新开发清单、support README、next-session prompt 和 tasks/todo.md Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
- 只 stage 当前阶段相关文件，不 stage 打包产物、临时 smoke 目录、.DS_Store 或无关用户改动。

下一步优先级：
1. 从 Phase 4 开始，不要跳到 renderer UI、真实模型 smoke 或发布文档。
2. 先完成 mock opencode runtime、registry、orchestrator routing、session binding 和 event log 回放。
3. Phase 4 提交后，再进入 Phase 5 的真实 `opencode serve` 集成。
```
