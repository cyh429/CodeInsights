# 下次启动 Codex 继续开发提示词

下次启动 Codex 后，可以直接发送下面这段提示词。

```text
请继续 RV-Insights 的 Agent 模式重构工作。

重要上下文：
- 项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
- 参考方案目录：docs/agent-refactor/
- 当前方案阶段已完成并提交：158d8a64 docs: 完成 Agent 模式重构方案阶段文档
- 阶段 0 冻结基线已完成并提交：47f8ad8d docs: 冻结 Agent 重构阶段 0 行为基线
- 阶段 0 基线证据：docs/agent-refactor/baseline-runs/2026-05-17-round-1.md
- 最新进度跟踪文件：docs/agent-refactor/development-checklist.md
- 当前代码实现尚未开始，下一步应从“阶段 1：Shared Event Contract”开始。

必须遵守：
- 客户端 UI 零可见变化，不改布局、样式、文案、入口、按钮行为或交互路径。
- 不引入本地数据库，不默认 Docker，不照搬 SaaS/IM-first 模型。
- 不默认 bypass 权限，外部渠道默认保守权限策略。
- 每阶段只改变一个主边界，阶段完成并通过验证后立即单独提交。
- 提交只包含该阶段相关文件，不纳入 .DS_Store、improve/ 临时文件或其他无关改动。
- 开始前先阅读 tasks/lessons.md、docs/agent-refactor/README.md、docs/agent-refactor/development-checklist.md、docs/agent-refactor/event-contract.md、docs/agent-refactor/baseline-runs/2026-05-17-round-1.md。
- 阶段 0 首轮仍有交互式缺口：并发、停止、权限 approve/deny、AskUser、Plan Mode、附件、additional directory、fork、rewind、MCP、飞书。阶段 1 如触碰这些边界，先补跑对应基线。
- 当前工作树可能只有 .DS_Store / improve/ 噪音文件，不要纳入提交。

本次请执行阶段 1：Shared Event Contract。
1. 在 packages/shared/src/agent/ 新增统一事件契约类型：AgentStreamEnvelope、AgentRuntimeEvent、AgentRuntimeErrorPayload、AgentEventSource。
2. 新增事件 schema guard / validator。
3. 新增 SDKMessage fixture 和 AgentStreamEnvelope fixture。
4. 新增旧 payload 到新 envelope 的 adapter。
5. 新增 event replay reducer 测试骨架。
6. 引入 agentRuntimeEventsV2 feature flag，默认 off。
7. 保留旧 AgentEvent，不改变 IPC 默认行为，不改变 Renderer 可见 UI。
8. 运行 bun run typecheck、相关 bun test、git diff --check。
9. 更新 docs/agent-refactor/development-checklist.md 和 tasks/todo.md。
10. 阶段完成后用详细中文 commit message 单独提交。
```
