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
- 阶段 0-12 已完成并提交。
- 阶段 13 Runner v2 代码侧补强：328b3c96 feat(agent): 补齐阶段13 Runner v2 等价证据
- 阶段 13 sdk_session 去重修复：46e62a75 fix(agent): 补强阶段13 sdk_session 去重证据
- 阶段 13 Plan Mode 退出证据补强：acc769f1 fix(agent): 补强阶段13 Plan Mode 退出证据
- 阶段 13 Watchdog / Teams auto-resume 证据补强：b3d0517e fix(agent): 补强阶段13 Watchdog 与 Teams auto-resume 证据
- 阶段 13 Pipeline planner fallback 证据补强：6171f164 fix(agent): 补强阶段13 Pipeline planner fallback 证据
- 阶段 13 文档交接状态更新：353c5c53 docs(agent): 同步阶段13最新状态并更新继续开发提示词
- 阶段 13 Pipeline 与 Codex guard 收尾证据：10356a3a fix(agent): 收尾阶段13 Pipeline 与 Codex guard 证据
- 阶段 14 默认化评估计划：02199299 docs(agent): 建立阶段14 Runner v2 默认化评估计划

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.95

当前已完成：
- 阶段 14 分批默认化计划已建立：14A 只评估 Agent Runner v2 默认开启；14B 单独评估 Pipeline Runner v2；14C Channels v2 因飞书配置缺失继续阻塞。
- Runner v2 代码侧等价证据已补齐：自动重试、typed error 持久化、catch error SDKMessage 持久化、UI sdk_message 推送、重复 run_started / sdk_session 去重、Plan Mode 退出、Watchdog、Teams auto-resume。
- 真实 Electron Runner v2 已补跑通过：发送、停止、权限 approve / deny、AskUser、Plan Mode、旧 session resume、同会话并发、附件、additional directory、fork、rewind。
- Pipeline 深水位真实 UI run 已补齐：sessionId 342a6f0f-bea1-40eb-9396-378685bfaadc 已到 developer / reviewer / tester / committer draft，写入完整 patch-work 与 patch-set。
- Git 写入防护已复验：HEAD / refs / index / local config 未被污染，committer 只生成 draft commit / PR 文档，未执行 git add / commit / push。
- Tester 证据保守判定已复验：真实 session 的 test-evidence 全部 passed；缺失或 failed/skipped evidence 仍由聚焦测试保守阻断。
- Codex Pipeline runner 已补强：CODEX_HOME/auth.json 支持、API key 模式隔离继承 CODEX_HOME、strict schema 递归校验、reviewer 空字符串保守拒绝、Git snapshot 清理宿主 GIT_* 环境并 fail closed、clean-env 单测通过。
- 已定位 Electron 9334 立即退出根因：已有 9333 Electron 实例持有 requestSingleInstanceLock()，结束旧实例后 9334 CDP 可连接。

当前仍未完成：
- 飞书入口与飞书群聊 MCP 受缺少 ~/.rv-insights/feishu.json 与 ~/.rv-insights-dev/feishu.json 阻塞；不能伪造通过。
- 当前尚未修改 agentRuntimeRunnerV2 / agentRuntimePipelineRunnerV2 / agentRuntimeChannelsV2 默认值；默认 Agent 对话仍走旧 Orchestrator 主循环。
- 阶段 14A 尚未实现：需要先做默认化前验证，再只修改 Agent Runner v2 默认策略和必要测试/文档。
- Pipeline Runner v2 默认化必须等 14A 通过并单独提交后另开 14B；不能和 Agent Runner v2 同一提交一起默认开启。
- Channels v2 默认化必须等飞书配置存在并真实跑通飞书入口与群聊 MCP；缺配置时保持关闭。
- 删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容是更晚阶段事项；当前不能删除。

当前工作树注意事项：
- 先运行 git status --short。
- 只忽略 .DS_Store、docs/.DS_Store、improve/.DS_Store、improve/ui/.DS_Store 这类无关噪音。
- 不要把 .DS_Store、improve/、patch-work/ 或无关文件纳入提交。

下一步：
1. 复核上述文档和 git status。
2. 检查 ~/.rv-insights/feishu.json 与 ~/.rv-insights-dev/feishu.json；若仍不存在，继续明确记录阻塞，不伪造通过。
3. 进入阶段 14A 前先更新 tasks/todo.md 的执行计划，确认只修改 Agent Runner v2 默认开关和必要测试/文档，不触碰 Pipeline / Feishu 默认值。
4. 默认化前先跑并记录：bun run typecheck；Agent / Runtime / Event Log / Renderer atoms 聚焦测试；Pipeline 聚焦测试；clean-env Codex runner 单测；真实 Electron Agent 交互复核；git diff --check。
5. 实现 14A：调整 agentRuntimeRunnerV2 默认策略，要求未设置 env 时走 Runner v2，显式关闭 env 能回到旧 Agent 主循环，显式开启 env 继续强制 Runner v2。
6. 为 14A 补默认开启 / 显式关闭聚焦测试，并复跑同一验证矩阵；真实 Electron 需要证明默认 Agent 对话走 Runner v2，显式关闭能回到旧主循环。
7. 不默认开启 agentRuntimePipelineRunnerV2；不默认开启 agentRuntimeChannelsV2；不删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容。
8. 若飞书配置存在，可单独补跑 agentRuntimeChannelsV2 飞书入口与飞书群聊 MCP；无配置时继续记录阻塞。
9. 阶段 14A 完成后单独提交，提交信息用详细中文说明完成项、验证项和未完成项，不纳入 .DS_Store、improve/、patch-work/ 或无关文件。
```
