# Agent opencode Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 opencode Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：agent-mode-opencode
预期最新开发基线：647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由
预期最新状态：Phase 4 后状态同步提交应位于 647d3046 之后；如果最新提交正是状态同步提交，以 `git log` 中包含 647d3046 为准。

当前状态：
- Phase 0 已完成：opencode 依赖/API spike。
- Phase 1 已完成：shared/settings/IPC 契约冻结。
- Phase 2 已完成：opencode runtime core 基础设施。
- Phase 3 已完成：opencode event adapter 与 fixtures。
- Phase 4 已完成：opencode mock runtime / orchestrator routing。
- Phase 5-8 均未开始。

已完成的 Phase 4 范围：
- 新增 `OpencodeAgentRuntime` mock/fake，不启动真实 `opencode serve`。
- 通过 fake opencode client / fake server manager 驱动 mock run。
- 复用 Phase 3 `OpencodeEventAdapter` 输出 runtime envelopes。
- feature flag `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1` 开启时可注册并路由到 opencode runtime；关闭时 settings 不触发新 opencode 会话，已绑定 opencode 会话会被主进程阻断继续发送。
- 新 session 首次运行写入 `runtimeSession`，包含 external session id、model、agent、authSource 等 snapshot。
- 已绑定 opencode session resume 不受当前 settings 的 model / agent / authSource 污染，并且必须存在物化 runtime manifest。
- workspace manifest 缺失或 workspace 不可解析但 metadata 已绑定 opencode ref 时阻断 resume，并写入可解释错误；不会回退到 `homedir()`。
- stop race 已覆盖，迟到 `run_completed` 不会覆盖 `run_stopped`。
- unsupported queueMessage / setPermissionMode 返回结构化错误，不污染本地权限状态。
- event log 可写入 opencode runtime events，history replay 可从 mock opencode events 生成 transcript。
- Phase 4 diagnostics 只声明 stream events / resume / abort；permission、server status、model refresh 等真实 server 能力留到 Phase 5+。
- `@codeinsights/shared` patch 版本已提升到 `0.1.47`，`@codeinsights/electron` patch 版本已提升到 `0.0.116`。

请先执行：
1. 读取项目指令和 `tasks/lessons.md`，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -5 --oneline`，确认工作树状态和最新提交；历史中必须包含 `647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由`、`bdef679f docs(agent): 固化 opencode Phase 3 最新启动基线`、`d2b718ad docs(agent): 同步 opencode Phase 3 后续开发状态` 和 `7c31b72d feat(agent): 完成 opencode Runtime Phase 3 Event Adapter`。不要回滚用户改动。
3. 读取 `docs/opencode-support/README.md`、`docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md` 和 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`，重点看 Phase 0-4 结论、Phase 4 验证记录和 Phase 5。
4. 在 `tasks/todo.md` 写入本轮 Phase 5 计划，然后直接开始执行 Phase 5。

Phase 5 目标：
- 启动真实 `opencode serve`，通过 SDK client 完成 server health、event subscribe、session create、prompt async、permission response、abort、resume 的最小闭环。
- 添加 `@opencode-ai/sdk`、`opencode-ai` 和必要 platform optionalDependencies；安装前先搜索/确认最新版本和包结构。
- 接入真实 `OpencodeServerManager` spawn、Basic Auth fetch wrapper、真实 client wrapper 和 smoke summary。
- 保持长期 config / diagnostics / event log secretless；不要记录 resolved `/config`、`/provider`、`/config/providers` 原文里的 secret。
- 无凭证时 binary / server / config / permission config smoke 仍应可验证；真实模型或 channel/native auth smoke 可 gated 并记录 skipped reason。
- 不进入 renderer UI 或发布打包验收，除非 Phase 5 清单明确要求。

Phase 5 建议验证入口：
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only binary`
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only server`
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only config`
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only permission`
- `CODEINSIGHTS_AGENT_OPENCODE_RUNTIME=1 bun run --filter='@codeinsights/electron' smoke:agent-opencode -- --only abort`
- `bun run --filter='@codeinsights/electron' typecheck`
- `git diff --check -- apps/electron scripts docs/opencode-support tasks/todo.md`

关键工程边界：
- opencode 是完整 Coding Agent Runtime，不是普通模型 Provider。
- CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless。
- 不修改根 `README.md` / `AGENTS.md`，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新 development checklist、support README、next-session prompt 和 `tasks/todo.md` Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
```
