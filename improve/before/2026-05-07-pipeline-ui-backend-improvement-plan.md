# 2026-05-07 Pipeline UI 与前后端优化方案

## 1. 背景

本文基于当前 Pipeline 页面截图、现有前端组件和主进程 Pipeline 编排实现，整理一份偏产品化落地的优化建议。

当前 Pipeline 已经具备最小闭环：

- 固定节点链路：`explorer -> planner -> developer -> reviewer -> tester`
- LangGraph 主进程编排与 checkpoint 恢复
- JSON / JSONL 本地持久化
- 人工审核 gate
- 侧边栏会话治理、主视图状态轨、records 展示和基础 composer

但从用户体验看，当前界面仍更像“调试日志面板”，而不是“可交互、可决策、可复盘的工作流控制台”。截图中的主要感受是：

- 整页浅黄背景和多层大圆角卡片让界面显得偏原型化
- Header 暴露 `node_failed` 这类工程状态码
- 阶段条只是五个平铺按钮，不像真实 stepper
- 输入框、记录列表、审核卡片之间没有清晰的信息优先级
- records 更像 JSONL 的薄展示层，缺少阶段产物视角
- 长任务执行中缺少实时输出和当前活动反馈

本文目标不是扩展 Pipeline 的长期愿景，而是给出当前代码基础上最值得优先投入的 UI、前端状态和后端数据结构优化点。

## 2. 当前实现观察

### 2.1 主视图

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineHeader.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineStageRail.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineComposer.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineGateCard.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`

当前结构是：

```tsx
<PipelineHeader />
<PipelineStageRail />
<ErrorBanner />
<PreflightBanner />
<PipelineGateCard />
<PipelineComposer />
<PipelineRecords />
```

这个结构的优点是简单、直观、容易验证。但问题也明显：

- 所有模块纵向堆叠，缺少主次关系
- 人工审核和 records 混在同一滚动流里，用户需要自己判断当前要做什么
- composer 在运行中仍占据主视觉位置，压过了“当前阶段产物”
- records 变长后，Header、Stage、Gate、Composer、Output 的关系会被滚动打散

### 2.2 状态流

涉及文件：

- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `packages/shared/src/types/pipeline.ts`

当前状态分布：

- `pipelineSessionsAtom` 管会话元数据
- `pipelineSessionStateMapAtom` 管运行快照
- `pipelinePendingGatesAtom` 管人工审核请求
- `pipelineRecordRefreshAtom` 触发 records 重新读取
- `pipelineStreamErrorsAtom` 管流式错误文本

现有设计已能支撑基本运行，但 UI 表达还没有充分消费状态。例如：

- `text_delta` 已经存在，但前端没有构建 live output buffer
- stage rail 只知道 `currentNode` / `lastApprovedNode`，不能表达多个阶段的完整完成状态
- records 视图没有按阶段聚合，也没有区分“产物”和“系统事件”
- `status` 直接进入 UI，缺少展示层状态模型

### 2.3 后端编排

涉及文件：

- `apps/electron/src/main/lib/pipeline-graph.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/pipeline-node-runner.ts`
- `apps/electron/src/main/lib/pipeline-record-builder.ts`

当前后端已经比原型阶段更完整：

- reviewer 无论通过或驳回都会进入人工审核 gate
- stop 会写入 `terminated` 状态并发出 status change
- start / respondGate 统一进入 `runExecution()`
- reviewer 已经可以生成 `review_result`

但仍有产品化缺口：

- 下游节点没有稳定消费上游阶段产物，`buildContext()` 只传基本运行上下文
- 除 reviewer 外，其他节点仍以自由文本为主
- records 持久层没有 stage-level artifact 概念
- UI 只能从混合记录流里还原阶段视图，成本会越来越高

## 3. 核心判断

当前 Pipeline 的主要问题不是“功能缺失”，而是“表达方式不符合用户心智”。

用户进入 Pipeline 页面时，最想知道的是：

1. 这次任务现在进行到哪一步？
2. 当前有没有需要我决定的事情？
3. 每个阶段产出了什么？
4. 如果失败，失败在哪里、下一步可以怎么处理？
5. 最终交付物和验证结果是什么？

当前界面主要回答了：

1. 当前 status 是什么
2. 当前 node 是什么
3. JSONL records 有哪些
4. 可以继续输入或停止

这两组问题之间存在明显落差。因此 UI 不美观只是表象，底层需要同步优化信息架构、前端状态模型和后端记录结构。

## 4. UI 设计优化

### 4.1 整体视觉语言：从浅黄日志页改为中性工作台

现状：

- `PipelineView.tsx` 使用 `bg-gradient-to-br from-orange-50 via-stone-50 to-amber-100`
- Header、Composer、Records 都是 `rounded-3xl` + amber 边框
- 大面积暖色导致页面显得单一，且与左侧深色 sidebar 视觉断裂

建议：

- 主背景改为中性 surface，例如 `bg-background` / `bg-muted/30`
- 页面容器使用更克制的 8-16px radius，不再全局 `rounded-3xl`
- 状态色只用于语义状态：
  - running：sky / blue
  - waiting：amber
  - failed：rose
  - completed：emerald
  - idle / terminated：zinc
- 卡片减少边框，使用轻量阴影和层级分隔
- 避免整页被单一 amber 色主导

目标效果：

- 更像桌面生产力工具
- 更适合长时间阅读和反复操作
- 状态色更有语义，而不是装饰色

### 4.2 Header：从状态码展示改为任务摘要栏

现状：

- `PipelineHeader.tsx` 直接展示 `状态：{effectiveStatus}`
- 截图中出现 `状态：node_failed`
- 用户需要理解内部 enum 才能判断当前情况

建议展示结构：

```text
新 Pipeline 会话
默认工作区 · Claude Sonnet 4.6 · 第 1 轮

