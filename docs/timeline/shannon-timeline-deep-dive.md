# Shannon Timeline 功能深度拆解分析

> **文档版本**: v1.0  
> **生成日期**: 2026-05-04  
> **分析范围**: Shannon 平台 Task History & Timeline 全链路实现  
> **源码路径**: `/Users/zq/Desktop/ai-projs/posp/template/Shannon/`

---

## 目录

- [一、功能概述与架构定位](#一功能概述与架构定位)
- [二、三层数据架构](#二三层数据架构)
- [三、后端实现：Timeline 构建引擎](#三后端实现timeline-构建引擎)
- [四、后端实现：流式事件系统](#四后端实现流式事件系统)
- [五、前端实现：Timeline 可视化](#五前端实现timeline-可视化)
- [六、前端实现：事件状态机与 Redux 管理](#六前端实现事件状态机与-redux-管理)
- [七、数据流全链路追踪](#七数据流全链路追踪)
- [八、关键设计决策与权衡](#八关键设计决策与权衡)
- [九、性能优化策略](#九性能优化策略)
- [十、可借鉴的设计模式](#十可借鉴的设计模式)
- [十一、潜在改进方向](#十一潜在改进方向)
- [附录：核心文件索引](#附录核心文件索引)

---

## 一、功能概述与架构定位

### 1.1 什么是 Shannon Timeline

Shannon 的 Timeline（执行时间线）是一个**多源融合、确定性重建**的任务执行可视化系统。它不依赖单一数据源，而是整合了三种不同语义的事件流：

| 数据源 | 存储位置 | 生命周期 | 用途 |
|--------|---------|----------|------|
| **SSE 实时流** | Redis Streams | ~24h TTL | 实时推送、断线重连恢复 |
| **应用级事件日志** | PostgreSQL `event_logs` | 永久 | 审计追踪、页面刷新加载 |
| **Temporal 工作流历史** | Temporal 内部 DB | 永久 | 确定性重建、完整性保证 |

### 1.2 架构定位

```
┌──────────────────────────────────────────────────────────────┐
│                      用户界面层 (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 对话视图      │  │ Timeline 面板 │  │ Swarm 任务板 │       │
│  │ Conversation │  │   Timeline   │  │  Task Board  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     状态管理层 (Redux)                         │
│           runSlice.ts — 事件去重、消息重构、状态机               │
└──────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   SSE 实时流     │ │  /events API    │ │ /timeline API   │
│  Redis Streams  │ │  event_logs     │ │ Temporal History│
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 二、三层数据架构

### 2.1 Temporal History（权威源）

Temporal 工作流引擎将所有执行事件以**追加日志**形式持久化。Shannon 的 `timeline.go` 从中提取人类可读的时间线：

```go
// timeline.go: 从 Temporal 获取工作流历史
it := h.tclient.GetWorkflowHistory(ctx, workflowID, runID, false, 
    enumspb.HISTORY_EVENT_FILTER_TYPE_ALL_EVENT)
```

Temporal 历史包含的事件类型（Shannon 覆盖的）：

| 事件类别 | Temporal 事件类型 | Timeline 前缀 | 说明 |
|---------|------------------|--------------|------|
| 工作流 | `WORKFLOW_EXECUTION_STARTED` | `WF_STARTED` | 工作流启动 |
| 工作流 | `WORKFLOW_EXECUTION_COMPLETED` | `WF_COMPLETED` | 工作流完成 |
| 工作流 | `WORKFLOW_EXECUTION_FAILED` | `WF_FAILED` | 工作流失败 |
| 工作流 | `WORKFLOW_EXECUTION_TIMED_OUT` | `WF_TIMEOUT` | 超时 |
| 活动 | `ACTIVITY_TASK_SCHEDULED/STARTED/COMPLETED/FAILED` | `ACT_*` | Agent 执行活动 |
| 计时器 | `TIMER_STARTED/FIRED/CANCELED` | `TIMER_*` | 延迟/超时控制 |
| 信号 | `WORKFLOW_EXECUTION_SIGNALED` | `SIG_RECEIVED` | 外部信号 |
| 子工作流 | `CHILD_WORKFLOW_EXECUTION_*` | `CHILD_*` | 子 Agent 调用 |
| 属性 | `UPSERT_WORKFLOW_SEARCH_ATTRIBUTES` | `ATTR_UPSERT` | 搜索属性更新 |
| 标记 | `MARKER_RECORDED` | `MARKER_RECORDED` | 自定义标记 |

**关键洞察**：Temporal History 是**确定性**的——即使 SSE 流中断，也能完整重建执行过程。

### 2.2 Redis Streams（实时流）

```go
// streaming/manager.go
streamKey := fmt.Sprintf("shannon:workflow:events:%s", workflowID)

// 发布事件
m.redis.XAdd(ctx, &redis.XAddArgs{
    Stream: streamKey,
    MaxLen: int64(m.capacity),  // 默认 256
    Approx: true,
    Values: map[string]interface{}{
        "workflow_id": evt.WorkflowID,
        "type":        evt.Type,
        "agent_id":    evt.AgentID,
        "message":     evt.Message,
        "payload":     payloadJSON,
        "ts_nano":     strconv.FormatInt(evt.Timestamp.UnixNano(), 10),
        "seq":         strconv.FormatUint(evt.Seq, 10),
    },
})

// 设置 24h TTL
m.redis.Expire(ctx, streamKey, 24*time.Hour)
```

Redis Streams 特点：
- **有序**：每个事件有单调递增的 `seq`
- **可重放**：支持 `Last-Event-ID` 断线恢复
- **容量限制**：`MaxLen` 防止无限增长
- **独立流**：每个 workflow 一个 stream key

### 2.3 PostgreSQL event_logs（持久化）

```sql
-- migrations/postgres/004_event_logs.sql
CREATE TABLE IF NOT EXISTS event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(255) NOT NULL,
    task_id UUID,
    type VARCHAR(100) NOT NULL,
    agent_id VARCHAR(255),
    message TEXT,
    payload JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seq BIGINT,
    stream_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 防重复：基于 workflow_id + type + seq
CREATE UNIQUE INDEX uq_event_logs_wf_type_seq
  ON event_logs (workflow_id, type, seq)
  WHERE seq IS NOT NULL;
```

索引策略（6 个索引）：
1. `idx_event_logs_workflow_id` — 按工作流查询
2. `idx_event_logs_task_id` — 按任务查询
3. `idx_event_logs_type` — 按事件类型查询
4. `idx_event_logs_ts` — 按时间排序
5. `idx_event_logs_seq` — 按序列号排序
6. `idx_event_logs_workflow_ts` — 复合查询（工作流+时间）

---

## 三、后端实现：Timeline 构建引擎

### 3.1 核心处理器 TimelineHandler

**文件**: `go/orchestrator/internal/httpapi/timeline.go` (~405 行)

```go
type TimelineHandler struct {
    tclient  client.Client      // Temporal 客户端
    dbClient *db.Client         // PostgreSQL 客户端
    logger   *zap.Logger
}
```

### 3.2 HTTP API 设计

```
GET /api/v1/tasks/{id}/timeline
    Query:
      - run_id: optional
      - mode: summary (默认) | full
      - include_payloads: false (默认)
      - persist: true (默认)
    Response:
      202 Accepted — 异步持久化中
      200 OK — 直接返回预览
```

**双模式设计**：
- **Summary 模式**：合并 `Scheduled → Started → Completed` 为单行，带耗时统计
- **Full 模式**：保留所有原始事件和标记

### 3.3 Timeline 构建核心逻辑

```go
func (h *TimelineHandler) buildTimeline(ctx context.Context, workflowID, runID, mode string, 
    includePayloads bool) ([]db.EventLog, timelineStats, error) {
    
    // 1. 获取 Temporal History 迭代器
    it := h.tclient.GetWorkflowHistory(ctx, workflowID, runID, false, 
        enumspb.HISTORY_EVENT_FILTER_TYPE_ALL_EVENT)
    
    // 2. 状态追踪器
    acts := map[int64]*act{}      // 活动状态
    timers := map[int64]*timer{}  // 计时器状态
    childs := map[int64]*child{}  // 子工作流状态
    
    // 3. 遍历所有历史事件
    for it.HasNext() {
        e, _ := it.Next()
        ts := e.GetEventTime().AsTime()
        
        switch e.EventType {
        // === 工作流生命周期 ===
        case enumspb.EVENT_TYPE_WORKFLOW_EXECUTION_STARTED:
            add("WF_STARTED", "Workflow started", ts, uint64(e.GetEventId()))
            
        case enumspb.EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED:
            add("WF_COMPLETED", "Workflow completed", ts, uint64(e.GetEventId()))
            
        case enumspb.EVENT_TYPE_WORKFLOW_EXECUTION_FAILED:
            msg := fmt.Sprintf("Workflow failed: %s", 
                summarizeFailure(a.GetFailure(), includePayloads))
            add("WF_FAILED", msg, ts, uint64(e.GetEventId()))
        
        // === 活动执行（Activity）===
        case enumspb.EVENT_TYPE_ACTIVITY_TASK_SCHEDULED:
            acts[e.GetEventId()] = &act{
                Type: a.GetActivityType().GetName(),
                ID:   a.GetActivityId(),
                Scheduled: ts,
            }
            if mode == "full" {
                add("ACT_SCHEDULED", "...", ts, uint64(e.GetEventId()))
            }
            
        case enumspb.EVENT_TYPE_ACTIVITY_TASK_STARTED:
            acts[a.GetScheduledEventId()].Started = ts
            
        case enumspb.EVENT_TYPE_ACTIVITY_TASK_COMPLETED:
            st := acts[a.GetScheduledEventId()]
            dur := durationFromTo(st, ts)
            name, id := activityNameID(st)
            add("ACT_COMPLETED", 
                fmt.Sprintf("Activity %s(id=%s) completed in %s", name, id, dur),
                ts, uint64(e.GetEventId()))
        
        // === 计时器 ===
        case enumspb.EVENT_TYPE_TIMER_STARTED:
            timers[e.GetEventId()] = &timer{...}
        case enumspb.EVENT_TYPE_TIMER_FIRED:
            add("TIMER_FIRED", "Timer fired", ts, uint64(e.GetEventId()))
        
        // === 信号 ===
        case enumspb.EVENT_TYPE_WORKFLOW_EXECUTION_SIGNALED:
            add("SIG_RECEIVED", fmt.Sprintf("Signal received: %s", a.GetSignalName()), ...)
        
        // === 子工作流 ===
        case enumspb.EVENT_TYPE_START_CHILD_WORKFLOW_EXECUTION_INITIATED:
            childs[e.GetEventId()] = &child{...}
        case enumspb.EVENT_TYPE_CHILD_WORKFLOW_EXECUTION_COMPLETED:
            c := childs[a.GetInitiatedEventId()]
            dur := childDuration(c, ts)
            add("CHILD_COMPLETED", 
                fmt.Sprintf("Child %s completed in %s", ctype(c), dur), ...)
        }
    }
    
    // 4. 按时间戳排序
    sort.SliceStable(out, func(i, j int) bool { 
        return out[i].Timestamp.Before(out[j].Timestamp) 
    })
    
    return out, timelineStats{Total: len(out), Mode: mode}, nil
}
```

**关键设计**：
- **事件 ID 关联**：通过 `ScheduledEventId` 关联同一活动的不同阶段
- **耗时计算**：`durationFromTo()` 优先用 Started 时间，回退到 Scheduled
- **内存状态机**：使用 map 追踪活动/计时器/子工作流的中间状态

### 3.4 异步持久化

```go
if persist && h.dbClient != nil {
    go func(evts []db.EventLog) {
        ctx, c := context.WithTimeout(context.Background(), 30*time.Second)
        defer c()
        for i := range evts {
            if evts[i].Seq == 0 {
                evts[i].Seq = uint64(i + 1)  // 补充单调 seq
            }
            _ = h.dbClient.SaveEventLog(ctx, &evts[i])
        }
    }(events)
    
    // 立即返回 202 Accepted，不阻塞请求
    w.WriteHeader(http.StatusAccepted)
    json.NewEncoder(w).Encode(map[string]any{
        "status": "accepted",
        "workflow_id": wf,
        "count": len(events),
    })
}
```

---

## 四、后端实现：流式事件系统

### 4.1 Streaming Manager 架构

**文件**: `go/orchestrator/internal/streaming/manager.go` (~1092 行)

```go
type Manager struct {
    mu            sync.RWMutex
    redis         *redis.Client
    dbClient      *db.Client
    persistCh     chan db.EventLog      // 持久化队列
    batchSize     int                    // 默认 100
    flushEvery    time.Duration          // 默认 100ms
    subscribers   map[string]map[chan Event]*subscription
    capacity      int                    // 默认 256
    logger        *zap.Logger
    shutdownCh    chan struct{}
    wg            sync.WaitGroup
    persistWg     sync.WaitGroup
}
```

### 4.2 发布流程

```
工作流/Agent 产生事件
        │
        ▼
  streaming.Manager.Publish()
        │
        ├───► Redis Streams (实时推送)
        │     └── XAdd + Expire(24h)
        │
        ├───► PostgreSQL (异步持久化)
        │     └── enqueuePersistEvent → persistWorker
        │
        └───► Global Notification Stream
              └── webhook 触发
```

### 4.3 选择性持久化策略

```go
func shouldPersistEvent(eventType string) bool {
    switch eventType {
    // ✅ 持久化：重要工作流事件
    case "WORKFLOW_COMPLETED", "WORKFLOW_FAILED",
         "AGENT_COMPLETED", "AGENT_FAILED",
         "TOOL_INVOKED", "TOOL_OBSERVATION", "TOOL_ERROR",
         "ERROR_OCCURRED", "LLM_OUTPUT", "STREAM_END",
         "ROLE_ASSIGNED", "DELEGATION", "BUDGET_THRESHOLD",
         "SCREENSHOT_SAVED":
        return true
    
    // ❌ 不持久化：流式增量和心跳
    case "LLM_PARTIAL", "HEARTBEAT", "PING", "LLM_PROMPT":
        return false
    
    // ✅ 默认持久化（安全兜底）
    default:
        return true
    }
}
```

### 4.4 批处理持久化 Worker

```go
func (m *Manager) persistWorker() {
    batch := make([]db.EventLog, 0, m.batchSize)
    ticker := time.NewTicker(m.flushEvery)
    defer ticker.Stop()
    
    flush := func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        for i := range batch {
            if err := m.dbClient.SaveEventLog(ctx, &batch[i]); err != nil {
                m.logger.Warn("SaveEventLog failed", ...)
            }
        }
        cancel()
        batch = batch[:0]
    }
    
    for {
        select {
        case ev := <-m.persistCh:
            batch = append(batch, ev)
            if len(batch) >= m.batchSize {
                flush()
            }
        case <-ticker.C:
            flush()
        }
    }
}
```

**配置项**（环境变量）：
- `EVENTLOG_BATCH_SIZE`: 批大小（默认 100）
- `EVENTLOG_BATCH_INTERVAL_MS`: 刷新间隔（默认 100ms）

### 4.5 数据清理策略

```go
// 1. 大 payload 清理（base64 图片截断）
func sanitizePayloadForPersistence(eventType string, payload map[string]interface{}) map[string]interface{} {
    if eventType != "TOOL_OBSERVATION" {
        return payload
    }
    // 仅对 browser 截图工具清理 base64
    if tool == "browser" && output["screenshot"] {
        output["screenshot"] = "[BASE64_STRIPPED_FOR_PERSISTENCE]"
    }
}

// 2. UTF-8 净化（防止 Postgres 拒绝非法字符）
func sanitizeUTF8(s string) string {
    if utf8.ValidString(s) {
        return s
    }
    // 跳过无效字节
}

// 3. 消息长度限制（防止失败信息过大）
func summarizeFailure(f *failurepb.Failure, includePayloads bool) string {
    reason := f.GetMessage()
    if !includePayloads && len([]rune(reason)) > 200 {
        reason = string([]rune(reason)[:200]) + "..."
    }
    return reason
}
```

---

## 五、前端实现：Timeline 可视化

### 5.1 RunTimeline 组件

**文件**: `desktop/components/run-timeline.tsx` (~100 行)

```typescript
interface TimelineEvent {
    id: string;
    type: "agent" | "llm" | "tool" | "system";
    status: "completed" | "running" | "failed" | "pending";
    title: string;
    timestamp: string;
    details?: string;
    detailsType?: "json" | "text";
    thumbnailUrl?: string;
    agentId?: string;
    agentRole?: string;
}
```

**视觉设计**：
- **垂直时间线**：左侧图标 + 连接线，右侧内容
- **状态颜色**：
  - `completed` → 绿色边框 + CheckCircle2 图标
  - `running` → 蓝色边框 + 脉冲动画 Circle
  - `failed` → 红色边框 + AlertCircle
  - `pending` → 灰色边框
- **Swarm 模式**：多 Agent 彩色编码（`generateAgentColor()`）
- **可折叠详情**：`CollapsibleDetails` 组件支持 JSON/文本展开
- **缩略图**：浏览器截图支持懒加载

### 5.2 Swarm Task Board

**文件**: `desktop/components/swarm-task-board.tsx` (~150 行)

与 Timeline 并列显示的任务面板：
- **任务列表**：pending → in_progress → completed 状态流转
- **Agent 分配**：彩色圆点标识负责 Agent
- **完成进度**：`completedCount/totalCount` 计数器
- **Lead 状态**：单独显示主 Agent 状态

### 5.3 Radar 可视化

在 Timeline 面板顶部有一个 `RadarCanvas` 组件（~160px 高度），用于展示 Agent 活动的雷达图可视化。

---

## 六、前端实现：事件状态机与 Redux 管理

### 6.1 Redux RunSlice 状态设计

**文件**: `desktop/lib/features/runSlice.ts` (~1500 行)

```typescript
interface RunState {
    events: ShannonEvent[];           // 原始事件流（Timeline 数据源）
    messages: Message[];              // 对话消息（Conversation 数据源）
    status: "idle" | "running" | "completed" | "failed";
    connectionState: "idle" | "connecting" | "connected" | "reconnecting" | "error";
    streamError: string | null;
    sessionTitle: string | null;
    mainWorkflowId: string | null;
    
    // 控制状态
    isPaused: boolean;
    isCancelling: boolean;
    isCancelled: boolean;
    
    // 浏览器自动化
    browserMode: boolean;
    currentTool: string | null;
    toolHistory: BrowserToolExecution[];
    
    // HITL 审核
    reviewStatus: "none" | "reviewing" | "approved";
    
    // Swarm 模式
    swarmMode: boolean;
    swarm: SwarmState | null;
    
    // Skills
    selectedSkill: string | null;
}
```

### 6.2 事件到 Timeline 的转换流水线

```
ShannonEvent[] (Redux state.events)
        │
        ▼
  [过滤] 排除 LLM 流式事件
        │
        ▼
  [去重] BUDGET_THRESHOLD 节流（每 100% 保留一个）
        │
        ▼
  [状态推断] completedWorkflows Set 推断静态状态
        │
        ▼
  [分类] categorizeEvent() → agent/llm/tool/system
        │
        ▼
  [标题生成] getFriendlyTitle() → 人类可读标题
        │
        ▼
  [详情提取] extractEventDetails() → JSON payload / 文本
        │
        ▼
TimelineEvent[]
```

**关键转换函数**：

```typescript
// 1. 事件分类
const categorizeEvent = (eventType: string): "agent" | "llm" | "tool" | "system" => {
    if (eventType.includes("AGENT") || eventType.includes("DELEGATION") ||
        eventType.includes("TEAM") || eventType.includes("ROLE")) return "agent";
    if (eventType.includes("LLM") || eventType === "thread.message.completed") return "llm";
    if (eventType.includes("TOOL")) return "tool";
    return "system";
};

// 2. 状态推断
const getEventStatus = (eventType: string): "completed" | "running" | "failed" | "pending" => {
    if (eventType === "ERROR_OCCURRED" || eventType === "WORKFLOW_FAILED") return "failed";
    if (eventType.includes("STARTED") || eventType === "AGENT_THINKING") return "running";
    if (eventType.includes("COMPLETED") || eventType === "done") return "completed";
    return "completed";
};

// 3. 智能标题生成
const getFriendlyTitle = (event: any): string => {
    // 消息内容匹配
    if (event.message?.startsWith("Thinking: REASON")) return "Agent is reasoning";
    if (event.message?.startsWith("Thinking: ACT")) return "Agent is planning action";
    if (event.message?.includes("Expanded query into")) return "Expanded research query";
    
    // 类型兜底映射
    const typeMap: Record<string, string> = {
        "WORKFLOW_STARTED": "Workflow Started",
        "AGENT_STARTED": "Agent Started",
        "TOOL_INVOKED": "Tool Called",
        "TOOL_OBSERVATION": "Tool Result",
        "BUDGET_THRESHOLD": "Budget Alert",
        "APPROVAL_REQUESTED": "Awaiting Approval",
        // ... 共 30+ 种映射
    };
    return typeMap[event.type] || event.type;
};
```

### 6.3 消息与 Timeline 分离策略

Shannon 的一个重要设计是**消息和 Timeline 的分离**：

| 维度 | Conversation (消息) | Timeline (时间线) |
|------|---------------------|-------------------|
| 内容 | LLM 输出、用户输入 | 系统事件、Agent 活动 |
| 来源 | `thread.message.delta/completed` | 几乎所有事件类型 |
| 过滤 | 跳过中间 Agent 输出 | 包含所有系统事件 |
| 目的 | 对话阅读 | 执行追踪 |
| 展示 | 气泡式聊天 | 垂直时间线 |

**关键过滤逻辑**（runSlice.ts）：

```typescript
// 中间 Agent 输出仅用于 Timeline，不进入对话
const isIntermediateSubAgent = (agentId: string | undefined): boolean => {
    if (!agentId) return false;
    if (agentId === "title_generator") return true;
    const directOutputAgents = ["simple-agent", "final_output", "swarm-lead"];
    if (directOutputAgents.includes(agentId)) return false;
    return true;  // 其余都是中间输出
};

// 跳过中间输出的消息创建
if ((event.type === "thread.message.delta" || event.type === "thread.message.completed")
    && isIntermediateSubAgent(event.agent_id)) {
    return;  // 不创建对话消息
}
```

---

## 七、数据流全链路追踪

### 7.1 实时任务场景

```
[用户提交任务]
        │
        ▼
[Gateway] 创建 Temporal Workflow
        │
        ▼
[Temporal] 工作流开始执行
        │
        ├──► [Activity] Agent 执行
        │      │
        │      ├──► [LLM Service] 调用大模型
        │      │      │
        │      │      └──► 产生 LLM_OUTPUT 事件
        │      │
        │      └──► [Tool] 浏览器自动化
        │             │
        │             └──► 产生 TOOL_INVOKED/OBSERVATION 事件
        │
        └──► [Streaming Manager] Publish(event)
               │
               ├──► Redis Streams (SSE 推送)
               │      │
               │      └──► [前端] useRunStream() 接收 SSE
               │             │
               │             └──► Redux addEvent()
               │                    │
               │                    ├──► state.events[] (Timeline 源)
               │                    └──► state.messages[] (Conversation 源)
               │
               └──► PostgreSQL event_logs (异步批量写入)
```

### 7.2 页面刷新/历史回放场景

```
[用户刷新页面]
        │
        ▼
[前端] getSessionEvents(sessionId)
        │
        ▼
[Gateway] 查询 PostgreSQL event_logs
        │      + 可选：调用 /timeline API 从 Temporal 重建
        │
        ▼
[前端] Redux addEvent({...event, isHistorical: true})
        │
        ▼
[Timeline] 标记 isHistorical 跳过状态 pill 创建
        │
        ▼
[UI] 恢复 Timeline + Conversation 完整状态
```

### 7.3 Timeline 专用 API 调用

```bash
# 1. 从 Temporal 构建 Timeline（首次或强制重建）
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/tasks/$TASK/timeline?mode=summary&persist=true"
# → 202 Accepted（异步写入 event_logs）

# 2. 读取持久化的事件历史
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:8080/api/v1/tasks/$TASK/events?limit=200"
# → { events: [...], count }

# 3. 实时 SSE 流
curl -H "Accept: text/event-stream" \
  "http://localhost:8080/api/v1/stream/sse?workflow_id=$WF_ID"
```

---

## 八、关键设计决策与权衡

### 8.1 三源架构的必要性

| 场景 | 仅 SSE | 仅 event_logs | 仅 Temporal | 三源融合 |
|------|--------|--------------|------------|----------|
| 实时性 | ✅ | ❌ | ❌ | ✅ |
| 断线恢复 | ⚠️ (Last-Event-ID) | ✅ | ✅ | ✅ |
| 页面刷新 | ❌ | ✅ | ✅ | ✅ |
| 完整性保证 | ⚠️ | ⚠️ | ✅ | ✅ |
| 应用语义 | ✅ | ✅ | ❌ | ✅ |
| 性能 | ✅ | ⚠️ | ❌ | ⚠️ |

**结论**：三源融合是生产级系统的必要选择。

### 8.2 Summary vs Full 模式

| 维度 | Summary | Full |
|------|---------|------|
| 事件数量 | 少（合并阶段） | 多（每个 Temporal 事件） |
| 可读性 | 高 | 低 |
| 调试价值 | 中 | 高 |
| 默认 | ✅ | ❌ |
| 用途 | 用户查看 | 开发者调试 |

### 8.3 为什么用 Redux 而非 Jotai

Shannon Desktop 选择 Redux Toolkit（`runSlice.ts` ~1500 行）而非 Jotai，原因是：
- **复杂状态机**：50+ 事件类型，需要严格的 reducer 逻辑
- **时间旅行调试**：Redux DevTools 支持回放状态变化
- **中间件生态**：Redux Thunk 处理异步 API 调用
- **历史兼容性**：Next.js 生态对 Redux 支持成熟

---

## 九、性能优化策略

### 9.1 前端优化

```typescript
// 1. Lazy computation：Timeline 不可见时不计算
const timelineEvents = useMemo(() => {
    if (!showTimeline) return [];  // 关键优化
    // ... 复杂转换逻辑
}, [showTimeline, runEvents]);

// 2. 开发环境事件数量限制
if (process.env.NODE_ENV === "development" && state.events.length > 200) {
    state.events = state.events.slice(-150);
}

// 3. 自动滚动控制
useEffect(() => {
    if (showTimeline && timelineScrollRef.current) {
        // 仅当用户在底部时自动滚动
    }
}, [showTimeline, timelineEvents]);
```

### 9.2 后端优化

```go
// 1. 批量写入 PostgreSQL
batchSize := 100
flushEvery := 100 * time.Millisecond

// 2. Redis Stream 容量限制
MaxLen: int64(m.capacity)  // 默认 256，防止无限增长

// 3. 选择性持久化
shouldPersistEvent() — 跳过 LLM_PARTIAL、HEARTBEAT 等高频低价值事件

// 4. 异步 Timeline 构建
// HTTP 请求立即返回 202，后台 goroutine 完成构建和持久化

// 5. 大 payload 清理
// base64 截图替换为占位符，减少 90%+ 存储
```

### 9.3 数据库优化

```sql
-- 复合唯一索引防止重复写入
CREATE UNIQUE INDEX uq_event_logs_wf_type_seq
  ON event_logs (workflow_id, type, seq)
  WHERE seq IS NOT NULL;

-- 6 个查询索引覆盖所有常用查询模式
```

---

## 十、可借鉴的设计模式

### 10.1 模式一：多源事件融合

```
实时流（Redis）+ 持久化（Postgres）+ 权威源（Temporal）
```

**适用场景**：任何需要"实时+历史+完整"三重保障的监控系统。

### 10.2 模式二：事件到视图的转换管道

```
原始事件 → 过滤 → 去重 → 状态推断 → 分类 → 标题生成 → 视图事件
```

**适用场景**：将技术事件转换为用户友好展示的任何系统。

### 10.3 模式三：Timeline 与 Conversation 分离

```
同一事件源，两套消费逻辑：
- Timeline：展示所有系统活动
- Conversation：仅展示对话内容
```

**适用场景**：同时需要"执行追踪"和"对话阅读"的 Agent 系统。

### 10.4 模式四：Lazy Computation

```typescript
const computed = useMemo(() => {
    if (!visible) return [];  // 不可见时零成本
    return expensiveTransform(rawData);
}, [visible, rawData]);
```

### 10.5 模式五：Swarm 彩色编码

```typescript
function getAgentIconColor(event, swarmMode, agentRegistry) {
    if (!swarmMode || !event.agentId) return undefined;
    const isLead = event.agentId === "swarm-lead";
    if (isLead) return LEAD_COLOR.dot;
    return generateAgentColor(agentRegistry[event.agentId].colorIndex).dot;
}
```

---

## 十一、潜在改进方向

### 11.1 实时协作
- 当前：单用户查看 Timeline
- 改进：WebSocket 广播实现多用户同时查看同一任务执行

### 11.2 时间线搜索
- 当前：仅按时间顺序浏览
- 改进：全文搜索事件内容，支持按 Agent/类型/时间范围过滤

### 11.3 执行回放
- 当前：静态查看
- 改进：Temporal Replay + 可视化步进调试（类似 Chrome DevTools 的 Step Over）

### 11.4 性能分析
- 当前：基础耗时统计
- 改进：自动生成执行热点图，识别慢 Activity 和频繁重试

### 11.5 事件关联图谱
- 当前：线性时间线
- 改进：DAG 可视化展示子工作流调用关系

---

## 附录：核心文件索引

### 后端（Go）

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `docs/task-history-and-timeline.md` | ~126 | 官方 API 文档 |
| `go/orchestrator/internal/httpapi/timeline.go` | ~405 | Timeline HTTP API 处理器（核心） |
| `go/orchestrator/internal/streaming/manager.go` | ~1092 | 流式事件管理器（Redis + DB 持久化） |
| `go/orchestrator/internal/db/event_log.go` | ~53 | 事件日志数据库操作 |
| `go/orchestrator/main.go` | ~717 | admin server 注册 TimelineHandler |
| `go/orchestrator/cmd/gateway/main.go` | ~929 | Gateway 代理 `/api/v1/tasks/{id}/timeline` |
| `go/orchestrator/cmd/gateway/internal/handlers/openapi.go` | ~408 | OpenAPI 规范定义 |
| `go/orchestrator/cmd/gateway/internal/handlers/session.go` | - | Session Events 查询 handler |
| `go/orchestrator/internal/server/service.go` | - | gRPC 服务：会话历史窗口管理 |

### 数据库

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `migrations/postgres/004_event_logs.sql` | ~49 | event_logs 表 Schema + 索引 |

### 前端（TypeScript/React）

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `desktop/components/run-timeline.tsx` | ~100 | Timeline 垂直时间轴可视化组件 |
| `desktop/components/swarm-task-board.tsx` | ~150 | Swarm 任务面板 |
| `desktop/lib/features/runSlice.ts` | ~1502 | Redux 状态管理（事件处理核心） |
| `desktop/app/(app)/run-detail/page.tsx` | ~2364 | 运行详情页面（Timeline 集成主入口） |
| `desktop/lib/shannon/types.ts` | ~453 | 50+ 种事件类型定义 |
| `desktop/lib/utils/message-filter.ts` | - | 消息过滤（区分 conversation/timeline） |

### SDK & 客户端

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `clients/python/src/shannon/client.py` | ~626 | Python SDK `get_task_timeline()` 方法 |
| `clients/python/tests/test_core.py` | ~72 | Python SDK 测试 |

### 测试 & 工具

| 文件路径 | 行数 | 职责 |
|---------|------|------|
| `go/orchestrator/cmd/gateway/internal/handlers/session_events_test.go` | - | Session Events 查询测试（sqlmock） |
| `go/orchestrator/tests/replay/workflow_replay_test.go` | - | Workflow 确定性 Replay 测试 |
| `go/orchestrator/tools/replay/main.go` | - | Replay CLI 工具 |
| `scripts/replay_workflow.sh` | - | Replay Shell 脚本 |
| `go/orchestrator/histories/README.md` | - | 历史文件说明 |

---

*本文档基于 Shannon（截至 v0.3.1）的公开代码分析生成。*
*文档版本: v1.0 | 生成日期: 2026-05-04 | 总字数: 约 9,000 字*
