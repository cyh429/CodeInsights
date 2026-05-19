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
- 阶段 13 Watchdog / Teams auto-resume 证据补强：b3d0517e fix(agent): 补强阶段13 Watchdog 与 Teams auto-resume 证据
- 阶段 13 Pipeline planner fallback 证据补强：6171f164 fix(agent): 补强阶段13 Pipeline planner fallback 证据

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.95

当前状态：
- 默认 Agent 对话仍走旧 Orchestrator 主循环。
- `agentRuntimeRunnerV2`、`agentRuntimePipelineRunnerV2`、`agentRuntimeChannelsV2` 仍默认关闭。
- 旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge、旧 session JSONL 兼容都必须保留。
- 阶段 13 已补齐 Runner v2 自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送、重复 `run_started` / `sdk_session` 去重。
- 阶段 13 已补齐 Runner v2 Watchdog / Teams auto-resume 等价证据：复用 `TeamsCoordinator`，同一 SDK session resume，延迟 result，保留 `waiting_resume` / `resume_start` UI 副作用，worker idle 时退出挂起 query。
- 阶段 13 已真实 Electron 补跑通过：Runner v2 发送、停止、权限 approve、权限 deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- `sdk_session` 去重已从 Orchestrator 过滤补强到 event log writer 层，避免 `queryOptions.onSessionId` 多次触发写入重复 `sdk_session`。
- Plan Mode 退出事件持久化已补强：只有 `approve_auto` / `approve_edit` 写 `plan_mode_exited`；`deny` / `feedback` 不写退出事件，避免 replay 错误关闭 plan mode。
- Codex Pipeline runner 已补强本机 auth 隔离：无渠道场景支持 `CODEX_HOME/auth.json`，API key 模式隔离继承的 `CODEX_HOME`，内部 Git snapshot 清理宿主 `GIT_*` 环境并 fail closed，单测不再依赖开发机本机登录。
- Pipeline 深水位真实 UI run `342a6f0f-bea1-40eb-9396-378685bfaadc` 已到 developer / reviewer / tester / committer draft，写入完整 `patch-work` 与 `patch-set`，HEAD / refs / index / config 未被污染。
- 当前工作树可能只有 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 噪音；不要纳入提交。

当前未完成：
- 已定位 Electron 退出根因：先前 9333 实例持有单实例锁，导致 9334 新进程退出；结束旧实例后 9334 CDP 可连接。
- 飞书入口与飞书群聊 MCP 受缺少 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json` 阻塞；不要伪造通过。
- 仍不能默认开启 Runner v2。

当前明确已完成：
- Runner v2 代码侧等价证据：自动重试、typed error 持久化、catch error SDKMessage 持久化、UI `sdk_message` 推送、重复 `run_started` / `sdk_session` 去重、Plan Mode 退出、Watchdog、Teams auto-resume。
- Pipeline v2 真实补跑已补到 explorer/task_selection gate、planner fallback、developer、reviewer、tester 和 committer draft；Git guard、HEAD/refs/index/config 校验和 tester evidence 保守判定已形成证据。
- Codex Pipeline runner strict schema 与 auth / Git guard 隔离补强：递归检查所有 object schema 必填字段，reviewer 空字符串字段保守拒绝，clean-env Codex runner 测试通过。
- Runner v2 真实 Electron 交互证据：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- 验证证据：`bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、`git diff --check` 已在阶段 13 文档中记录。

下一步请继续阶段 13 收尾：
1. 先确认 `git status --short`，只忽略 `.DS_Store`、`improve/` 等无关噪音。
2. 不默认开启 feature flag，不删除旧 Agent 主循环，不做 UI 改版。
3. 复核本轮 `CODEX_HOME` auth 隔离、strict schema、deepwater evidence 文档是否已提交。
4. 检查飞书配置文件；若仍不存在，继续明确记录阻塞，不能伪造通过。
5. 如需再次重跑 Pipeline 深水位，先确认可用模型余额/渠道；当前本机开发配置仍只有 DeepSeek 渠道。
6. 验证至少包括 `bun run typecheck`、Agent / Runtime / Event Log / Renderer atoms 聚焦测试、Pipeline 聚焦测试、clean-env Codex runner 测试、Electron 真实交互证据复核和 `git diff --check`。
7. 提交只包含阶段 13 相关文件，不纳入 `.DS_Store`、`improve/` 或无关改动；提交信息用详细中文说明完成项、验证项和未完成项。
```
