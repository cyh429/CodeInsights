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

当前状态：
- 阶段 0 已冻结首轮行为基线，但仍缺少实时 Electron 桌面交互证据。
- 阶段 1 已新增 shared runtime event contract：AgentStreamEnvelope / AgentRuntimeEvent / validator / adapter / replay reducer 测试骨架。
- 阶段 2 已在旧 Agent 运行路径旁边双写 `{session-id}.events.jsonl`，旧 SDKMessage JSONL 仍是 Renderer / resume 主数据源。
- 阶段 3 已新增进程内 InProcessAgentRuntimeRunner，抽出 SDK query / stream 边界；Runner 输出 `AsyncIterable<AgentStreamEnvelope>`，通过 callback 处理权限和 AskUser，通过 store interface 写 SDKMessage。
- 阶段 4 已新增只读 Runtime Manifest Registry，能从旧 workspace 解析 `mcp.json`、`skills/`、`skills-inactive/`、plugin manifest 和 attached directories，生成 source hash / runtimeHash / 能力快照，但不会创建 runtime 目录，也不会改变 cwd 或 Renderer 行为。
- 阶段 5 已完成 Runtime Materializer for New Sessions：新 session 会物化 runtime 目录、session cwd、settings、MCP、CLAUDE.md、skills/plugins snapshot 和 runtime-manifest.json；旧 session 继续使用旧 cwd / resume 路径。
- Orchestrator 已接入 `agentRuntimeRunnerV2` feature flag，但默认关闭；真实 Agent 对话仍走旧 Orchestrator 路径，因此客户端 UI 和默认行为没有可见变化。
- `@rv-insights/shared` 当前为 `0.1.37`；`@rv-insights/electron` 当前为 `0.0.82`。

当前未完成：
- 阶段 6 插件系统原生化尚未开始。
- 阶段 7 内置 MCP Bridge 尚未开始。
- 阶段 8 Renderer 切新 Reducer 尚未开始。
- 阶段 9 External Channel Adapter 尚未开始。
- 阶段 10 Pipeline 复用 Runner 尚未开始。
- 阶段 11 清理旧路径尚未开始。
- 阶段 0 真实交互缺口仍保留：并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书。

当前工作树注意事项：
- 可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 等噪音文件。
- 不要把 `.DS_Store`、`improve/` 或无关改动纳入阶段提交。

下一步请执行阶段 6：插件系统原生化。

目标：
1. 新增 plugin catalog 类型。
2. 新增 enabled plugin refs 配置。
3. 实现 plugin snapshot materializer。
4. 支持导入本地 Claude Code plugin。
5. 记录 plugin source path、snapshot path、hash。
6. 建立 plugin command 索引。
7. DMI slash command 由应用层展开。
8. 非 DMI plugin command 交给 SDK。
9. 禁止 snapshot 失败时 fallback 到用户全局 plugin。
10. 保持客户端 UI 零可见变化，不切 Renderer、不默认启用 Runner v2。

建议文件范围：
- apps/electron/src/main/lib/ 可新增 plugin catalog / materializer 相关文件和聚焦测试。
- docs/agent-refactor/development-checklist.md 和 tasks/todo.md 需要更新阶段 6 状态。

必须遵守：
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS / IM-first 模型。
- 不默认 bypass 权限，外部渠道默认保守权限策略。
- 每阶段只改变一个主边界；阶段 6 只做插件系统原生化，不切 Renderer、不启用 Runner v2 默认路径。
- 每阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件。
- 开发前先在 tasks/todo.md 写阶段 6 checklist；完成后追加 Review。

阶段 6 验证至少包括：
- bun run typecheck
- bun test plugin materializer / catalog / snapshot 聚焦测试
- 人工启用/禁用一个本地 plugin，或明确记录未补跑原因
- git diff --check
```