[节点失败] Explorer 执行失败
```

Header 应包含：

- 会话标题
- 当前工作区
- 当前渠道 / 模型
- 当前节点
- Review 轮次
- 中文状态文案
- 失败时的快速动作：重试当前节点、停止、查看错误

建议新增 view model：

```ts
interface PipelineHeaderViewModel {
  title: string
  subtitleItems: string[]
  statusLabel: string
  statusTone: 'idle' | 'running' | 'waiting' | 'failed' | 'completed' | 'terminated'
  nodeLabel: string
  action?: 'retry' | 'stop' | 'open-settings'
}
```

这样 UI 不再直接消费 raw status。

### 4.3 StageRail：升级为真实 stepper

现状：

- `PipelineStageRail.tsx` 平铺五个阶段按钮
- `nodeStatus()` 只判断 `lastApprovedNode === node`
- 早期已通过节点不会持续保持 done 状态
- 没有连接线、失败态、等待人工审核态

建议：

- 按固定节点顺序计算阶段状态
- 已通过节点及其之前节点均显示 done
- 当前节点显示 active
- 当前 gate 节点显示 waiting
- 失败时当前节点显示 failed
- 节点之间用连接线表达流程
- 节点可点击过滤 records 到对应阶段

建议状态：

```ts
type PipelineStageVisualStatus =
  | 'done'
  | 'active'
  | 'waiting'
  | 'failed'
  | 'todo'
