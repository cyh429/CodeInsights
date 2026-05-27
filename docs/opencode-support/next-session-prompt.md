# Agent opencode Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 opencode Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：agent-mode-opencode
预期最新开发基线：bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入
预期最新状态：Phase 6 后状态同步提交；若最新 HEAD 是文档同步提交，历史必须包含 bb361a34
Phase 6 开发基线：bb361a34 feat(agent): 完成 opencode Runtime Phase 6 Renderer 接入
Phase 5 开发基线：b3e99265 feat(agent): 完成 opencode Runtime Phase 5 真实 Server 集成
Phase 4 开发基线：647d3046 feat(agent): 完成 opencode Runtime Phase 4 Mock 路由

当前状态：
- Phase 0 已完成：opencode 依赖/API spike。
- Phase 1 已完成：shared/settings/IPC 契约冻结。
- Phase 2 已完成：opencode runtime core 基础设施。
- Phase 3 已完成：opencode event adapter 与 fixtures。
- Phase 4 已完成：opencode mock runtime / orchestrator routing。
- Phase 5 已完成：真实 `opencode serve` / SDK client / Basic Auth / smoke summary。
- Phase 6 已完成：renderer 设置、权限交互和历史回放。
- Phase 7-8 均未开始。

已完成的 Phase 6 范围：
- Agent 设置页已接入 opencode runtime 选择、feature flag 关闭态、native/channel auth source、model、agent、snapshot/autoupdate 设置。
- Agent 设置页已展示 runtime capabilities、opencode server 按需启动状态、模型刷新禁用原因和 MCP Phase 7 占位；Phase 6 不读取 resolved `/provider`、`/config/providers` 或 `/config` 原文。
- Agent 主界面复用 `RuntimeTranscript`，Codex / opencode 都走 runtime event log；没有新增 opencode 专用 message list。
- Agent Header 和 composer 已显示 runtime/model/agent/permission；opencode 运行中追加消息、`/compact` 和运行中 permission 切换都按 capability 禁用或提示。
- opencode permission events 已复用现有 `PermissionBanner`，展示 tool preview、cwd、risk label，支持 reject / once / session allow，缺少 preview 时隐藏 session allow。
- 权限响应已携带 `sessionId`，主进程可将 legacy permission service 找不到的响应路由到活跃 opencode runtime；opencode runtime 将 allow / session allow / deny 映射为 `once` / `always` / `reject`。
- live runtime envelope 会直接推送到 renderer 并去重；兼容 SDKMessage 增加 `_runtimeEnvelope` 标记，避免 runtime transcript 重复渲染。
- Agent 历史回放只依赖 CodeInsights runtime event log 和 session messages，不依赖 opencode server 仍在运行。
- Phase 6 收尾已修复审查问题：runtime replay 去重使用 `runId + sequence`，feature flag 关闭时 opencode 不作为可点击 runtime 选项，server status 读取 runtime manager 最新状态。
- `@codeinsights/shared` patch 版本已提升到 `0.1.48`，`@codeinsights/electron` patch 版本已提升到 `0.0.118`。
- Phase 6 未进入 MCP、packaged release、真实模型验收或根 `README.md` / `AGENTS.md` 修改。

请先执行：
1. 读取项目指令和 `tasks/lessons.md`，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -5 --oneline`，确认最新提交是 Phase 6 后状态，且历史中包含 `bb361a34`、`786b6485`、`3b8a1286`、`b3e99265`、`647d3046`。不要回滚用户改动。
3. 读取 `docs/opencode-support/README.md`、`docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md` 和 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`，重点看 Phase 6 验证记录、Phase 5 `OPENCODE_CONFIG_DIR` 暂缓结论和 Phase 7。
4. 在 `tasks/todo.md` 写入本轮 Phase 7 计划，然后直接开始执行 Phase 7。

Phase 7 目标：
- 接入 opencode MCP config / status / packaged binary / release readiness。
- 验证 Electron packaged 场景包含 `opencode-ai` 主包和目标平台 `opencode-*` optional package。
- 处理 `OPENCODE_CONFIG_DIR` 默认暂缓结论：只有在 assets / MCP 需要时，通过显式环境开关验证后再启用。
- 补充 packaged app reload / history replay smoke；不要提交 out、DMG、临时配置目录或真实凭证文件。
- 继续保持 MCP config、diagnostics、smoke summary 和 event log secretless。
- 不进入真实模型验收、故障排查、release notes 或根 `README.md` / `AGENTS.md` 修改。

Phase 7 建议验证入口：
- `bun test apps/electron/src/main/lib/opencode-runtime`
- `bun test apps/electron/src/main/lib/agent-runtimes/opencode-runtime.test.ts`
- `bun run --filter='@codeinsights/electron' typecheck`
- `bun run --filter='@codeinsights/electron' build:main`
- `bun run --filter='@codeinsights/electron' build:renderer`
- packaged / smoke 命令按 Phase 7 清单补充后再运行

关键工程边界：
- opencode 是完整 Coding Agent Runtime，不是普通模型 Provider。
- CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless。
- 不修改根 `README.md` / `AGENTS.md`，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新 development checklist、support README、next-session prompt 和 `tasks/todo.md` Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
```
