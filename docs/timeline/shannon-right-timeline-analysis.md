# Shannon 右侧 Timeline 实现分析

## 1. 先说结论

Shannon 右侧这一栏，其实不是一个单独的“timeline 系统”，而是三层东西叠在一起：

1. 顶部的雷达动画：用来表现“哪些 agent/tool 还在跑、谁正在向中心推进”。
2. 中间的事件时间线：把后端抛出来的事件，整理成用户能读懂的一条条状态记录。
3. 历史恢复能力：页面刷新后，不是全丢，而是会从数据库把之前的事件重新拉回来，再重建 timeline。

更关键的一点是：

- 桌面端右侧面板当前主要吃的是“实时 SSE 事件 + Postgres `event_logs` 历史事件”。
- 仓库里还额外有一个基于 Temporal 历史回放生成的 `/timeline` 接口，但当前桌面端这个右侧面板并没有直接调用它。

所以如果你问“右侧 timeline 怎么实现”，准确答案应该是：

“前端主要消费流式事件和持久化事件；后端另外提供了一个更偏审计/回放用途的 Temporal timeline 构建器。”

## 2. 整体架构，一句话理解

可以把它理解成这条链路：

用户发起任务 -> 工作流/Agent/Tool 在后端执行 -> 后端不停发事件 -> 事件进入 Redis Stream 和 Postgres -> 前端通过 SSE 实时收事件，同时页面重开时从数据库补历史 -> Redux 存事件 -> 右侧面板把事件翻译成“正在思考 / 工具完成 / 全部完成”这种可读 UI

## 3. 后端是怎么产出 timeline 数据的

### 3.1 事件从哪里来

Shannon 后端在执行 workflow、agent、tool 的过程中，会不断抛出统一格式的流式事件。

核心定义在：

- `go/orchestrator/internal/activities/stream_events.go`

这里定义了很多事件类型，比如：

- `WORKFLOW_STARTED`
- `WORKFLOW_COMPLETED`
- `AGENT_STARTED`
- `AGENT_COMPLETED`
- `AGENT_THINKING`
- `TOOL_INVOKED`
- `TOOL_OBSERVATION`
- `PROGRESS`
- `WORKSPACE_UPDATED`

这些事件本质上都是“执行过程中的状态快照”。

比如 ReAct 工作流在每一轮会主动发：

- `PROGRESS`：第几轮推理
- `AGENT_STARTED`：开始 reasoning 或 acting

参考：

- `go/orchestrator/internal/workflows/patterns/react.go`
- `go/orchestrator/internal/activities/stream_messages.go`

`stream_messages.go` 里还能看到很多最终显示在 UI 上的人话文案，比如：

- `Finished thinking`
- `Action done`
- `Search`
- `File read`

也就是说，后端不是只传机器态事件名，它已经尽量把文案“翻译成人能看懂的状态”了。

### 3.2 事件先进入哪个总线

统一入口是：

- `go/orchestrator/internal/streaming/manager.go`

这里的 `Publish()` 干了几件关键事：

1. 给每个 workflow 事件分配递增 `seq`
2. 写入 Redis Stream
3. 把重要事件异步落到 Postgres `event_logs`
4. 给 SSE 订阅者分发

这一步是右侧 timeline 的核心中枢。

你可以把它理解成一个“事件交换站”：

- Redis 负责实时流转
- Postgres 负责历史留档
- SSE 负责推给浏览器

### 3.3 为什么刷新页面后 timeline 还能回来

因为事件会落到表：

- `event_logs`

表结构定义在：

- `migrations/postgres/004_event_logs.sql`

关键字段包括：

- `workflow_id`
- `type`
- `agent_id`
- `message`
- `payload`
- `timestamp`
- `seq`
- `stream_id`

这张表就是右侧时间线的“历史底稿”。

### 3.4 SSE 是怎么把事件推到前端的

管理端真实 SSE 服务在：

- `go/orchestrator/internal/httpapi/streaming.go`

网关代理入口在：

- `go/orchestrator/cmd/gateway/main.go`

对外暴露的地址是：

- `GET /api/v1/stream/sse?workflow_id=...`

这里有几个重要逻辑：