```

视觉建议：

- completed 使用 check 图标
- active 使用细小 spinner 或 pulse dot
- waiting 使用 pause / user-check 图标
- failed 使用 alert 图标
- todo 使用淡色编号

这会显著提升第一眼的信息清晰度。

### 4.4 Layout：从单列堆叠改为工作台布局

建议桌面布局：

```text
┌────────────────────────────────────────────────────────────┐
│ Header: title, status, workspace, model                    │
├────────────────────────────────────────────────────────────┤
│ Stepper                                                    │
├──────────────────────────────┬─────────────────────────────┤
│ Main: Stage outputs          │ Right: Current gate / run    │
│ - Explorer summary           │ - Waiting review             │
│ - Planner checklist          │ - Actions                    │
│ - Developer changes          │ - Runtime metadata           │
│ - Reviewer verdict           │ - Errors                     │
│ - Tester report              │                             │
├──────────────────────────────┴─────────────────────────────┤
│ Bottom composer / command bar                              │
└────────────────────────────────────────────────────────────┘
```

移动或窄宽度下退化为单列：

- Header
- Stepper
- Current action panel
- Stage outputs
- Composer

这样做的原因：

- 人工审核是当前关键动作，应固定在右侧，而不是混在 records 中
- 阶段产物是主要内容，应占据最大区域
- 输入框不是运行中的主任务，不应长期占据首屏核心区域

### 4.5 Composer：运行前是任务输入，运行后变成任务摘要

现状：

- `PipelineComposer.tsx` 在运行前后都占据较大面积
- 运行中 disabled，但仍然视觉很重

建议：

- idle / failed / terminated 状态：展示完整输入框
- running / waiting_human 状态：折叠为任务摘要条
- 支持展开查看原始用户需求
- stop 按钮移到 Header 或右侧运行面板

运行中展示示例：

```text
任务：优化 Pipeline UI 设计...
[展开原始需求]                         [停止]
```

这能减少运行期间的视觉噪音。

### 4.6 GateCard：改为审核面板

现状：

- `PipelineGateCard.tsx` 是黄色卡片
- 显示 summary、feedback textarea 和三个按钮
- 没有把 reviewer issues、阶段产物、风险提示组织起来

建议：

- 改名为 `PipelineReviewPanel` 或 `PipelineGatePanel`
- 作为右侧 sticky inspector 展示
- 对不同节点使用不同说明：
  - explorer：确认探索方向是否正确
  - planner：确认计划是否可执行
  - reviewer：确认 reviewer verdict，并决定是否回 developer
  - tester：确认测试结果并结束
- 驳回时强制填写反馈
- 对 `rerun_node` 提供明确文案：重跑 Explorer / Planner / 当前节点

建议结构：

```text
等待人工审核
Planner 节点 · 第 1 轮

阶段摘要
...

反馈
[textarea]

[通过并继续] [要求修改] [重跑 Planner]
```

### 4.7 Records：从原始记录列表改为阶段产物流

现状：

- `PipelineRecords.tsx` 对每条 `PipelineRecord` 显示一张卡片
- `node_transition`、`gate_requested`、`status_change` 和真正产物同层
- 用户需要在系统事件里找有价值内容

建议拆分为两个视图：

1. 阶段产物视图，默认展示
2. 原始日志视图，用于 debug

阶段产物视图按节点聚合：

- Explorer：任务理解、关键文件、入口模块、风险点
- Planner：执行计划、验证方案、待确认问题
- Developer：变更摘要、修改文件、测试命令、遗留风险
- Reviewer：通过/驳回、issue 列表、建议动作
- Tester：测试结论、失败日志、覆盖范围

原始日志视图保留：

- node_transition
- gate_requested
- gate_decision
- status_change
- error

建议增加顶部切换：

```text
[阶段产物] [运行日志]
```

并支持 stage filter：

```text
全部 / Explorer / Planner / Developer / Reviewer / Tester
```

### 4.8 内容渲染：复用现有 Markdown / CodeBlock 能力

当前 node output 用纯文本展示，无法优雅呈现：

- Markdown 标题
- 列表
- 代码块
- 文件路径
- 命令输出

项目已有 AI 展示组件，应在 Pipeline records 中复用：

- Markdown renderer
- CodeBlock
- MermaidBlock
- Reasoning / collapsible blocks

建议：

- `node_output` 的 summary 显示为纯文本摘要
- full content 用 Markdown 组件渲染
- 代码块自动使用已有 CodeBlock
- 文件路径未来可做可点击跳转

## 5. 前端状态优化

### 5.1 增加展示层 view model

当前组件直接消费 shared 类型，导致 UI 里出现 raw status、raw node、raw record type。

建议新增：

- `pipeline-view-model.ts`
- `pipeline-stage-view-model.ts`
- `pipeline-record-group-view-model.ts`

职责：

- raw status -> 中文文案、tone、icon
- records -> stage outputs
- pendingGate + state -> current action
- sessions + stateMap -> sidebar indicator

好处：

- UI 组件更纯展示
- 便于测试
- 避免 enum 泄露到用户界面
- 后续改视觉不会影响主逻辑

### 5.2 增加 live output buffer

当前 `PipelineStreamEvent` 已有 `text_delta`，但前端没有实时展示。

建议新增 atoms：

```ts
export const pipelineLiveOutputAtom = atom<Map<string, Map<PipelineNodeKind, string>>>(new Map())
```

监听器处理：

- `text_delta`：append 到当前 session + node buffer
- `node_complete`：清理对应 live buffer 或标记为 finalized
- `status_change` terminal：清理 session live buffer

UI 展示：

- 当前 active stage card 内展示 live output
- 输出中显示“正在生成...”
- 长输出可折叠

这会解决长任务期间界面静止的问题。

### 5.3 错误状态统一建模

当前 `pipelineStreamErrorsAtom` 只存 string。

建议改为结构化错误：

```ts
interface PipelineDisplayError {
  message: string
  node?: PipelineNodeKind
  canRetry: boolean
  settingsTab?: SettingsTab
  createdAt: number
}
```

收益：

- Header 可显示失败节点
- Right panel 可给出下一步动作
- 错误卡片可跳转设置或重试
- 未来可对网络错误、认证错误、上下文过长做不同引导

### 5.4 Stage 完成态计算修正

当前 `PipelineStageRail` 的完成态逻辑偏弱。

建议使用顺序计算：

```ts
const NODE_ORDER = ['explorer', 'planner', 'developer', 'reviewer', 'tester'] as const

