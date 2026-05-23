# Agent 重构行为基线清单

本清单用于阶段 0。目标是在重构前把当前 Agent 行为固定下来，后续每个阶段都能对比“是否回退”。

## 记录方式

每条基线都记录四类结果：

- 输入：用户操作、workspace、channel、权限模式、附件。
- 预期 UI：消息流、工具活动、权限横幅、按钮状态。
- 预期存储：SDKMessage JSONL、session metadata、后续 event JSONL。
- 预期终态：running、completed、stopped、failed、pending interaction。

建议记录到 `docs/agent-refactor/baseline-runs/`，每次手工跑一轮生成一个 Markdown 文件。该目录只保存小型文本证据，不保存截图大文件。

## 基线场景

| 场景 | 输入 | 预期 UI | 预期存储 | 预期终态 |
| --- | --- | --- | --- | --- |
| 首条消息 | 新建 session，发送“列出当前工作区文件” | 出现 assistant 输出和可能的工具活动；标题自动生成 | session metadata 写入；SDKMessage JSONL 追加 | `run_completed` |
| 同会话并发 | 第一条未结束时再发送第二条 | 第二条被阻止或排队，行为与当前版本一致 | 不产生重复 SDK run | 第一条正常终态 |
| 用户停止 | 发送长任务后点击停止 | loading 清理；输入区恢复；消息流显示已停止 | 不再追加 assistant/tool 事件 | `run_stopped(reason: "user_abort")` |
| 权限批准 | 触发写文件或 shell 操作并 approve | 权限横幅消失；工具继续执行 | permission requested/resolved 都可追踪 | run 继续 |
| 权限拒绝 | 触发写文件或 shell 操作并 deny | 权限横幅消失；展示阻止结果 | permission resolved 为 denied | SDK 继续或 `run_stopped`，但不能卡住 |
| AskUser | 触发 AskUser 问题，切到设置页再回来响应 | pending 问题不丢；响应后继续 | ask requested/resolved 可追踪 | run 继续 |
| Plan Mode | 触发进入/退出计划模式 | UI 能区分计划交互和普通权限 | plan mode 事件可重放 | run 继续或等待用户 |
| MCP 可见性 | 启用一个 MCP server 后发送相关任务 | 工具列表/调用能体现该 MCP | runtime manifest hash 变化 | run completed |
| Skill mention | 启用 Skill 并在 prompt 中提及 | SDK 能看到 Skill 能力 | skill snapshot/hash 可追踪 | run completed |
| 文件上传 | 上传附件后发送总结任务 | 附件出现在 UI；模型可读取内容 | attachment ref 写入 session | run completed |
| 附加目录 | 配置 additional directory 后要求读取 | 只访问允许目录 | directory ref 写入 manifest | run completed 或权限询问 |
| resume | 打开旧 session 继续发送 | 历史语义延续 | sdkSessionId 或 legacy fallback 记录 | run completed |
| fork | 从旧消息 fork | 新 session 建立，源 session 不变 | fork source 记录 | 新 run completed |
| rewind | 回退到历史点继续 | UI 显示回退后的上下文 | resumeAtMessageUuid 或 fallback 记录 | run completed |
| 飞书入口 | 从飞书 chat 触发 Agent | 飞书收到降级输出；桌面可见 session | channel target/binding 记录 | run completed |
| 飞书群聊 MCP | 群聊动态 MCP 注入 | 只对该 run/channel 生效 | run-scoped MCP overlay 记录 | run completed |
| Pipeline 旁路 | Agent 重构前后执行现有 Pipeline 节点 | Pipeline UI 不受影响 | pipeline checkpoint 正常 | node completed |

## 通过标准

- 每个场景都能指出对应的 sessionId 和 runId。
- 终态只出现一次，不重复 complete/final message。
- 刷新或切换页面后，pending permission / AskUser 不丢失。
- 旧 session 不因新 manifest 或新 reducer 无法打开。
- 外部渠道不默认绕过权限；无法交互时进入桌面 pending 或按策略拒绝。
