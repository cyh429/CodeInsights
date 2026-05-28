# Agent opencode Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 opencode Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：agent-mode-opencode
预期最新开发基线：3ec2ebec feat(agent): 完成 opencode Runtime Phase 7 MCP 与打包验证
预期最新状态同步提交：bcec66d6 docs(agent): 同步 opencode Phase 7 开发状态
预期最新状态：最新 HEAD 应为 bcec66d6 或其后的文档同步提交；历史必须包含 bcec66d6、3ec2ebec、0c84b37a、077fbc49、bb361a34、b3e99265、647d3046
Phase 7 开发基线：3ec2ebec feat(agent): 完成 opencode Runtime Phase 7 MCP 与打包验证
Phase 7 后状态同步提交：bcec66d6 docs(agent): 同步 opencode Phase 7 开发状态
Phase 6 最新状态同步提交：0c84b37a docs(agent): 同步 opencode Phase 6 最新开发状态
Phase 6 后状态同步提交：077fbc49 docs(agent): 同步 opencode Phase 6 后续开发状态
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
- Phase 7 已完成：MCP config/status、packaged binary/server smoke、packaged history replay smoke 和 secretless 加固。
- Phase 8 未开始：真实使用验收、故障排查、发布说明和公开文档同步准备。

已完成的 Phase 7 范围：
- workspace MCP 会注入 opencode config：stdio/local env 与 remote headers 使用 `{env:VAR}` placeholder，真实 secret 只进入子进程 env。
- MCP args / URL 出现 secret-like 表达时会跳过并记录 `unsafe_args` / `unsafe_url`，避免写入 opencode config。
- `/mcp` 状态摘要已接入 diagnostics / 设置页，只保留 server name、status、connected/skipped count 和 skip reason，不保留错误原文、header、token 或 env 值。
- `OPENCODE_CONFIG_DIR` 默认继续关闭；默认 MCP smoke 通过且 `configDirEnabled=false`；显式 `OPENCODE_SMOKE_ENABLE_CONFIG_DIR=1` 仍失败，reason 为 `The operation was aborted.`。
- `electron-builder.yml` 已包含 `@opencode-ai/sdk`、`opencode-ai` 和目标平台 `opencode-*` optional package。
- packaged smoke 已证明 macOS arm64 app 使用 bundled `opencode-darwin-arm64/bin/opencode`，source 为 `bundled`，PATH fallback disabled，并能启动 server health。
- packaged history replay smoke 已支持 `--runtime opencode`，能验证 app 首次打开和重开后回放 opencode runtime event log。
- 已加固 opencode binary resolver：`opencode-ai/bin/opencode.exe` 不存在时回退平台包；平台包 binary 缺失或不可执行时不返回坏路径。
- `@codeinsights/shared` patch 版本已提升到 `0.1.49`，`@codeinsights/electron` patch 版本已提升到 `0.0.119`。

Phase 7 已知残余：
- macOS arm64 packaged app smoke 已通过；macOS x64、Windows x64、Linux packaged smoke 未在本机验证，继续标记 `[!]`。
- `dist:fast` 的 main/preload/renderer 构建和 `out/mac-arm64/CodeInsights.app` 生成成功；DMG 生成阶段仍因 `hdiutil create` Exit code 1 失败，不能声明 DMG artifact 通过。
- MCP tool-call 真实模型 smoke 未执行，留 Phase 8 或显式凭证验收。
- 本轮未进入真实模型验收、故障排查实战、release notes、根 `README.md` 或根 `AGENTS.md` 修改。

请先执行：
1. 读取项目指令和 `tasks/lessons.md`，特别注意阶段完成即提交、重启恢复纪律、状态同步与下次启动提示词、secretless config、Git guard、runtime binding 等教训。
2. 运行 `git status --short` 和 `git log -5 --oneline`，确认最新提交是 `bcec66d6 docs(agent): 同步 opencode Phase 7 开发状态` 或其后的文档同步提交，且历史中包含 `bcec66d6`、`3ec2ebec`、`0c84b37a`、`077fbc49`、`bb361a34`、`b3e99265`、`647d3046`。不要回滚用户改动。
3. 读取 `docs/opencode-support/README.md`、`docs/opencode-support/2026-05-27-agent-opencode-runtime-development-checklist.md` 和 `docs/opencode-support/2026-05-27-agent-opencode-runtime-integration-plan.md`，重点看 Phase 7 验证记录、`OPENCODE_CONFIG_DIR` 暂缓结论、多平台 `[!]` 和 Phase 8。
4. 在 `tasks/todo.md` 写入本轮 Phase 8 计划，然后开始执行 Phase 8；不要默认修改根 `README.md` / `AGENTS.md`，除非用户明确允许。

Phase 8 建议目标：
- 真实使用验收：native/channel auth、readonly、workspace-write、resume、permission reject/once/session allow、MCP tool-call。
- 故障排查材料：binary missing、server auth failed、provider auth missing、model not found、MCP auth failed、permission stuck、SSE interrupted。
- 发布准备：多平台 packaged smoke、DMG `hdiutil` 残余判断、release notes 草稿和公开文档同步准备。
- 所有 diagnostics、smoke summary、event log 和文档示例继续保持 secretless。

关键工程边界：
- opencode 是完整 Coding Agent Runtime，不是普通模型 Provider。
- CodeInsights 不重写 opencode 的工具循环、MCP、权限、provider adapter 或 session 管理。
- 所有长期落盘配置必须 secretless。
- 不修改根 `README.md` / `AGENTS.md`，除非用户明确允许。
- 每完成一个 Phase 并通过验证后，立即更新 development checklist、support README、next-session prompt 和 `tasks/todo.md` Review，然后单独提交。
- 提交信息必须使用详细中文，说明完成内容、验证结果、未包含内容或暂缓项。
```
