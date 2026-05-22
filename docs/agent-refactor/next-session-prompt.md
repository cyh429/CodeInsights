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
- docs/agent-refactor/baseline-runs/2026-05-22-stage-14A.md
- docs/agent-refactor/next-session-prompt.md

当前已完成并提交：
- 阶段 0-12 已完成并提交。
- 阶段 13 Runner v2 代码侧补强：328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据
- 阶段 13 sdk_session 去重修复：46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据
- 阶段 13 Plan Mode 退出证据补强：acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据
- 阶段 13 Watchdog / Teams auto-resume 证据补强：b3d0517e fix(agent): 补强阶段13 Watchdog 与 Teams auto-resume 证据
- 阶段 13 Pipeline planner fallback 证据补强：6171f164 fix(agent): 补强阶段13 Pipeline planner fallback 证据
- 阶段 13 文档交接状态更新：353c5c53 docs(agent): 同步阶段13最新状态并更新继续开发提示词
- 阶段 13 Pipeline 与 Codex guard 收尾证据：10356a3a fix(agent): 收尾阶段13 Pipeline 与 Codex guard 证据
- 阶段 14 默认化评估计划：02199299 docs(agent): 建立阶段14 Runner v2 默认化评估计划
- 阶段 14A Agent Runner v2 默认化：本轮提交，默认 Agent 对话走 Runner v2，显式 `RV_AGENT_RUNTIME_RUNNER_V2=0` 可回到旧主循环

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.96

当前已完成：
- 阶段 14 分批默认化计划已建立并推进：14A 已完成 Agent Runner v2 默认开启；14B 单独评估 Pipeline Runner v2；14C Channels v2 因飞书配置缺失继续阻塞。
- Agent Runner v2 默认化已完成：未设置 `RV_AGENT_RUNTIME_RUNNER_V2` 时走 Runner v2，显式 `0/false/off/no/disabled` 回到旧主循环，显式 `1/true/on/yes/enabled` 强制 Runner v2。
- 真实 Electron 默认路径已验证：sessionId 073783b3-27ae-49ec-b516-92de146e6572，日志确认切到 InProcessAgentRuntimeRunner，输出 stage14 default runner v2 ok。
- 真实 Electron 显式关闭回滚已验证：sessionId 70bf7de8-043a-49c2-81c4-28e49f15ff96，日志确认走旧 Adapter 主循环，输出 stage14 explicit off legacy ok。
- Runner v2 代码侧等价证据已补齐：自动重试、typed error 持久化、catch error SDKMessage 持久化、UI sdk_message 推送、重复 run_started / sdk_session 去重、Plan Mode 退出、Watchdog、Teams auto-resume。
- 真实 Electron Runner v2 已补跑通过：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- Pipeline 深水位真实 UI run 已补齐：sessionId 342a6f0f-bea1-40eb-9396-378685bfaadc 已到 developer / reviewer / tester / committer draft，写入完整 patch-work 与 patch-set。
- Git 写入防护已复验：HEAD / refs / index / local config 未被污染，committer 只生成 draft commit / PR 文档，未执行 git add / commit / push。
- Tester 证据保守判定已复验：真实 session 的 test-evidence 全部 passed；缺失或 failed/skipped evidence 仍由聚焦测试保守阻断。
- Codex Pipeline runner 已补强：CODEX_HOME/auth.json 支持、API key 模式隔离继承 CODEX_HOME、strict schema 递归校验、reviewer 空字符串保守拒绝、Git snapshot 清理宿主 GIT_* 环境并 fail closed、clean-env 单测通过。
- 已定位 Electron 9334 立即退出根因：已有 9333 Electron 实例持有 requestSingleInstanceLock()，结束旧实例后 9334 CDP 可连接。

当前仍未完成：
- 飞书入口与飞书群聊 MCP 受缺少 ~/.rv-insights/feishu.json 与 ~/.rv-insights-dev/feishu.json 阻塞；不能伪造通过。
- agentRuntimePipelineRunnerV2 与 agentRuntimeChannelsV2 默认值尚未修改；Pipeline Runner v2 默认化必须等 14A 提交后另开 14B，不能和 Agent Runner v2 同一提交一起默认开启。
- Channels v2 默认化必须等飞书配置存在并真实跑通飞书入口与群聊 MCP；缺配置时保持关闭。
- 删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容是更晚阶段事项；当前不能删除。

当前工作树注意事项：
- 先运行 git status --short。
- 只忽略 .DS_Store、docs/.DS_Store、improve/.DS_Store、improve/ui/.DS_Store 这类无关噪音。
- 不要把 .DS_Store、improve/、patch-work/ 或无关文件纳入提交。

下一步：
1. 复核上述文档和 git status。
2. 检查 ~/.rv-insights/feishu.json 与 ~/.rv-insights-dev/feishu.json；若仍不存在，继续明确记录阻塞，不伪造通过。
3. 确认阶段 14A 已单独提交；若尚未提交，先只提交 14A 相关文件，不纳入 .DS_Store、improve/、patch-work/ 或无关文件。
4. 进入阶段 14B 前先更新 tasks/todo.md 的执行计划，确认只评估 Pipeline Runner v2 默认化，不触碰 Channels v2 默认值，不删除 legacy adapter。
5. 阶段 14B 默认化前先跑并记录：bun run typecheck；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Pipeline 深水位 UI run；git diff --check。
6. 若实施 14B：调整 agentRuntimePipelineRunnerV2 默认策略，要求未设置 env 时走 Pipeline Runner v2，显式关闭 env 能回到 Pipeline legacy adapter，显式开启 env 继续强制 Pipeline Runner v2。
7. 不默认开启 agentRuntimeChannelsV2；不删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
8. 若飞书配置存在，可单独补跑 agentRuntimeChannelsV2 飞书入口与飞书群聊 MCP；无配置时继续记录阻塞。
9. 阶段 14B 完成后单独提交，提交信息用详细中文说明完成项、验证项和未完成项。
```
