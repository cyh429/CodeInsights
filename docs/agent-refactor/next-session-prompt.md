# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights

必须先阅读：
- tasks/lessons.md
- tasks/todo.md
- docs/agent-refactor/README.md
- docs/agent-refactor/development-checklist.md
- docs/agent-refactor/event-contract.md
- docs/agent-refactor/runtime-manifest.md
- docs/agent-refactor/baseline-runs/2026-05-17-round-1.md
- docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md

当前已完成并提交：
- 方案阶段：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 阶段 0：47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线
- 阶段 1：d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约
- 阶段 2：04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写
- 阶段 3：ee1157b9 feat(agent): 完成 Agent 重构阶段 3 进程内 Runner
- 阶段 4：18a65cd1 feat(agent): 完成 Agent 重构阶段 4 Runtime Manifest 只读解析
- 阶段 5：10fd5808 feat(agent): 完成 Agent 重构阶段 5 Runtime Materializer
- 阶段 6：05f3c9e9 feat(agent): 完成 Agent 重构阶段 6 插件系统原生化
- 阶段 7：eb9b9f34 feat(agent): 完成 Agent 重构阶段 7 内置 MCP Bridge
- 阶段 8：6ff5a6cb feat(agent): 完成 Agent 重构阶段 8 Renderer 切新 Reducer
- 阶段 9：09e558a7 feat(agent): 完成 Agent 重构阶段 9 External Channel Adapter
- 阶段 10：feat(agent): 完成阶段10 Pipeline 复用 Runner
- 阶段 11：2760a3e8 feat(agent): 完成阶段11旧路径清理
- 阶段 12：0e37e500 feat(agent): 完成阶段12真实交互补跑与Runner v2 stop加固

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.89

当前状态：
- Agent 默认对话仍走旧 Orchestrator 主循环；`agentRuntimeRunnerV2` 默认关闭。
- Pipeline Runner v2、External Channel v2 仍通过 feature flag 控制，默认不改变可见行为。
- 阶段 12 已真实补跑默认 Agent 发送、pending-stop、权限 approve/deny、AskUser、Plan Mode 和 materialized runtime 下 `rv_host` 只读 MCP 可见性。
- 阶段 12 已修复旧主循环和 Runner v2 在用户 stop 后 iterator / runner 正常结束时漏写 `run_stopped` 的风险，并补充回归测试。
- `payloadToLegacyEvents()` 仍保留为权限、AskUser、Plan Mode、后台任务、文件定位等副作用兼容层。
- 旧 Agent 主循环 adapter.query、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容仍保留。
- 当前工作树可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音；不要纳入提交。

当前未完成：
- `agentRuntimeRunnerV2` 尚未证明可完全替代旧 Agent 主循环。
- Runner v2 仍缺自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、复杂 pending 交互和旧 session resume 的等价证据。
- 真实 Electron 交互仍未完整补跑同会话并发、旧 session resume、附件、additional directory、fork、rewind。
- 最小 Pipeline 真实 UI run 未补跑；human gate、patch-work 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定仍需真实桌面壳复验。
- Skill / Plugin snapshot 已有聚焦测试，但还缺真实 Agent 对话中被模型实际使用的证据。
- 飞书入口与飞书群聊 MCP 受本机缺少 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json` 阻塞；不要伪造通过。

下一步请执行阶段 13：Runner v2 默认化证据补齐。

阶段 13 要求：
1. 先在 `tasks/todo.md` 确认阶段 13 checklist，完成后追加 Review。
2. 不做 UI 改版，不默认开启 feature flag，不删除旧 Agent 主循环。
3. 优先补齐 Runner v2 与旧主循环的等价证据：自动重试、Watchdog、Teams auto-resume、typed error 持久化、UI `sdk_message` 推送、旧 session resume / transcript 兼容。
4. 在 `agentRuntimeRunnerV2=1` 下补跑真实 Electron Agent 交互：发送、停止、权限 approve/deny、AskUser、Plan Mode。
5. 继续补跑旧 session resume、同会话并发、附件、additional directory、fork、rewind；无法补跑必须记录具体阻塞原因。
6. 补跑最小 Pipeline 真实 UI run，保留 patch-work Git 写入防护、HEAD/refs/index/config 校验和 human gate 复验。
7. 如缺少飞书配置或真实渠道/API，明确记录阻塞原因，不伪造通过。
8. 提交只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动。

建议文件范围：
- tasks/todo.md
- docs/agent-refactor/development-checklist.md
- docs/agent-refactor/baseline-runs/
- apps/electron/src/main/lib/agent-orchestrator.ts
- apps/electron/src/main/lib/agent-runtime-runner.ts
- apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts
- apps/electron/src/main/lib/agent-runtime-runner.test.ts
- apps/electron/src/renderer/atoms/agent-atoms.test.ts
- apps/electron/src/main/lib/pipeline-node-runner.test.ts

验证至少包括：
- bun run typecheck
- Agent / Runtime / Event Log / Renderer atoms 聚焦测试
- Pipeline node runner / human gate / patch-work 防护聚焦测试
- Electron 桌面壳真实交互补跑；无法补跑必须记录原因
- git diff --check
```