1. 支持 `Last-Event-ID` / `last_event_id`，断线后可续传
2. 内部事件名会映射成前端更容易消费的 SSE event 名
3. 支持先 replay 历史流，再订阅新流
4. 任务完成后会自动结束连接

尤其这段映射很重要：

- `LLM_PARTIAL` -> `thread.message.delta`
- `LLM_OUTPUT` -> `thread.message.completed`
- `STREAM_END` -> `done`

说明前端看到的不只是“后端原始事件”，而是经过一层 SSE 语义转换。

### 3.5 历史会话打开时，timeline 数据怎么补回来

桌面端不是每次都直接从 `/timeline` 拉。

它真正恢复历史时，主要走的是：

- `GET /api/v1/sessions/{session_id}/events`

前端调用位置：

- `desktop/lib/shannon/api.ts`

后端查询位置：

- `go/orchestrator/cmd/gateway/internal/handlers/session.go`

这里会把一个 session 下多个 turn 的 `event_logs` 查出来，再按 workflow 分组返回。

所以用户重新打开一次历史会话时，右侧 timeline 看到的内容，本质上是数据库里之前已经存下来的事件。

## 4. Temporal `/timeline` 接口是什么，它和右侧面板什么关系

仓库里还有一套专门的 timeline builder：

- `go/orchestrator/internal/httpapi/timeline.go`

这个接口会：

1. 直接读取 Temporal workflow history
2. 把底层 Temporal event 翻译成更友好的 timeline 事件
3. 可选异步持久化到 `event_logs`

比如它会把：

- `ACTIVITY_TASK_SCHEDULED`
- `ACTIVITY_TASK_STARTED`
- `ACTIVITY_TASK_COMPLETED`

合成更适合阅读的语句，例如：

- `Activity xxx completed in 2s`

它更像“确定性回放版时间线”，适合：

- 审计
- 排查
- 事后重建

但从当前代码看，桌面端右侧面板并没有直接调用这个接口。当前桌面 UI 主要还是：

- 运行时靠 SSE
- 历史恢复靠 `session events`

所以不要把“后端有 `/timeline` 接口”误以为“右侧面板完全由它驱动”。当前并不是这样。

## 5. 前端是怎么接住这些事件的

### 5.1 SSE 订阅层

前端实时订阅逻辑在：

- `desktop/lib/shannon/stream.ts`

这里的 `useRunStream()` 会：

1. 打开 `EventSource`
2. 订阅一大批事件类型
3. 把收到的事件 dispatch 到 Redux
4. 断线后指数退避重连
5. 记住 `lastEventId`，支持续传

还有一个很实用的细节：

- `thread.message.delta` 不会一小块一小块直接塞进 Redux
- 它先做缓冲，再按 `requestAnimationFrame` 合并后推入

这样做的好处是：减少 UI 高频抖动。

### 5.2 Redux 是 timeline 的中间层

核心在：

- `desktop/lib/features/runSlice.ts`

这个 slice 同时管理：

- `events`：给 timeline 用
- `messages`：给中间对话区用
- `status`：当前任务状态
- `swarm`：多 agent 状态和颜色注册表

这里有个非常关键的设计：

“同一批后端事件，并不一定都进入对话区；很多只进 timeline。”

例如：

- `AGENT_COMPLETED`
- `TOOL_INVOKED`
- `TOOL_OBSERVATION`

更多是作为执行痕迹保留在右侧 timeline，而不是聊天正文。

这也是为什么你看到右边很细，但中间对话区相对干净。

### 5.3 历史事件和实时事件是分开处理的

在 `runSlice.ts` 里，如果事件带有 `isHistorical: true`，它会：

- 保留在 `state.events` 里
- 但尽量不再生成对话区的状态消息

这样做是为了避免刷新页面后：

- 时间线重复
- 对话区也重复冒出一堆“状态 pill”

这是个很典型的“timeline 和 conversation 分轨渲染”的设计。

## 6. 右侧列表 timeline 是怎么渲染出来的

真正把事件变成 UI 列表的页面在：

- `desktop/app/(app)/run-detail/page.tsx`

展示组件在：

- `desktop/components/run-timeline.tsx`

### 6.1 页面层先做一轮“翻译”