function isNodeDone(node, state) {
  if (!state.lastApprovedNode) return false
  return NODE_ORDER.indexOf(node) <= NODE_ORDER.indexOf(state.lastApprovedNode)
}
```

注意 reviewer 特殊情况：

- reviewer 通过后，lastApprovedNode 为 reviewer
- reviewer 驳回后，不应标为 done
- developer 多轮迭代时，应显示 iteration 信息

### 5.5 Records 刷新策略优化

当前通过 `pipelineRecordRefreshAtom` 触发重新读取全部 records。

短期可以接受，但后续 records 变多后会有问题：

- 每个事件都重新读取全量 JSONL
- UI 无法做细粒度动画
- live output 和 finalized output 之间不够自然

建议分阶段：

第一阶段：

- 保持全量读取
- 增加 records -> stage group 的 memoized view model

第二阶段：

- 主进程 stream event 中携带可直接 append 的 record
- 前端本地增量维护 records

第三阶段：

- JSONL 读取支持分页或按时间窗口读取
- 大会话 records 虚拟列表

## 6. 后端与数据结构优化

### 6.1 将上游阶段产物显式传给下游

当前 `pipeline-graph.ts` 的 `buildContext()` 只传：

- sessionId
- userInput
- currentNode
- reviewIteration
- lastApprovedNode
- feedback

虽然 state 中有 `latestOutput/latestSummary/latestIssues`，但没有稳定的阶段产物集合。

建议新增：

```ts
interface PipelineStageOutput {
  node: PipelineNodeKind
  output: string
  summary: string
  issues?: string[]
  approved?: boolean
  createdAt: number
}

type PipelineStageOutputs = Partial<Record<PipelineNodeKind, PipelineStageOutput[]>>
```

Graph state 持有：

```ts
stageOutputs?: PipelineStageOutputs
```

每个节点完成后 append 到对应 node，`buildContext()` 传给下游。

收益：

- Planner 能消费 Explorer 结论
- Developer 能消费 Planner 计划
- Reviewer 能消费 Developer 变更摘要
- Tester 能消费 Reviewer 结论
- UI 可以天然按 stage 聚合

### 6.2 为所有节点引入结构化输出

当前 reviewer 已经有 JSON schema，其他节点仍是自由文本。

建议逐步引入结构化 schema：

Explorer：

```ts
interface ExplorerResult {
  summary: string
  keyFiles: string[]
  entryPoints: string[]
  risks: string[]
  suggestedPlan: string[]
}
```

Planner：

```ts
interface PlannerResult {
  summary: string
  steps: Array<{ title: string; detail: string }>
  verification: string[]
  risks: string[]
}
```

Developer：

```ts
interface DeveloperResult {
  summary: string
  changedFiles: string[]
  testsRun: string[]
  risks: string[]
}
```

Tester：

```ts
interface TesterResult {
  passed: boolean
  summary: string
  commands: Array<{ command: string; result: 'passed' | 'failed' }>
  failures: string[]
}
```

这样 UI 才能做漂亮、稳定、可扫描的卡片，而不是猜测文本内容。

### 6.3 增加 stage artifact 记录类型

当前 `PipelineRecord` 已有：

- `user_input`
- `node_transition`
- `node_output`
- `review_result`
- `gate_requested`
- `gate_decision`
- `status_change`
- `error`

建议新增更适合 UI 消费的记录：

```ts
interface PipelineStageArtifactRecord {
  id: string
  sessionId: string
  type: 'stage_artifact'
  node: PipelineNodeKind
  iteration: number
  title: string
  summary: string
  artifactType: 'exploration' | 'plan' | 'changes' | 'review' | 'test'
  data: unknown
  createdAt: number
}
```

短期可以先不替换 `node_output`，而是额外写一条 `stage_artifact`。

收益：

- records 原始日志继续保留
- UI 直接消费 artifact
- 后续可以导出任务报告
- 可以做阶段对比、多轮 reviewer 对比

### 6.4 Pipeline artifact 目录真正落地

当前 `~/.codeinsights/pipeline-artifacts/` 已预留，但没有形成稳定消费路径。

建议每个 session 目录下保存：

```text
pipeline-artifacts/
└── {session-id}/
    ├── stage-outputs.json
    ├── final-report.md
    ├── changed-files.json
    └── test-report.json
