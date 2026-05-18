# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights

必须先阅读：
- tasks/lessons.md
- docs/agent-refactor/README.md
- docs/agent-refactor/development-checklist.md
- docs/agent-refactor/event-contract.md
- docs/agent-refactor/runtime-manifest.md
- docs/agent-refactor/baseline-runs/2026-05-17-round-1.md

当前已完成并提交：
- 方案阶段：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 阶段 0：47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线
- 阶段 1：d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约
- 阶段 2：04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写
- 阶段 3 交接文档：d7d0ae60 docs(agent): 更新 Agent 重构阶段 3 交接提示
- 阶段 3：ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner
- 阶段 4：18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析
- 阶段 5 交接文档：410d8945 docs(agent): 更新阶段 5 交接提示词
- 阶段 5：10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer
- 阶段 6：05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化
- 阶段 7：eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge
- 阶段 8：6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer

当前状态：
- 阶段 0 已冻结首轮行为基线，但仍缺少实时 Electron 桌面交互证据。
- 阶段 1 已新增 shared runtime event contract：AgentStreamEnvelope / AgentRuntimeEvent / validator / adapter / replay reducer 测试骨架。
- 阶段 2 已在旧 Agent 运行路径旁边双写 `{session-id}.events.jsonl`，旧 SDKMessage JSONL 仍是 Renderer / resume 主数据源。
- 阶段 3 已新增进程内 InProcessAgentRuntimeRunner，抽出 SDK query / stream 边界；Runner 输出 `AsyncIterable<AgentStreamEnvelope>`，通过 callback 处理权限和 AskUser，通过 store interface 写 SDKMessage。
- 阶段 4 已新增只读 Runtime Manifest Registry，能从旧 workspace 解析 `mcp.json`、`skills/`、`skills-inactive/`、plugin manifest 和 attached directories，生成 source hash / runtimeHash / 能力快照。
- 阶段 5 已完成 Runtime Materializer for New Sessions：新 session 会物化 runtime 目录、session cwd、settings、MCP、CLAUDE.md、skills/plugins snapshot 和 runtime-manifest.json；旧 session 继续使用旧 cwd / resume 路径。
- 阶段 6 已完成插件系统原生化：新增 plugin catalog / enabled refs / local plugin import / snapshot materializer / command index；materialized session 的 SDK `plugins` 指向 RV snapshot，旧 session 继续走旧 workspace plugin 路径。
- 阶段 7 已完成内置 MCP Bridge：新增 `rv_host` in-process MCP server 和 host bridge handlers；默认 manifest 只注册只读工具 `rv_workspace_search`、`rv_list_workspace_files`、`rv_memory_search`、`rv_open_file`；side-effect handlers 已实现但不默认暴露；manifest 记录 hostBridge version/configHash 并纳入 runtimeHash；恢复已物化 session 时会校验 `rv-host-bridge.json` 未被篡改；Orchestrator 拒绝 custom MCP 覆盖内置 `rv_host`。
- 阶段 8 已完成 Renderer 切新 Reducer：Renderer 主路径优先把 `AgentStreamPayload` 适配为 `AgentStreamEnvelope` 并应用 runtime reducer；旧 `payloadToLegacyEvents()` 仍保留给副作用、transcript/debug 兼容和回滚；event replay 可恢复 pending permission / AskUser / ExitPlanMode request 与 Plan Mode 状态；retry lifecycle 已覆盖 starting / attempt / cleared / failed，并保留 `maxAttempts`。
- Orchestrator 已接入 `agentRuntimeRunnerV2` feature flag，但默认关闭；真实 Agent 对话仍走旧 Orchestrator 路径，因此客户端 UI 和默认行为没有可见变化。
- `@rv-insights/shared` 当前为 `0.1.40`；`@rv-insights/electron` 当前为 `0.0.85`。

当前未完成：
- 阶段 9 External Channel Adapter 尚未开始。
- 阶段 10 Pipeline 复用 Runner 尚未开始。
- 阶段 11 清理旧路径尚未开始。
- 阶段 0 真实交互缺口仍保留：并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书。
- 阶段 7 真实 MCP 可见性仍未人工补跑：本轮仅有 host MCP bridge / materializer / manifest 聚焦测试，未启动 Electron 桌面壳或真实 Claude Code MCP 会话。
- 阶段 8 真实 Renderer 交互仍未人工补跑：本轮通过 typecheck、event replay / view model 聚焦测试和代码审查修复验证，未启动 Electron 桌面壳补跑发送、停止、权限 approve/deny、AskUser、Plan Mode、旧 session resume。

当前工作树注意事项：
- 可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 等噪音文件。
- 不要把 `.DS_Store`、`improve/` 或无关改动纳入阶段提交。

下一步请执行阶段 9：External Channel Adapter。

目标：
1. 新增 `AgentChannel` / channel adapter 抽象，让 Electron、飞书等入口共享同一 Agent runtime 会话调度与事件流。
2. 新增 Electron channel adapter，保持当前桌面 UI 行为与 `AgentStreamEnvelope` 消费路径不变。
3. 新增 Feishu channel adapter 或最小接入层，复用同一 runtime runner / event contract，不直接解析 SDKMessage 内部结构。
4. 定义 channel session binding 存储，继续使用本地 JSON / JSONL，不引入数据库。
5. 飞书输出采用保守降级策略：assistant delta 节流、run completed 最终 Markdown 拼接、权限请求默认 queue_to_desktop。
6. channel-scoped MCP overlay 只作为 run overlay，不写入 workspace manifest。
7. 旧 Feishu bridge 通过 feature flag 保留，客户端 UI 零可见变化。

建议文件范围：
- apps/electron/src/main/lib/ 可新增 agent-channel / electron channel adapter / feishu channel adapter / binding store / 聚焦测试。
- apps/electron/src/main/lib/feishu-bridge.ts / feishu-bridge-manager.ts 如需接入 feature flag，可以小范围修改。
- packages/shared/src/agent/runtime-events.ts 如需补充 channel metadata，可以小范围修改。
- docs/agent-refactor/development-checklist.md 和 tasks/todo.md 需要更新阶段 9 状态。

必须遵守：
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS / IM-first 模型。
- 不默认 bypass 权限。
- 每阶段只改变一个主边界；阶段 9 只做 External Channel Adapter，不做 Pipeline 复用、不清理旧路径。
- 每阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件。
- 开发前先在 tasks/todo.md 写阶段 9 checklist；完成后追加 Review。
- 若用户纠正了实现方向，立即更新 tasks/lessons.md。

阶段 9 验证至少包括：
- bun run typecheck
- bun test channel adapter / binding store / Feishu adapter fixture 聚焦测试
- 尽量人工补跑 Electron Agent 发送与飞书入口；若当前环境无飞书配置，必须明确记录原因
- git diff --check
```