`page.tsx` 里有几个函数专门干这件事：

- `categorizeEvent()`
- `getEventStatus()`
- `extractEventDetails()`
- `getFriendlyTitle()`

它们的作用可以通俗理解成：

1. 先判断这条事件属于 agent、tool、llm 还是 system
2. 再判断状态是 running、completed、failed
3. 再从 `payload` 或 message 里提取详情
4. 最后把后端原始事件名翻译成更像产品文案的标题

例如：

- `AGENT_THINKING` -> `Agent is thinking`
- `WORKFLOW_COMPLETED` -> `Workflow Completed`
- `BUDGET_THRESHOLD` -> `Budget Alert`

如果后端消息本身已经很友好，就优先显示 message。

### 6.2 timeline 不是把所有事件都生吞

`timelineEvents` 在生成时，会先过滤掉一些不适合直接展示的事件：

- `thread.message.delta`
- `thread.message.completed`
- `LLM_PROMPT`
- `LLM_OUTPUT`

原因很简单：

- 这些更偏“正文流式输出”
- 如果也塞进右侧 timeline，会非常噪音

同时它还会做一些去重，例如：

- 过多的 `BUDGET_THRESHOLD` 事件会被压缩

这一步很像“前端二次剪辑”。

### 6.3 为什么你看到的是“完成/进行中”的绿色圆点

`desktop/components/run-timeline.tsx` 会根据事件状态画不同图标：

- `completed` -> 绿色对勾
- `running` -> 脉冲圆点
- `failed` -> 红色警告图标

如果是 swarm 模式，还会额外按 agent 分配颜色。

也就是说，右侧列表不是单纯的文本日志，而是“状态图标 + 标题 + 时间 + 可展开详情”的结构化时间线。

### 6.4 为什么有些条目能点开 `Show details`

详情组件在：

- `desktop/components/collapsible-details.tsx`

逻辑很直接：

- 如果事件有 `payload`，就优先显示 JSON
- 如果是长文本思考内容，也可以折叠展开

所以它不是每条都能展开，只有带额外信息的事件才会有详情区。

## 7. 顶部那个雷达图是怎么动起来的

截图上方那块圆形动画不是列表组件的一部分，它是独立系统：

- `desktop/components/radar/RadarBridge.tsx`
- `desktop/components/radar/RadarCanvas.tsx`
- `desktop/lib/radar/store.ts`

### 7.1 `RadarBridge` 负责“把事件翻译成动画状态”

它会监听 Redux 的 `run.events`，然后做几件事：

1. 忽略内部系统 agent
2. 忽略纯元数据事件
3. 把“活跃事件”当成飞行中的对象
4. 把“完成事件”当成到达中心

代码里分了两类：

- `activeLike`
- `doneLike`

比如：

- `AGENT_STARTED`
- `AGENT_THINKING`
- `TOOL_INVOKED`

会让一个箭头飞起来。

而：

- `AGENT_COMPLETED`
- `TOOL_COMPLETED`

会让它结束或冲向中心。

### 7.2 `RadarCanvas` 负责真正画出来

`RadarCanvas.tsx` 用的是原生 Canvas，不是 DOM 列表。

它做的事情包括：

1. 画背景、网格、同心圆、十字轴
2. 为每个 agent 算一个固定角度
3. 根据任务进度，把箭头从外圈往中心移动
4. 画轨迹、标签、耗时
5. 完成时打 pulse 动画

所以你看到的那种“从外围慢慢向中心推进”的感觉，本质上是：

- 事件进入 radar store
- store 更新 `item/agent`
- canvas 每帧重画

这个部分很像一个小型状态可视化引擎。

## 8. 用户视角下，一次 timeline 刷新过程是怎样的

可以按下面这个顺序理解：

### 第 1 步：用户提交任务

前端提交任务后拿到 `workflow_id`，然后调用：

- `useRunStream(workflowId)`

### 第 2 步：后端开始执行并不断发事件

例如：

- `WORKFLOW_STARTED`
- `AGENT_STARTED`
- `AGENT_THINKING`
- `TOOL_INVOKED`
- `TOOL_OBSERVATION`
- `WORKFLOW_COMPLETED`

### 第 3 步：前端把事件塞进 Redux

