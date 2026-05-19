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
- docs/agent-refactor/baseline-runs/2026-05-18-stage-12.md
- docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md
- docs/agent-refactor/next-session-prompt.md

当前已完成并提交：
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
- 阶段 13 代码侧补强：328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据
- 阶段 13 追加修复：46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据
- 阶段 13 Plan Mode 退出证据补强：acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.93

当前状态：
- 默认 Agent 对话仍走旧 Orchestrator 主循环。
- `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 仍默认关闭。
- 旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容都必须保留。
- 阶段 13 已补齐 Runner v2 自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送、重复 `run_started` / `sdk_session` 去重。
- 阶段 13 已补齐 Runner v2 Watchdog / Teams auto-resume 等价证据：复用 `TeamsCoordinator`，同一 SDK session resume，延迟 result，保留 `waiting_resume` / `resume_start` UI 副作用，worker idle 时退出挂起 query。
- 阶段 13 已真实 Electron 补跑通过：Runner v2 发送、停止、权限 approve、权限 deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- `sdk_session` 去重已从 Orchestrator 过滤补强到 event log writer 层，避免 `queryOptions.onSessionId` 多次触发写入重复 `sdk_session`。
- Plan Mode 退出事件持久化已补强：只有 `approve_auto` / `approve_edit` 写 `plan_mode_exited`；`deny` / `feedback` 不写退出事件，避免 replay 错误关闭 plan mode。
- 当前工作树可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音；不要纳入提交。

当前未完成：
- 最小 Pipeline 真实 UI run 已启动并可 stop，但 150 秒内停留 `explorer/running`，未到 human gate / patch-work / tester；human gate、patch-work Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定仍需复验。
- 本轮再次尝试 Electron 真实 UI 补跑时，`bunx electron . --remote-debugging-port=9334` 启动后立即退出，未建立 CDP；需要先定位桌面壳退出原因，再补 Pipeline 深水位证据。
- 飞书入口与飞书群聊 MCP 受缺少 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json` 阻塞；不要伪造通过。
- 仍不能默认开启 Runner v2。

下一步请继续阶段 13 真实证据补齐：
1. 先确认 `git status --short`，只忽略 `.DS_Store`、`improve/` 等无关噪音。
2. 不默认开启 feature flag，不删除旧 Agent 主循环，不做 UI 改版。
3. 优先定位 Electron 桌面壳启动后立即退出的原因，恢复 CDP 可连接状态。
4. 再补能到 human gate / patch-work / tester 的最小 Pipeline 真实 UI run，复验 Git 写入防护、HEAD/refs/index/config 校验和 tester 证据保守判定。
5. 检查飞书配置文件；若仍不存在，继续明确记录阻塞，不能伪造通过。
6. 完成后更新 `tasks/todo.md`、`docs/agent-refactor/development-checklist.md`、`docs/agent-refactor/baseline-runs/2026-05-18-stage-13.md` 和 `docs/agent-refactor/next-session-prompt.md`。
7. 验证至少包括 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、Electron 真实交互补跑和 `git diff --check`。
8. 提交只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动；提交信息用详细中文说明完成项、验证项和未完成项。
```
