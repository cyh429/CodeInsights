# Sprint 2: Pipeline 引擎 + 案例详情页 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 后端完成 LangGraph Pipeline 引擎和 SSE 事件流；前端完成案例详情页和 Pipeline 可视化。

**Architecture:** LangGraph StateGraph 5 节点 + 条件边，Redis Pub/Sub + Stream 驱动 SSE，前端 Vue 3 三栏布局 + 实时事件流。

**Tech Stack:** Python (FastAPI + LangGraph + sse-starlette + Redis), TypeScript (Vue 3 + Pinia + @microsoft/fetch-event-source + TailwindCSS)

**验收标准:** 启动 Pipeline → SSE 收到 stage_change 事件 → 提交审核 → Pipeline 前进；前端案例详情页显示 Pipeline 状态（Mock 数据）。

---

## 任务分解

### 后端任务（6 个）

#### Task B1: PipelineState TypedDict + LangGraph StateGraph 骨架

**Files:**
- Create: `backend/app/pipeline/state.py`
- Create: `backend/app/pipeline/graph.py`
- Create: `backend/app/pipeline/nodes.py`

**描述:**
定义 PipelineState TypedDict 作为 LangGraph 状态模型，构建 StateGraph 5 节点（explore, plan, develop, review, test）+ human_gate_node + 条件边。Sprint 2 所有 Agent 节点为 stub（仅更新状态 + 发布事件），真正的 Agent 实现在 Sprint 3-5。

**PipelineState 字段:**
```python
class PipelineState(TypedDict):
    case_id: str
    current_stage: str  # explore | plan | develop | review | test
    status: str         # CaseStatus enum value
    exploration_result: Optional[dict]
    execution_plan: Optional[dict]
    development_result: Optional[dict]
    review_verdict: Optional[dict]
    test_result: Optional[dict]
    review_iterations: int
    human_decision: Optional[str]  # approve | reject | abandon
    human_comment: Optional[str]
    cost: dict  # CostSummary
    error: Optional[str]
```

**StateGraph 结构:**
```
START → explore_node → human_gate → [route_human_decision]
  → approve → plan_node → human_gate → [route_human_decision]
    → approve → develop_node → review_node → [route_review_decision]
      → approve → human_gate → [route_human_decision]
        → approve → test_node → human_gate → [route_human_decision]
          → approve → END
      → reject → develop_node (loop, max 3)
    → reject → plan_node
  → reject → explore_node
  → abandon → END
```

**关键约束:**
- 使用 `langgraph.types.interrupt()` 实现 human_gate
- 使用 `langgraph-checkpoint-postgres` 的 `AsyncPostgresSaver` 做持久化
- 每个 stub 节点：sleep 1s 模拟执行 → 更新 state → 返回
- `route_review_decision`: 检查 review_iterations < MAX_REVIEW_ITERATIONS
- 参考 `backend/app/models/schemas.py` 中的 CaseStatus 枚举做状态流转
- 参考 `backend/app/config.py` 中的 MAX_REVIEW_ITERATIONS=3

---

#### Task B2: EventPublisher (Redis Pub/Sub + Stream)

**Files:**
- Create: `backend/app/pipeline/events.py`

**描述:**
实现 EventPublisher 类，负责将 Pipeline 事件发布到 Redis Pub/Sub（实时推送）和 Redis Stream（重连恢复）。

**接口:**
```python
class EventPublisher:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    async def publish(self, event: PipelineEvent) -> None:
        """发布事件到 Pub/Sub channel + Stream"""
        channel = f"case:{event.case_id}:events"
        stream = f"case:{event.case_id}:stream"
        payload = event.model_dump_json()
        # Pub/Sub for real-time
        await self.redis.publish(channel, payload)
        # Stream for reconnection (MAXLEN 500)
        await self.redis.xadd(stream, {"event": payload}, maxlen=500)

    async def get_events_since(self, case_id: str, last_seq: int) -> list[PipelineEvent]:
        """从 Stream 获取 seq > last_seq 的事件（用于 SSE 重连）"""
```