实时事件进入：

- `state.run.events`

同时一部分事件也会影响：

- 对话区状态消息
- swarm agent registry
- browser mode
- review 状态

### 第 4 步：右侧 timeline 做“人话化”

`page.tsx` 把原始事件映射成：

- 标题
- 状态
- 时间
- 折叠详情

### 第 5 步：列表和雷达分别更新

- `RunTimeline` 更新纵向事件列表
- `RadarBridge + RadarCanvas` 更新顶部动画

### 第 6 步：刷新页面也能恢复

页面重新打开后，前端会调用：

- `getSessionEvents()`

从 `event_logs` 里把历史事件捞回来，再重新构建右侧 timeline。

## 9. 为什么 Shannon 要把“对话内容”和“timeline 事件”分开

这是这套设计里很聪明的一点。

如果把所有执行细节都塞进中间聊天区，会出现两个问题：

1. 用户正文会被大量状态刷屏
2. 事件语义和最终答案混在一起，阅读体验很差

所以 Shannon 采用了双通道：

- 中间对话区：只保留用户真正关心的内容
- 右侧 timeline：展示执行痕迹、工具调用、agent 进度

这也是为什么它看起来像一个“研究工作台”，而不是普通聊天框。

## 10. 实现上的几个关键设计点

### 10.1 事件是统一模型

无论 workflow、agent、tool，最后都尽量落成统一事件结构，这样前端比较好接。

### 10.2 先流式，再落库

实时体验靠 SSE，历史恢复靠 `event_logs`，两者互补。

### 10.3 timeline 会主动降噪

不是所有事件都显示，也不是原样全显示，会经过：

- 过滤
- 去重
- 标题翻译
- 详情折叠

### 10.4 雷达和列表是两套 UI 投影

它们吃的是同一批事件，但表达形式不同：

- 列表强调“发生了什么”
- 雷达强调“谁还在跑、进度往哪走”

### 10.5 Temporal timeline 更偏“确定性审计”

这个接口很有价值，但目前更像后备能力，不是桌面端右栏的主驱动源。

## 11. 如果你要自己复刻这个 timeline，最值得抄的思路

### 方案核心

1. 后端统一发事件，不要让前端猜状态
2. 实时走 SSE，历史走数据库
3. 前端做一层“事件到 UI 文案”的映射层
4. timeline 和 conversation 分开渲染
5. 动画视图和文本视图共享同一份事件源

### 最小可用版本

如果只做最小版本，其实只需要：

1. 后端提供 `WORKFLOW_STARTED / TOOL_INVOKED / TOOL_OBSERVATION / WORKFLOW_COMPLETED`
2. 用 SSE 推给前端
3. 前端 Redux 存 `events`
4. 右侧用一个 `RunTimeline` 风格组件画列表

雷达动画可以后面再加。

## 12. 相关代码入口

### 前端

- `desktop/app/(app)/run-detail/page.tsx`
- `desktop/components/run-timeline.tsx`
- `desktop/components/collapsible-details.tsx`
- `desktop/components/radar/RadarBridge.tsx`
- `desktop/components/radar/RadarCanvas.tsx`
- `desktop/lib/features/runSlice.ts`
- `desktop/lib/shannon/stream.ts`
- `desktop/lib/shannon/api.ts`

### 后端

- `go/orchestrator/internal/activities/stream_events.go`
- `go/orchestrator/internal/activities/stream_messages.go`
- `go/orchestrator/internal/streaming/manager.go`
- `go/orchestrator/internal/httpapi/streaming.go`
- `go/orchestrator/cmd/gateway/main.go`
- `go/orchestrator/cmd/gateway/internal/handlers/session.go`
- `go/orchestrator/internal/httpapi/timeline.go`

### 数据库与文档

- `migrations/postgres/004_event_logs.sql`
- `docs/task-history-and-timeline.md`

## 13. 最后一句话总结

Shannon 右侧 timeline 的本质，不是“把日志打印出来”，而是：

“后端把执行过程标准化为事件流，前端再把这条事件流分别投影成右侧事件列表和顶部雷达动画；实时看 SSE，历史看 `event_logs`，需要确定性回放时再走 Temporal timeline builder。”
