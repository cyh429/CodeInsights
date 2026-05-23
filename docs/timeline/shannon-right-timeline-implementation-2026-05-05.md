# Shannon 右侧 Timeline 实现（通俗版）

> 针对你截图中红框的 **Execution Timeline**（右侧雷达 + 事件列表）

## 1. 先用一句话讲清楚

Shannon 右侧 timeline 不是“前端自己拼出来的假进度条”，而是：

1. 后端把执行过程持续发成事件流（SSE）。
2. 前端一边实时收事件，一边把关键事件存进 Redux。
3. 右侧面板把这些事件翻译成“人能看懂”的节点（如 *Agent is thinking*、*Action done*）。
4. 刷新页面时，再从数据库 `event_logs` 把历史事件补回来，重建 timeline。

---

## 2. 你看到的右侧区域，其实有两层

### 2.1 顶部雷达动画（Radar）

- 位置：`desktop/components/radar/RadarBridge.tsx:50` + `desktop/components/radar/RadarCanvas.tsx`
- 作用：把 agent/tool 活动可视化成“飞行到中心”的动画。

关键逻辑：

- `RadarBridge` 监听 Redux 里的 `run.events`（`RadarBridge.tsx:51`）。
- 遇到“活跃事件”（如 `AGENT_STARTED` / `TOOL_INVOKED`）就创建或延长飞行（`RadarBridge.tsx:137-255`）。
- 遇到 `AGENT_COMPLETED` / `TOOL_COMPLETED` 会加速飞到中心并移除（`RadarBridge.tsx:258-301`）。
- `WORKFLOW_COMPLETED` 时，当前 workflow 的剩余飞行统一收尾（`RadarBridge.tsx:304-329`）。

所以雷达是“行为态动画层”。

### 2.2 下方纵向事件列表（Timeline List）

- 位置：`desktop/components/run-timeline.tsx:39`
- 作用：把事件渲染为“状态图标 + 标题 + 时间 + 可展开详情”。

关键逻辑：

- 完成态显示绿色 `CheckCircle`，运行态显示脉冲圆点（`run-timeline.tsx:52-66`）。
- 如果事件带 `details`，可展开查看 JSON/文本细节（`run-timeline.tsx:78-83`）。

所以列表是“可读日志层”。

---

## 3. 后端如何产出 timeline 数据

## 3.1 事件类型先标准化

- 位置：`go/orchestrator/internal/activities/stream_events.go:11-73`

这里统一定义了事件类型：`AGENT_STARTED`、`AGENT_THINKING`、`TOOL_INVOKED`、`WORKFLOW_COMPLETED`、`STREAM_END` 等。  
工作流执行时通过 `EmitTaskUpdate(...)` 发布事件（`stream_events.go:86-104`）。

## 3.2 事件文案先“人话化”

- 位置：`go/orchestrator/internal/activities/stream_messages.go`

很多你在 UI 上看到的文案直接由这里生成，比如：

- `MsgReactLoopDone()` -> `Finished thinking`（`stream_messages.go:179-190` 一组收尾文案）
- `MsgReactActingDone()` -> `Action done`（同文件下半部分）
- `MsgCombiningResults()` -> `Pulling it all together`（`stream_messages.go:178-183`）

也就是说，后端不仅发“事件类型”，还尽量发可展示文本。

## 3.3 事件进入流管理器（Redis + 持久化）

- 位置：`go/orchestrator/internal/streaming/manager.go`

`Publish(...)` 会做这些事（`manager.go:387-504`）：

1. 给事件分配递增 `seq`（`manager.go:392-401`）
2. 写入 Redis Stream，并拿到 `stream_id`（`manager.go:410-436`）
3. 重要事件异步入库（`manager.go:469-485`）

持久化策略：

- 重要事件默认持久化，`LLM_PARTIAL` 这类高频增量不落库（`manager.go:512-520` 及后续 `shouldPersistEvent`）。

## 3.4 SSE 接口把内部事件映射给前端

- 位置：`go/orchestrator/internal/httpapi/streaming.go:84-410`

关键点：

- 接口：`GET /stream/sse?workflow_id=...`（`streaming.go:84-90`）。
- 支持断线续传：`Last-Event-ID` / `last_event_id`（`streaming.go:103-127`）。
- 事件名映射：
  - `LLM_PARTIAL` -> `thread.message.delta`（`streaming.go:152-159`）
  - `LLM_OUTPUT` -> `thread.message.completed`（`streaming.go:160-172`）
  - `STREAM_END` -> `done`（`streaming.go:174-176`）
- 先 replay 漏掉的事件，再订阅新事件（`streaming.go:253-301`）。

## 3.5 网关对外暴露 `/api/v1/stream/sse`

- 位置：`go/orchestrator/cmd/gateway/internal/proxy/streaming.go:40-43`

网关会把：

- `/api/v1/stream/sse` 转成管理端 `/stream/sse`

并配置 SSE 相关 header/flush（`streaming.go:70-86`）。

## 3.6 刷新后为什么还能看到历史 timeline

数据表：

- `event_logs`（`migrations/postgres/004_event_logs.sql:5-17`）
- 唯一索引防重复（`004_event_logs.sql:46-49`）

