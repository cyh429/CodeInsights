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
- docs/agent-refactor/baseline-runs/2026-05-22-stage-14B.md
- docs/agent-refactor/next-session-prompt.md

当前已完成并提交：
- 阶段 0-12 已完成并提交。
- 阶段 13 Runner v2 代码侧补强与 Pipeline / Codex guard 收尾均已完成并提交。
- 阶段 14 默认化评估计划已提交：02199299 docs(agent): 建立阶段14 Runner v2 默认化评估计划
- 阶段 14A Agent Runner v2 默认化已提交：88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化
- 阶段 14B Pipeline Runner v2 默认化已提交：be82e53d feat(agent): 完成阶段14B Pipeline Runner v2 默认化

当前版本：
- @rv-insights/shared：0.1.40
- @rv-insights/electron：0.0.97

当前已完成的默认化状态：
- 默认 Agent 对话走 Runner v2。
- `RV_AGENT_RUNTIME_RUNNER_V2=0/false/off/no/disabled` 可显式回到旧 Agent 主循环。
- 默认 Pipeline Claude 节点走 Pipeline Runner v2。
- `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0/false/off/no/disabled` 可显式回到 Pipeline legacy adapter。
- `agentRuntimeChannelsV2` 仍未默认开启。

阶段 14B 关键证据：
- Agent 默认 session：`073783b3-27ae-49ec-b516-92de146e6572`，未设置 `RV_AGENT_RUNTIME_RUNNER_V2`，日志确认走 Runner v2。
- Agent 显式关闭回滚 session：`70bf7de8-043a-49c2-81c4-28e49f15ff96`，`RV_AGENT_RUNTIME_RUNNER_V2=0`，日志确认走旧 Agent 主循环。
- 默认 Electron Pipeline 深水位 session：`a70c02d0-ff2f-4283-b121-cd963771fd9f`，未设置 `RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2`，日志确认 explorer / planner 使用 `InProcessAgentRuntimeRunner`，最终到 committer/completed。
- 默认深水位 run 已复验 Git guard：HEAD / refs / index / local config 未被污染，staged diff 为空，commit / PR 仅生成 draft。
- 默认深水位 run 的 patch-work 完整写入：`explorer/report-001.md`、`selected-task.md`、`plan.md`、`test-plan.md`、`dev.md`、`review.md`、`result.md`、`commit.md`、`pr.md`、`patch-set/*`。
- 默认深水位 run 的 `test-evidence.json` 全部 passed。
- 显式关闭回滚 session：`1112d7fc-ab4b-4e4b-bedf-193533a7daec`，`RV_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0`，日志确认 explorer 使用 `legacy adapter`，随后手动 stop 到 `terminated`。

当前仍未完成：
- 飞书入口与飞书群聊 MCP 受缺少 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json` 阻塞；不能伪造通过。
- Channels v2 默认化必须等飞书配置存在并真实跑通飞书入口与群聊 MCP；缺配置时保持关闭。
- 删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容是更晚阶段事项；当前不能删除。

当前工作树注意事项：
- 先运行 `git status --short`。
- 只忽略 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store` 这类无关噪音。
- 不要把 `.DS_Store`、`improve/`、`patch-work/` 或无关文件纳入提交。

下一步：
1. 先运行 `git status --short`，只忽略 `.DS_Store`、`docs/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store`。
2. 检查 `~/.rv-insights/feishu.json` 与 `~/.rv-insights-dev/feishu.json`；若仍不存在，继续明确记录阻塞，不伪造通过。
3. 若飞书配置存在，先更新 `tasks/todo.md` 进入阶段 14C 计划，再单独补跑 `agentRuntimeChannelsV2` 飞书入口与飞书群聊 MCP。
4. 若飞书配置仍不存在，不要默认开启 `agentRuntimeChannelsV2`。
5. 不删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容，除非先建立新的独立阶段计划和验证矩阵。
6. 后续任何非琐碎改动继续先写 `tasks/todo.md` 计划，完成后运行验证并单独提交。
```