**关键约束:**
- 使用 `backend/app/models/schemas.py` 中的 PipelineEvent 和 EventType
- seq 字段单调递增，使用 Redis INCR `case:{case_id}:seq` 生成
- Stream key: `case:{case_id}:stream`, MAXLEN 500
- Pub/Sub channel: `case:{case_id}:events`

---

#### Task B3: SSE 端点 GET /cases/{case_id}/events

**Files:**
- Create: `backend/app/api/pipeline.py`
- Modify: `backend/app/api/router.py` — 挂载 pipeline_router

**描述:**
实现 SSE 端点，订阅 Redis Pub/Sub channel，推送 PipelineEvent 到客户端。支持 Last-Event-ID 重连。

**端点签名:**
```python
@router.get("/{case_id}/events")
async def stream_events(
    case_id: str,
    request: Request,
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID"),
    db=Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    # 1. 验证 case 存在
    # 2. 如果有 last_event_id，从 Stream 恢复
    # 3. 订阅 Pub/Sub channel
    # 4. 返回 EventSourceResponse
```

**关键约束:**
- 使用 `sse_starlette.sse.EventSourceResponse`
- 心跳间隔 15s
- 每个 SSE event 的 `id` 字段 = PipelineEvent.seq
- 每个 SSE event 的 `event` 字段 = PipelineEvent.event_type
- 每个 SSE event 的 `data` 字段 = PipelineEvent JSON
- 挂载到 router.py: `api_router.include_router(pipeline_router, prefix="/cases", tags=["pipeline"])`

---

#### Task B4: Pipeline 控制 API (POST start + POST review)

**Files:**
- Modify: `backend/app/api/pipeline.py` — 添加 start 和 review 端点

**描述:**
实现两个 Pipeline 控制端点：
1. `POST /cases/{case_id}/start` — 启动 Pipeline（创建 LangGraph thread，异步执行）
2. `POST /cases/{case_id}/review` — 提交审核决策（resume Pipeline）

**POST /start:**
```python
@router.post("/{case_id}/start")
async def start_pipeline(case_id: str, ...):
    # 1. 验证 case 存在且 status == created
    # 2. 更新 case status → exploring
    # 3. 创建 LangGraph thread_id
    # 4. 异步启动 graph.ainvoke() (background task)
    # 5. 返回 CaseResponse
```

**POST /review:**
```python
@router.post("/{case_id}/review")
async def submit_review(case_id: str, decision: ReviewDecision, ...):
    # 1. 验证 case 存在且 status 是 pending_*_review
    # 2. 使用 Command(resume=decision) 恢复 Pipeline
    # 3. 返回 CaseResponse
```

**关键约束:**
- 使用 `langgraph.types.Command` 恢复中断
- thread_id 存储在 MongoDB case 文档的 `thread_id` 字段
- 使用 `asyncio.create_task()` 异步执行 Pipeline（不阻塞 HTTP 响应）
- 幂等性：重复 start 返回 409，重复 review 返回 409
- 参考 `backend/app/api/cases.py` 的 DI 模式（get_db, get_current_user）

---

#### Task B5: CostCircuitBreaker

**Files:**
- Create: `backend/app/pipeline/cost.py`
- Modify: `backend/app/pipeline/nodes.py` — 每个节点调用 breaker

**描述:**
实现成本熔断器，在每个节点执行前检查累计成本是否超过阈值。

```python
class CostCircuitBreaker:
    def __init__(self, max_cost: float):
        self.max_cost = max_cost

    def check(self, state: PipelineState) -> None:
        cost = state.get("cost", {})
        if cost.get("estimated_cost_usd", 0) >= self.max_cost:
            raise CostLimitExceeded(f"Cost {cost['estimated_cost_usd']} >= {self.max_cost}")
```