历史查询接口（按 session 聚合 turn）：

- `GET /api/v1/sessions/{session_id}/events`
- 查询实现：`go/orchestrator/cmd/gateway/internal/handlers/session.go:704-834`
- 查询来源就是 `event_logs`，并过滤 `LLM_PARTIAL`（`session.go:710-712`）

---

## 4. 前端如何把后端事件变成右侧 timeline

## 4.1 打开流：EventSource + 自动重连

- 位置：`desktop/lib/shannon/stream.ts`

`useRunStream(workflowId)` 会：

1. 通过 `getStreamUrl` 拿 SSE 地址（`stream.ts:66-69`，`api.ts:238-254`）
2. 建立 `EventSource`
3. 监听几十种事件类型并 `dispatch(run/addEvent)`（`stream.ts:142-221`）
4. 记录 `lastEventId` 供重连续传（`stream.ts:95-99`）
5. 指数退避重连（`stream.ts:248-260`）

优化点：

- `thread.message.delta` 先缓冲再合并，减少抖动（`stream.ts:101-129`）。

## 4.2 Redux 是时间线中枢

- 位置：`desktop/lib/features/runSlice.ts:212-360`

`addEvent` 做了几件关键事：

- 所有事件先进 `state.events`（`runSlice.ts:232-240`）
- 历史事件 `isHistorical` 只用于 timeline，不重复生成会话消息（`runSlice.ts:242-265`）
- 工作流收尾事件会更新状态（`done` / `WORKFLOW_COMPLETED`）（`runSlice.ts:323-360`）

## 4.3 历史会话打开时，补历史事件

- 位置：`desktop/app/(app)/run-detail/page.tsx:375-481`

流程：

1. 调 `getSessionEvents(sessionId, ...)` 拉历史事件（`page.tsx:377`）
2. 把各 turn 的事件合并成 `allEvents`（`page.tsx:396`）
3. 过滤掉不需要重复渲染到 timeline 的噪音事件
4. 以 `isHistorical: true` 再喂回 Redux（`page.tsx:478-481`）

## 4.4 timeline 列表的“翻译层”

- 位置：`desktop/app/(app)/run-detail/page.tsx:1409-1632`

核心逻辑：

- `categorizeEvent`：把事件分为 agent/llm/tool/system（`page.tsx:1410-1416`）
- `getEventStatus`：推导 completed/running/failed（`page.tsx:1419-1429`）
- `getFriendlyTitle`：把原始 message 变成短标题（`page.tsx:1469-1540`）
- `extractEventDetails`：从 payload/message 提取可展开详情（`page.tsx:1431-1467`）
- 过滤掉 `thread.message.delta` 等高噪声事件（`page.tsx:1546-1554`）
- 对 `BUDGET_THRESHOLD` 做去重限量（`page.tsx:1556-1595`）

最终输出 `timelineEvents` 给 `<RunTimeline />`（`page.tsx:2325-2329`）。

## 4.5 右侧面板何时显示

- 位置：`desktop/app/(app)/run-detail/page.tsx:2295-2339`

当 `showTimeline=true` 且存在事件或任务在 running 时显示。  
面板由三块组成：

1. 标题栏 `Execution Timeline`
2. 雷达 `<RadarCanvas />`
3. 列表 `<RunTimeline />`

---

## 5. 端到端时序（从一次提问开始）

1. 用户发起任务，后端 workflow 开始执行。
2. workflow/agent/tool 不断发 `EmitTaskUpdate` 事件。
3. `streaming.Manager.Publish` 把事件写进 Redis Stream，并异步写 `event_logs`。
4. SSE `/stream/sse` 把事件映射为前端可消费名称推给浏览器。
5. 前端 `useRunStream` 接收事件并 dispatch 到 Redux `run.events`。
6. `RadarBridge` 读 `run.events` 画飞行态与完成态动画。
7. `run-detail` 把 `run.events` 转成 `timelineEvents`（分类、状态、友好标题、详情）。
8. `RunTimeline` 渲染右侧纵向执行记录。
9. 页面刷新时，通过 `/sessions/{id}/events` 从 `event_logs` 重建右侧 timeline。

---

## 6. 一个容易混淆的点：`/timeline` 接口

仓库里确实有 Temporal 回放版 timeline：

- `go/orchestrator/internal/httpapi/timeline.go:22-120`

它是把 Temporal 历史映射成人类可读事件（`timeline.go:127-260`），并可选持久化。  
但当前这块桌面右侧面板，主路径依然是：

- 实时：SSE 事件流
- 历史：`event_logs` + `/sessions/{id}/events`

不是直接每次调用 `/api/v1/tasks/{id}/timeline` 来驱动 UI。

---

## 7. 总结（面向实现）

如果你要复刻 Shannon 这套右侧 timeline，核心设计是：

1. **后端先统一事件协议**（type/message/payload/seq/stream_id）。
2. **实时与历史分层**：Redis/SSE 负责实时，Postgres `event_logs` 负责回放。
3. **前端建立事件中枢**：所有事件先入 Redux，再投影到不同 UI（雷达、列表、对话）。
4. **UI 做语义翻译和降噪**：不是原样打印日志，而是“可读状态时间线”。

