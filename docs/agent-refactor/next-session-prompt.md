# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 CodeInsights 的开发工作，优先按 Agent 模式重构主线继续推进。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前主分支：main

启动后必须先运行：
- git status --short
- git log -1 --oneline

必须先阅读：
- AGENTS.md
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
- docs/agent-refactor/baseline-runs/2026-05-22-stage-14C.md
- docs/agent-refactor/baseline-runs/2026-05-22-stage-15.md
- docs/agent-refactor/next-session-prompt.md

当前最新提交可能是本次文档状态同步提交；其前一个公开文档基线为：
- 842dc597 merge: 删除 README 首屏辅助视频链接

注意：README 首屏辅助链接清理和本次文档状态同步都不是新的 Agent runtime 实现阶段。不要把它们当作阶段 16 或旧路径清理已完成。

当前已完成并提交：
- 阶段 0-12 已完成并提交。
- 阶段 13 Runner v2 代码侧补强与 Pipeline / Codex guard 收尾均已完成并提交。
- 阶段 14 默认化评估计划已提交：02199299 docs(agent): 建立阶段14 Runner v2 默认化评估计划
- 阶段 14A Agent Runner v2 默认化已提交：88c03213 feat(agent): 完成阶段14A Agent Runner v2 默认化
- 阶段 14B Pipeline Runner v2 默认化已提交：be82e53d feat(agent): 完成阶段14B Pipeline Runner v2 默认化
- 阶段 14C Channels v2 默认化已按用户指示排除飞书真实入口阻塞后完成代码侧评估。
- 阶段 15 Agent Runner 链路手动切换已提交：9e9efd1e feat(agent): 完成阶段15 Runner 链路手动切换
- 项目公开名已统一为 CodeInsights，并完成中英文 README、真实运行截图/录屏、GitHub 附件视频播放器、20 秒介绍视频、素材目录和透明外缘主图标相关收尾。
- 模型配置页 CodeInsights 官方供应商推广卡片已移除。
- README 首屏红框内三个辅助链接已删除：`真实运行录屏文件`、`20 秒概念介绍`、`视频设计说明` 及英文对应项；只保留 `项目主页 / Homepage`，视频播放器和第二行章节导航保留。

当前版本：
- 根包：codeinsights@0.1.1
- @codeinsights/shared：0.1.42
- @codeinsights/core：0.2.12
- @codeinsights/ui：0.1.4
- @codeinsights/electron：0.0.103

当前已完成的默认化状态：
- 默认 Agent 对话走 Runner v2。
- `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0/false/off/no/disabled` 可显式回到旧 Agent 主循环。
- 桌面 Agent 输入区可手动选择后续发送走 `Runner v2` 或 `Legacy`；env 显式关闭仍优先硬回滚旧主循环。
- 默认 Pipeline Claude 节点走 Pipeline Runner v2。
- `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0/false/off/no/disabled` 可显式回到 Pipeline legacy adapter。
- 默认 `agentRuntimeChannelsV2` 开启。
- `CODEINSIGHTS_AGENT_RUNTIME_CHANNELS_V2=0/false/off/no/disabled` 可显式回到旧 Feishu bridge 路径。

阶段 14B 关键证据：
- Agent 默认 session：`073783b3-27ae-49ec-b516-92de146e6572`，未设置 `CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2`，日志确认走 Runner v2。
- Agent 显式关闭回滚 session：`70bf7de8-043a-49c2-81c4-28e49f15ff96`，`CODEINSIGHTS_AGENT_RUNTIME_RUNNER_V2=0`，日志确认走旧 Agent 主循环。
- 默认 Electron Pipeline 深水位 session：`a70c02d0-ff2f-4283-b121-cd963771fd9f`，未设置 `CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2`，日志确认 explorer / planner 使用 `InProcessAgentRuntimeRunner`，最终到 committer/completed。
- 默认深水位 run 已复验 Git guard：HEAD / refs / index / local config 未被污染，staged diff 为空，commit / PR 仅生成 draft。
- 默认深水位 run 的 patch-work 完整写入：`explorer/report-001.md`、`selected-task.md`、`plan.md`、`test-plan.md`、`dev.md`、`review.md`、`result.md`、`commit.md`、`pr.md`、`patch-set/*`。
- 默认深水位 run 的 `test-evidence.json` 全部 passed。
- 显式关闭回滚 session：`1112d7fc-ab4b-4e4b-bedf-193533a7daec`，`CODEINSIGHTS_AGENT_RUNTIME_PIPELINE_RUNNER_V2=0`，日志确认 explorer 使用 `legacy adapter`，随后手动 stop 到 `terminated`。

当前仍未完成：
- 飞书入口与飞书群聊 MCP 仍受缺少 `~/.codeinsights/feishu.json` 与 `~/.codeinsights-dev/feishu.json` 阻塞；阶段 14C 不声明真实飞书通过，不能伪造通过。
- 旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 和旧 session JSONL 兼容仍保留；删除它们是后续独立阶段事项，当前不能直接删除。
- 阶段 6 的真实插件启用/禁用 Electron UI 交互仍只由聚焦测试覆盖，如要对外声明完整通过，需要补真实桌面壳验证。
- 根许可证仍未最终收敛：README 当前标注 License TBD，正式发布前仍需补 `LICENSE` / `NOTICE` 决策。

当前工作树注意事项：
- 先运行 `git status --short`。
- 只忽略 `.DS_Store`、`docs/.DS_Store`、`assets/.DS_Store`、`assets/icon/.DS_Store`、`improve/.DS_Store`、`improve/ui/.DS_Store`、`docs/assets/readme/real-runs/frames/` 这类无关噪音。
- 不要把 `.DS_Store`、`improve/`、`patch-work/` 或无关文件纳入提交。
- 如果看到 `assets/icon/CodeInsights.png` 未提交变更，先确认它是否属于用户正在处理的图标素材任务；不要顺手覆盖或提交。

下一步：
1. 不要删除旧 Agent 主循环、Pipeline legacy adapter、旧 Feishu bridge 或旧 session JSONL 兼容，除非先建立新的独立阶段计划和验证矩阵。
2. 若用户提供飞书配置或要求声明飞书真实可用，先单独补飞书入口与飞书群聊 MCP 真实验证；缺配置时继续记录为真实飞书阻塞。
3. 若用户要求进入稳定化/清理阶段，先在 `tasks/todo.md` 顶部写计划，明确清理范围、回滚点、验证命令和旧 session 兼容策略。
4. 后续任何非琐碎改动继续先写 `tasks/todo.md` 计划，完成后运行适用验证并单独提交。
```