**关键约束:**
- 阈值来自 `settings.MAX_COST_PER_CASE`（默认 10.0 USD）
- 超限时发布 `error` 事件并暂停 Pipeline
- Sprint 2 stub 节点不产生真实成本，但框架必须就位

---

#### Task B6: 后端测试 + 验收

**Files:**
- Create: `backend/tests/test_pipeline_graph.py`
- Create: `backend/tests/test_events.py`
- Create: `backend/tests/test_pipeline_api.py`

**描述:**
- test_pipeline_graph: StateGraph 编译成功、stub 节点状态流转、条件边路由
- test_events: EventPublisher publish/get_events_since
- test_pipeline_api: start/review/events 端点 HTTP 测试

---

### 前端任务（5 个）

#### Task F1: TypeScript 类型扩展 + Pinia caseStore

**Files:**
- Modify: `web-console/src/types/index.ts` — 扩展 Pipeline 相关类型
- Create: `web-console/src/stores/case.ts` — Pinia caseStore

**描述:**
扩展 TypeScript 类型定义，匹配后端 12 状态 CaseStatus + PipelineEvent + ReviewDecision。创建 Pinia caseStore 管理案例详情 + Pipeline 状态 + 事件列表。

**类型扩展:**
```typescript
// 匹配后端 12 状态
export type CaseStatus =
  | 'created' | 'exploring' | 'pending_explore_review'
  | 'planning' | 'pending_plan_review'
  | 'developing' | 'reviewing' | 'pending_code_review'
  | 'testing' | 'pending_test_review'
  | 'completed' | 'abandoned'

export type EventType = 'stage_change' | 'agent_output' | 'review_request'
  | 'iteration_update' | 'cost_update' | 'error' | 'completed' | 'heartbeat'

export interface PipelineEvent {
  seq: number
  case_id: string
  event_type: EventType
  data: Record<string, any>
  timestamp: string
}

export type ReviewAction = 'approve' | 'reject' | 'abandon'

export interface ReviewDecision {
  action: ReviewAction
  comment?: string
}

// Pipeline stage 定义
export interface PipelineStage {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_review'
  startedAt?: string
  completedAt?: string
}
```

**关键约束:**
- CaseStatus 必须与后端 `backend/app/models/schemas.py` 的 CaseStatus 枚举完全一致
- caseStore 需要 actions: loadCase, startPipeline, submitReview, addEvent, clearEvents
- 参考 `web-console/src/stores/auth.ts` 的 Pinia 模式

---

#### Task F2: useCaseEvents + usePipeline composables

**Files:**
- Create: `web-console/src/composables/useCaseEvents.ts`
- Create: `web-console/src/composables/usePipeline.ts`

**描述:**
useCaseEvents: 封装 SSE 连接管理，订阅 `/api/v1/cases/{case_id}/events`，分发事件到 caseStore。
usePipeline: 从 caseStore 事件流提取 Pipeline 阶段状态，计算当前阶段、是否等待审核等。

**useCaseEvents 接口:**
```typescript
export function useCaseEvents(caseId: Ref<string>) {
  const events = ref<PipelineEvent[]>([])
  const isConnected = ref(false)
  const error = ref<string | null>(null)

  function connect(): void  // 建立 SSE 连接
  function disconnect(): void  // 断开连接
  // 自动在 onUnmounted 断开

  return { events, isConnected, error, connect, disconnect }
}
```

**usePipeline 接口:**
```typescript
export function usePipeline(caseItem: Ref<Case | null>) {
  const stages = computed<PipelineStage[]>(...)  // 5 阶段状态
  const currentStage = computed<string | null>(...)
  const isWaitingReview = computed<boolean>(...)
  const reviewIteration = computed<number>(...)

  return { stages, currentStage, isWaitingReview, reviewIteration }
}
```

**关键约束:**
- 使用 `web-console/src/api/client.ts` 中的 `connectSSE()` helper
- SSE URL: `/api/v1/cases/${caseId}/events`
- 需要附加 Bearer token 到 SSE 请求
- onUnmounted 自动 abort SSE 连接
- 参考 `web-console/src/composables/useAuth.ts` 的 composable 模式

