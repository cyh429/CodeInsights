# Agent Runtime Event 契约

本文件定义 `AgentStreamEnvelope` / `AgentRuntimeEvent` 的实现细节。阶段 1 应优先落这份契约，再迁移 Runner。

## Envelope

```ts
interface AgentStreamEnvelope {
  schemaVersion: 1;
  sessionId: string;
  runId: string;
  sequence: number;
  createdAt: string;
  source: AgentEventSource;
  event: AgentRuntimeEvent;
}
```

规则：

- `runId` 在一次用户请求内保持不变；auto-resume、retry、deferred result 都沿用同一个 `runId`。
- `sequence` 由 Runner 在同一个 run 内单调递增，Runtime Service 只校验和持久化。
- Renderer reducer 按 `sequence` 幂等应用事件；重复 sequence 跳过，缺口触发补读 event log。
- `run_completed`、`run_failed`、`run_stopped` 是互斥终态，同一个 run 只能出现一个。

## 持久化

建议路径：

```text
~/.codeinsights/
  agent-sessions/
    {session-id}.sdk.jsonl       # SDKMessage 原始 transcript
    {session-id}.events.jsonl    # AgentStreamEnvelope 可重放事件
    {session-id}.runtime.json    # runtime manifest 引用、sdkSessionId、run 索引
```

| 数据 | 用途 | 是否广播 | 是否持久化 |
| --- | --- | --- | --- |
| SDKMessage | transcript/debug/resume | 否 | 是 |
| AgentStreamEnvelope | 实时 UI、渠道输出、恢复 UI 状态 | 是 | 是 |
| stderr/debug | 排障 | 开发态可选 | 可选 debug log |
| audit | 权限和宿主 side effect 审计 | 否 | 是 |

## SDKMessage 映射

| SDK 输入 | Runtime Event | 备注 |
| --- | --- | --- |
| assistant text delta/block | `assistant_delta` / `assistant_message` | delta 用于流式，message 用于完整回放 |
| assistant `tool_use` | `tool_started` | `toolCallId` 优先使用 SDK id |
| user `tool_result` | `tool_completed` | 输出只存 summary，原文保留在 SDKMessage |
| `tool_progress` | `tool_progress` | 长任务进度 |
| `tool_use_summary` | `tool_progress` 或 `tool_completed.outputSummary` | 视 SDK 语义映射 |
| `prompt_suggestion` | `prompt_suggestion` | UI 可选择展示 |
| system `task_*` | `agent_task_started/progress/completed` | 用于 SubAgent/Teams 视图 |
| assistant error block | `assistant_message(status: "error")` 或 `run_failed` | 致命错误才终止 run |
| SDK result success | `run_completed` | 终态来源 |
| SDK result error | `run_failed` | 带 `errorKind` |
| SDK terminal reason abort | `run_stopped` | 用户或 AbortSignal 停止 |
| retry attempt | `retry_scheduled` | 同 runId |
| compact start/end | `compact_started` / `compact_completed` | 保留上下文窗口状态 |

## 事件载荷最小字段

| 事件 | 必要字段 |
| --- | --- |
| `run_started` | `model`、`cwd`、`permissionMode`、`runtimeHash` |
| `sdk_session` | `sdkSessionId`、`resumeFrom?` |
| `assistant_delta` | `messageId`、`delta` |
| `assistant_message` | `messageId`、`contentBlocks`、`status` |
| `tool_started` | `toolCallId`、`name`、`inputSummary`、`riskLevel` |
| `tool_progress` | `toolCallId`、`message`、`progress?` |
| `tool_completed` | `toolCallId`、`status`、`outputSummary` |
| `permission_requested` | `requestId`、`toolName`、`riskLevel`、`inputSummary`、`scopeOptions` |
| `permission_resolved` | `requestId`、`decision`、`decidedBy`、`scope?` |
| `ask_user_requested` | `requestId`、`prompt`、`options?` |
| `ask_user_resolved` | `requestId`、`response`、`answeredBy` |
| `plan_mode_entered` | `requestId?`、`reason?` |
| `plan_mode_exited` | `decision`、`summary?` |
| `usage_updated` | `inputTokens?`、`outputTokens?`、`cacheTokens?`、`costUsd?` |
| `retry_scheduled` | `attempt`、`reason`、`delayMs` |
| `run_completed` | `resultSubtype`、`terminalReason?`、`usage`、`sdkSessionId?` |
| `run_failed` | `error`、`recoverable` |
| `run_stopped` | `reason`、`stoppedBy` |

## Reducer 对比

新旧 reducer 双跑时比较最终 view model：

- assistant 文本内容一致。
- tool timeline 数量、名称、状态一致。
- pending permission / AskUser 队列一致。
- usage、running、terminal status 一致。
- error title/message/retryable 一致。

不要求比较：

- 原始 SDKMessage 数量。
- 临时 debug/stderr。
- UI 内部排序缓存。
