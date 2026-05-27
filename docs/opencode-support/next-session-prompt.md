# Agent opencode Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 opencode Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：agent-mode-opencode
预期最新开发基线：b3e99265 feat(agent): 完成 opencode Runtime Phase 5 真实 Server 集成
预期最新状态：3b8a1286 docs(agent): 同步 opencode Phase 5 后续开发状态
Phase 5 开发基线：b3e99265 feat(agent): 完成 opencode Runtime Phase 5 真实 Server 集成
Phase 4 开发基线：647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由

当前状态：
- Phase 0 已完成：opencode 依赖/API spike。
- Phase 1 已完成：shared/settings/IPC 契约冻结。
- Phase 2 已完成：opencode runtime core 基础设施。
- Phase 3 已完成：opencode event adapter 与 fixtures。
- Phase 4 已完成：opencode mock runtime / orchestrator routing。
- Phase 5 已完成：真实 `opencode serve` / SDK client / Basic Auth / smoke summary。
- Phase 6-8 均未开始。

已完成的 Phase 5 范围：
- 已安装并锁定 `@opencode-ai/sdk@1.15.11`、`opencode-ai@1.15.11` 和所有必要 `opencode-*` platform optionalDependencies。
- `@codeinsights/electron` patch 版本已提升到 `0.0.117`。
- `OpencodeAgentRuntime` 默认使用真实 server manager 和真实 SDK client；测试仍可注入 fake server/client。
- `OpencodeServerManager` 可以自行分配端口、固定 `127.0.0.1`、启用随机 Basic Auth、spawn `opencode serve`、轮询 health、清理进程并在需要时 SIGKILL。
- `opencode-sdk-client` 已接入 `createOpencodeClient()`，支持 health、event subscribe、session create、prompt async、abort、messages、permission response、config summary，并通过 Basic Auth fetch wrapper 注入认证。
- smoke CLI `smoke:agent-opencode` 已覆盖 binary、server、config、permission、abort、resume、readonly、channel、native。
- 无凭证环境下 binary / server / config / permission / abort / resume smoke 通过；readonly / channel / native 因未设置真实模型或凭证按 skipped reason 跳过。
- smoke summary 保持 secretless，不输出 API key、Basic Auth password、MCP token、auth 文件内容，也不记录 resolved `/config`、`/provider`、`/config/providers` 原文。
- `writeOpencodeRuntimeConfig()` 仍生成私有 `config-dir`，但 Phase 5 默认不注入 `OPENCODE_CONFIG_DIR`。`opencode-ai@1.15.11` 下空 assets 目录组合会让 session mutating API 卡住；后续 Phase 7 需要 assets / MCP 时再通过 `CODEINSIGHTS_AGENT_OPENCODE_ENABLE_CONFIG_DIR=1` 或 `OPENCODE_SMOKE_ENABLE_CONFIG_DIR=1` 显式验收。
- Phase 5 未进入 renderer UI、MCP、packaged binary 或发布验收。

请先执行：
1. 读取项目指令和 `tasks/lessons.md`，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -5 --oneline`，确认最新提交包含 `3b8a1286`，且历史中包含 `b3e99265`、`647d3046`、`bdef679f`、`d2b718ad`、`7c31b72d`。不要回滚用户改动。
3. 读取 `docs/opencode-support/README.md`、`docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md` 和 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`，重点看 Phase 5 验证记录、`OPENCODE_CONFIG_DIR` 暂缓结论和 Phase 6。
4. 在 `tasks/todo.md` 写入本轮 Phase 6 计划，然后直接开始执行 Phase 6。

Phase 6 目标：
- 在 renderer 设置中接入 opencode runtime 选择、auth source、model、agent 和 feature flag 状态展示。
- 接入 opencode permission 交互 UI：把 Phase 3 permission events 复用到现有 PermissionBanner，不做 opencode 专用 message list。
- 接入 runtime capabilities 显示和不支持能力的交互禁用/提示，避免 queueMessage / setPermissionMode 乐观更新。
- 确认 Agent 历史回放只依赖 CodeInsights runtime event log，不依赖 opencode server 仍在运行。
- 保持长期 config / diagnostics / event log secretless；不要读取或展示 resolved provider/config 原文里的 secret。
- 不进入 MCP、packaged release、真实模型验收或根 `README.md` / `AGENTS.md` 修改，除非 Phase 6 清单明确要求。

Phase 6 建议验证入口：
- `bun test apps/electron/src/renderer/lib/agent-runtime-ui.test.ts`
- `bun test apps/electron/src/main/lib/agent-runtimes`
- `bun test packages/shared/src/agent/runtime-events.test.ts`
- `bun run --filter='@codeinsights/electron' typecheck`
- `git diff --check -- apps/electron/src/main apps/electron/src/preload apps/electron/src/renderer packages/shared docs/opencode-support tasks/todo.md`

关键工程边界：
- opencode 是完整 Coding Agent Runtime，不是普通模型 Provider。
- CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless。
- 不修改根 `README.md` / `AGENTS.md`，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新 development checklist、support README、next-session prompt 和 `tasks/todo.md` Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
```