```

UI 中提供：

- 查看最终报告
- 打开产物目录
- 导出 Markdown

### 6.5 同步 shared reducer 语义

`packages/shared/src/utils/pipeline-state.ts` 中 reviewer 驳回路径需要与当前 graph 语义保持一致。

当前风险：

- Graph 中 reviewer 驳回会进入 `gate_reviewer`
- Shared reducer 中 `review_result approved=false` 会直接切回 developer
- 如果未来使用 records replay 恢复状态，可能出现状态不一致

建议：

- `review_result` 无论 approved true/false，都先进入 `waiting_human`
- 真正回退到 developer 由 `gate_decision reject_with_feedback` 决定

这是后续做可复盘状态恢复前需要修正的点。

## 7. 交互细节优化

### 7.1 状态文案

建议统一状态文案：

| Raw status | 用户文案 | Tone |
| --- | --- | --- |
| `idle` | 未启动 | neutral |
| `running` | 运行中 | running |
| `waiting_human` | 等待人工审核 | waiting |
| `node_failed` | 节点失败 | failed |
| `completed` | 已完成 | success |
| `terminated` | 已停止 | neutral |
| `recovery_failed` | 恢复失败 | failed |

节点文案：

| Raw node | 用户文案 |
| --- | --- |
| `explorer` | 探索 |
| `planner` | 计划 |
| `developer` | 开发 |
| `reviewer` | 审查 |
| `tester` | 测试 |

UI 内可以保留英文短标签，但主要状态提示应使用中文。

### 7.2 按钮语义

当前按钮：

- 启动 Pipeline
- 停止
- 通过
- 驳回并回退
- 重跑当前节点

建议按上下文优化：

- 未启动：`启动 Pipeline`
- 运行中：`停止运行`
- explorer gate：`确认方向，进入计划`
- planner gate：`确认计划，进入开发`
- reviewer gate approved：`进入测试`
- reviewer gate rejected：`要求修改`
- tester gate：`确认完成`

这会让用户明确每个动作的后果。

### 7.3 空状态

当前 records 空状态是“暂无记录”。

建议主视图空状态：

- 新会话：强调输入任务即可开始
- 无渠道：提示配置 Agent 渠道
- 无工作区：提示选择工作区
- 已完成但无产物：提示查看运行日志

避免只显示“暂无记录”。

### 7.4 失败恢复

节点失败时应该提供明确路径：

- 查看错误
- 重试当前节点
- 回到上一阶段
- 停止并保留记录
- 打开设置

短期最小实现：

- Header 显示失败节点
- Error card 显示错误内容
- 提供“重跑当前节点”或“重新启动 Pipeline”

## 8. 推荐实施顺序

### 第一阶段：快速提升观感和可读性

目标：不大改后端，先让页面不像原型。

1. 新增 Pipeline display view model
2. Header 改为中文状态和任务摘要
3. StageRail 改为 stepper
4. Composer 运行中折叠
5. Records 增加“阶段产物 / 运行日志”切换
6. node output 使用 Markdown 渲染

验收标准：

- 页面不再出现 `node_failed` 这类 raw status
- 阶段完成态连续正确
- 用户能一眼看出当前节点和下一步动作
- records 默认不再像系统日志

### 第二阶段：当前动作和实时输出

目标：让运行中状态可感知，人工审核更像决策面板。

1. 增加 `pipelineLiveOutputAtom`
2. 消费 `text_delta`，显示 active node live output
3. GateCard 改为右侧审核面板
4. 失败状态展示下一步动作
5. stage filter 与当前节点联动

验收标准：

- 长任务执行时 UI 有实时输出
- 等待人工审核时右侧面板明确显示待决策内容
- 驳回时必须填写反馈
- failed 状态可直接定位节点和错误

### 第三阶段：结构化阶段产物

目标：让 UI 从“渲染文本”升级为“渲染结构化工作流产物”。

1. 为 explorer/planner/developer/tester 增加结构化 output format
2. 增加 `stage_artifact` record
3. graph state 持有 `stageOutputs`
4. 下游节点消费上游阶段产物
5. 生成 session final report

验收标准：

- 每个阶段都有稳定结构化卡片
- Reviewer 能明确基于 developer 产物审查
- Tester 能明确基于 reviewer 结论验证
- UI 可以导出完整 Pipeline 报告

### 第四阶段：性能与大任务体验

目标：长会话、多轮 reviewer、长 records 下仍然稳定。

1. records 分页或虚拟列表
2. records 增量 append
3. artifact lazy load
4. 多轮 review 对比
5. 会话报告搜索与跳转

验收标准：

- 100+ records 不卡顿
- 多轮 developer/reviewer 可读
- 产物和日志可以快速定位

## 9. 低风险 UI 改造草案

建议先从组件层面拆分：

```text
components/pipeline/
├── PipelineView.tsx
├── PipelineHeader.tsx
├── PipelineStageRail.tsx
├── PipelineRunPanel.tsx
├── PipelineReviewPanel.tsx
├── PipelineComposer.tsx
├── PipelineRecords.tsx
├── PipelineStageArtifacts.tsx
├── pipeline-display-model.ts
├── pipeline-stage-model.ts
└── pipeline-record-groups.ts
```

其中：

- `PipelineView.tsx` 只负责布局和数据读取
- `PipelineHeader.tsx` 只消费 header view model
- `PipelineStageRail.tsx` 只消费 stage view model
- `PipelineReviewPanel.tsx` 只处理 gate 决策
- `PipelineStageArtifacts.tsx` 展示阶段产物
- `PipelineRecords.tsx` 保留原始日志视图

这符合当前项目“组件化和人类可读性”的要求。

## 10. 风险与注意事项

### 10.1 不要先做纯视觉换皮

如果只换颜色、圆角和阴影，但不改信息架构，页面仍会像日志面板。

优先级应该是：

1. 状态语义
2. 当前动作
3. 阶段产物
4. 视觉细节

### 10.2 不要过早引入复杂布局

建议先在现有单页内完成：

- Header 改造
- Stepper 改造
- Records 分视图
- Gate panel 改造

等状态模型稳定后，再考虑更复杂的 resizable panels。

### 10.3 保留原始日志入口

Pipeline 是开发工作流，debug 能力很重要。

即使默认展示阶段产物，也必须保留原始 records：

- 排查状态不一致
- 复盘 gate decision
- 分析 node failure
- 验证 checkpoint 恢复

### 10.4 不要把 raw enum 泄露到 UI

所有 raw status、node、record type 都应该通过展示层映射。

这不仅是美观问题，也能减少用户理解成本。

## 11. 总结

当前 Pipeline 已经具备工程闭环，但离“好用、好看、可长期使用”的工作流产品还有三类差距：

1. **UI 信息架构差距**：页面仍按技术模块堆叠，而不是按用户决策路径组织。
2. **前端状态表达差距**：已有流式事件和状态快照，但没有形成稳定展示模型。
3. **后端产物结构差距**：records 能记录过程，但还不足以支撑漂亮、稳定的阶段产物 UI。

建议优先按以下路线推进：

1. 先把 Header、Stepper、Records、Gate Panel 做成清晰的工作台界面。
2. 再补 live output，让运行过程可见。
3. 最后结构化各阶段产物，让 Pipeline 从日志驱动 UI 升级为 artifact 驱动 UI。

这条路线投入可控，且每一阶段都能明显改善用户体验。
