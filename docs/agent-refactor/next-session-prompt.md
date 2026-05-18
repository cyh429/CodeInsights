# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

重要上下文：
- 项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
- 参考方案目录：docs/agent-refactor/
- 当前方案阶段已完成并提交：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 阶段 0 冻结基线已完成并提交：47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线
- 阶段 1 Shared Event Contract 已完成并提交：d9801cf9 feat(shared): 完成 Agent 重构阶段 1 事件契约
- 阶段 2 Event Log 双写已完成并提交：04f23aa6 feat(agent): 完成 Agent 重构阶段 2 事件日志双写
- 阶段 0 基线证据：docs/agent-refactor/baseline-runs/2026-05-17-round-1.md
- 最新进度跟踪文件：docs/agent-refactor/development-checklist.md
- 当前最新状态：阶段 2 已在旧 Agent 运行路径旁边写入 `{session-id}.events.jsonl`，Renderer 仍走旧路径，Agent 模式对话当前不可见感知。
- 下一步应从“阶段 3：In-process AgentRuntimeRunner”开始。

必须遵守：
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS/IM-first 模型。
- 不默认 bypass 权限，外部渠道默认保守权限策略。
- 每阶段只改变一个主边界，阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件，不纳入 .DS_Store、improve/ 临时文件或其他无关改动。
- 开始前先阅读 tasks/lessons.md、docs/agent-refactor/README.md、docs/agent-refactor/development-checklist.md、docs/agent-refactor/event-contract.md、docs/agent-refactor/baseline-runs/2026-05-17-round-1.md。
- 阶段 0 首轮仍有交互式缺口：并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书。阶段 3 会触碰 SDK query / Runner 边界，开始前优先评估并补跑发送、停止、resume、权限、AskUser 相关基线。
- 当前工作树可能只有 .DS_Store / improve/ 噪音文件，不要纳入提交。

阶段 1 已完成内容：
1. packages/shared/src/agent/runtime-events.ts 已新增 AgentStreamEnvelope、AgentRuntimeEvent、AgentRuntimeErrorPayload、AgentEventSource。
2. 已新增 schema guard / validator、终态识别、旧 AgentEvent / AgentStreamPayload / SDKMessage adapter、event replay reducer 测试骨架。
3. packages/shared/src/agent/runtime-events.test.ts 已覆盖 text、tool、permission、AskUser、usage、complete、error。
4. agentRuntimeEventsV2 feature flag 默认 off。
5. @rv-insights/shared 已升级到 0.1.34。
6. 旧 AgentEvent、旧 IPC 默认行为、旧 Renderer reducer 和客户端 UI 均未改变。

阶段 2 已完成内容：
1. apps/electron/src/main/lib/agent-runtime-event-log.ts 已新增 AgentRuntimeEventLogWriter。
2. 已新增 {session-id}.events.jsonl 旁路写入与读取，SDKMessage 原 JSONL 继续作为 Renderer / resume 主数据源。
3. 每次 run 已生成独立 runId，sequence 按 run 单调递增，并对 run_completed / run_failed / run_stopped 做终态去重。
4. 已双写 run_started、sdk_session、assistant/tool、usage_updated、终态事件。
5. 权限和 AskUser 已记录 requested/resolved。
6. shadow compare 仅写主进程开发日志，不在 UI 展示。
7. @rv-insights/shared 已升级到 0.1.35，@rv-insights/electron 已升级到 0.0.79。
8. 阶段 2 验证通过：bun run typecheck；bun test packages/shared/src/agent/runtime-events.test.ts apps/electron/src/main/lib/agent-runtime-event-log.test.ts apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts；git diff --check。
9. 全量 bun test 仍在 412 pass 后复现既有 Electron named export 问题：Export named 'BrowserWindow' not found in module .../electron/index.js；阶段 2 相关聚焦测试单独通过。

本次请执行阶段 3：In-process AgentRuntimeRunner。
1. 新增 apps/electron/src/main/lib/agent-runtime-runner.ts。
2. 新增 agent-runtime-types.ts，定义 AgentRuntimeRunInput、Runner 输出、权限/AskUser callback、store interface。
3. 新增 agent-sdk-env.ts，迁移 SDK env 构建，但保持 buildSdkEnv 行为不变。
4. 新增 agent-sdk-message-converter.ts，封装 SDKMessage 到 AgentStreamEnvelope 的转换。
5. Runner 支持 AgentRuntimeRunInput，并输出 AsyncIterable<AgentStreamEnvelope>。
6. Runner 通过 callback 请求权限和 AskUser，不直接写 IPC。
7. Runner 通过 store interface 写 SDKMessage，不直接操作 Renderer。
8. Orchestrator 通过 agentRuntimeRunnerV2 feature flag 调用 Runner，默认继续旧路径或保持可回滚。
9. 保留旧 Orchestrator SDK query 路径，Renderer UI 零可见变化。
10. 补充 Runner mock SDK stream 单元测试，覆盖发送、停止、resume、权限、AskUser 和错误终态。
11. 验证至少运行 bun run typecheck、Runner / event log / Orchestrator 聚焦测试、git diff --check；如全量 bun test 仍失败，记录既有 Electron mock 问题。
12. 更新 docs/agent-refactor/development-checklist.md 和 tasks/todo.md。
13. 阶段完成后用详细中文 commit message 单独提交。
```