---

#### Task F3: CaseDetailView 三栏布局重构

**Files:**
- Rewrite: `web-console/src/views/CaseDetailPage.vue`

**描述:**
将 Sprint 1 的 placeholder 重构为三栏布局：
- 左栏（w-72）：PipelineView — 垂直流水线可视化
- 中栏（flex-1）：Agent 事件日志（Sprint 2 显示 placeholder，Sprint 3 实现）
- 右栏（w-80）：ReviewPanel + 产物面板

**关键约束:**
- 使用 `frontend-ui-ux` skill 的设计原则
- 保留现有的 Back 按钮和 case 基本信息
- 集成 useCaseEvents 和 usePipeline composables
- 集成 caseStore
- 响应式：md 以下变为单栏
- 参考 `web-console/src/views/MainLayout.vue` 的布局模式

---

#### Task F4: PipelineView + StageNode 组件

**Files:**
- Create: `web-console/src/components/pipeline/PipelineView.vue`
- Create: `web-console/src/components/pipeline/StageNode.vue`

**描述:**
垂直流水线可视化组件。5 个阶段节点 + 连线 + 当前阶段高亮 + 等待审核脉冲动画。

**PipelineView props:**
```typescript
defineProps<{
  stages: PipelineStage[]
  currentStage: string | null
}>()
```

**StageNode props:**
```typescript
defineProps<{
  stage: PipelineStage
  isCurrent: boolean
  isLast: boolean
}>()
```

**视觉要求（frontend-ui-ux skill）:**
- 垂直布局，节点间有连线（border-left 或 SVG）
- 状态图标：pending=circle, running=spinner, completed=check, failed=x, waiting_review=clock
- 当前阶段高亮（ring + scale）
- 等待审核时脉冲动画（animate-pulse）
- 已完成阶段显示耗时
- 使用 lucide-vue-next 图标

---

#### Task F5: HumanGate + ReviewPanel 组件

**Files:**
- Create: `web-console/src/components/pipeline/HumanGate.vue`
- Create: `web-console/src/components/pipeline/ReviewPanel.vue`

**描述:**
HumanGate: Pipeline 视图中的审核门禁节点特殊样式。
ReviewPanel: 右栏审核决策面板，approve/reject/abandon 三按钮。

**ReviewPanel props:**
```typescript
defineProps<{
  caseId: string
  currentStage: string
  isWaitingReview: boolean
}>()

defineEmits<{
  (e: 'review', decision: ReviewDecision): void
}>()
```

**视觉要求（frontend-ui-ux skill）:**
- approve: 绿色按钮
- reject: 橙色按钮，点击展开 textarea 填写原因
- abandon: 红色按钮，需确认弹窗
- 非审核状态时 disabled
- 提交后 loading 状态

---

#### Task F6: Mock API 扩展 + 前端验收

**Files:**
- Modify: `web-console/src/api/mock.ts` — 添加 Pipeline Mock
- Modify: `web-console/src/api/cases.ts` — 添加 startPipeline, submitReview API

**描述:**
扩展 Mock API 支持 Pipeline 操作（start, review, events），前端可独立验证 UI。

---

## 执行顺序

### 后端（串行依赖链）
```
B1 (StateGraph) → B2 (EventPublisher) → B3 (SSE) → B4 (start/review API) → B5 (CostBreaker) → B6 (测试)
```

### 前端（可并行）
```
F1 (类型+Store) ──→ F2 (composables) ──→ F3 (CaseDetailView)
                                      ├──→ F4 (PipelineView)
                                      └──→ F5 (ReviewPanel)
F6 (Mock) 可与 F1 并行
```

### 并行机会
- B1-B2 与 F1-F2 可并行（前后端独立）
- F3, F4, F5 可并行（独立组件）
- B6 与 F6 可并行（各自验收）
