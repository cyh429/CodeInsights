# 2026-05-07 Pipeline 前后端优化建议

## 1. 背景

本文基于当前 `codeinsights-pipeline` 的现有实现做一次面向工程落地的优化审查，重点覆盖：

- 主进程 Pipeline 编排与恢复链路
- Pipeline 状态持久化与前端状态同步
- Pipeline 主视图的人审、启动、停止、记录展示
- Pipeline 与 Agent 现有基础设施复用时的边界问题

目标不是讨论长期愿景，而是给出当前代码基础上最值得优先投入的优化点。

## 2. 当前判断

当前 Pipeline 已经具备最小可用闭环：

- `explorer -> planner -> developer -> reviewer -> tester`
- LangGraph 主进程编排
- 本地 JSON / JSONL / checkpoint 持久化
- 人工审核 gate
- 基本的前端会话、状态轨和 records 展示

但从前后端实现看，仍有几类问题：

1. 有些属于行为正确性问题，已经会影响真实执行结果
2. 有些属于状态一致性问题，容易让 UI 和实际运行状态分叉
3. 有些属于结构已预留但尚未真正打通，影响后续演进

下面按优先级展开。

## 3. 高优先级优化项

### 3.1 reviewer 驳回路径绕过人工审核，和设计目标不一致

涉及文件：

- `apps/electron/src/main/lib/pipeline-graph.ts`
- `docs/pipeline/2026-05-06-codeinsights-pipeline-design.md`

当前问题：

- `pipeline-graph.ts` 中 reviewer 一旦返回 `approved === false`，会直接跳回 `developer`
- 只有 reviewer 通过时才进入 `gate_reviewer`
- 这与设计稿中“每个节点输出后必须暂停，等待人工审核”不一致

直接影响：

- 用户看不到 reviewer 驳回结论对应的独立审核停顿
- reviewer 失败结论没有成为完整的人审节点
- 审查链不完整，复盘时很难区分“模型自动驳回”和“人类确认驳回”

建议：

- reviewer 无论通过或驳回，都先进入 `gate_reviewer`
- gate 中再由用户决定：
  - 通过后进入 `tester`
  - 驳回并带反馈后回到 `developer`
  - 重跑 reviewer 或 developer
- 让 reviewer 的输出成为一等可见产物，而不是自动分支内部细节

### 3.2 stop / abort 后前后端状态同步不完整

涉及文件：

- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`

当前问题：

- `pipeline-service.ts` 的 `stop()` 只做 abort 和主进程元数据更新
- 前端监听器只在 `STREAM_ERROR` 中写入错误文本，没有同步 `terminated`、清理 gate 或修正 state map
- `PipelineView` 点击停止后也没有本地兜底更新

直接影响：

- 会话可能已经终止，但前端仍显示 `running` 或 `waiting_human`
- stop 时若正处于 gate，界面可能仍停留在“等待人工审核”
- 侧边栏状态、主视图状态、records 视图可能短时间甚至持续不一致

建议：

- stop 后主进程主动发一个明确的 `status_change(terminated)` 或统一的 complete/error 终态事件
- 前端监听器收到终态后统一更新：
  - `pipelineSessionStateMapAtom`
  - `pipelinePendingGatesAtom`
  - `pipelineSessionsAtom`
  - `pipelineStreamErrorsAtom`
- `PipelineView` 在 stop 请求发出后可以加本地 optimistic terminated 状态，减少 UI 悬挂

### 3.3 resume / respondGate 缺少与 start 对称的生命周期保护

涉及文件：

- `apps/electron/src/main/lib/pipeline-service.ts`

当前问题：

- `start()` 路径有 `AbortController`、`try/catch/finally`、error record、runner 清理
- `respondGate()` / `resume()` 没有同等级封装
- gate 恢复后如果 graph 或 node 执行失败，恢复链路的异常处理弱于首次启动

直接影响：

- 恢复阶段报错时更容易留下半更新状态
- stop 对恢复中的流程作用不完整
- 后续一旦加多节点并发或更复杂恢复语义，这里会成为脆弱点

建议：

- 抽一个统一的 `runPipelineExecution()` 包装器
- `start()` 和 `resume()` 都走同一套：
  - controller 注册
  - runner 生命周期管理
  - error record
  - terminated / failed 状态写回
  - finally 清理

### 3.4 启动前缺少前端 preflight 校验

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineComposer.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/main/lib/pipeline-node-runner.ts`

当前问题：

- 前端只检查输入框是否为空
- `channelId` / `workspaceId` 缺失时，仍然允许点击启动
- 真正报错在后端 `runNode()` 中才发生

直接影响：

- 用户体验上是“按钮能点，但点完才知道没配好”
- 错误出现在主进程，定位路径比前端提示更绕

建议：

- 在 `PipelineView` 启动前先做配置可用性检查：
  - 默认渠道是否存在
  - 渠道是否为 Agent 兼容 Provider
  - 当前工作区是否存在
- 缺失时直接在前端展示明确提示，并给出跳转设置入口
- 后端仍保留兜底校验，但不再承担第一层用户引导

## 4. 中优先级优化项

### 4.1 reviewer 结构化结果类型已定义，但没有真正落盘

涉及文件：

- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`

当前问题：

- Shared 类型里已经有 `PipelineReviewResultRecord`
- 但当前后端只写 `node_output`，没有写 `review_result`
- 前端 records 已支持渲染 `review_result`，实际却永远拿不到

直接影响：

- reviewer 的 `approved / issues / summary` 无法被结构化消费
- 后续做过滤、统计、比较多轮 reviewer 结论时很难扩展

建议：

- reviewer 节点完成时额外写一条 `review_result`
- records 视图对 reviewer 结果做更清晰的专用展示
- 为 future feature 预留：
  - reviewer issue 列表折叠
  - 多轮 reviewer 对比
  - 驳回原因聚类

### 4.2 records 视图仍偏日志视角，缺少“阶段产物”视角

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`

当前问题：

- 现在 records 更像 JSONL 的薄展示层
- `node_output` 默认只显示 `summary`
- gate decision、review issues、测试结果没有层次化表达

直接影响：

- 用户读起来像系统日志，而不是工作流产出
- 当一个 session 进入多轮 developer / reviewer 迭代后，可读性会迅速下降

建议：

- 把 records 视图拆为两层：
  - 阶段摘要流
  - 原始记录流
- 节点输出卡片增加：
  - 节点名
  - 轮次
  - 摘要
  - 展开全文
- reviewer / tester 使用专门卡片样式，而不是和普通输出同层

### 4.3 重新启动同一会话时前端 optimistic node 不准确

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`

当前问题：

- `handleStart()` 的 optimistic state 继承了当前会话已有 `currentNode`
- 但 graph 实际每次 `invoke()` 都从 `explorer` 开始

直接影响：

- 终止后再次启动同一会话时，界面会先短暂显示旧节点
- 随后再被流式事件纠正，造成明显 UI 抖动

建议：

- 启动时 optimistic node 直接固定为 `explorer`
- 若以后支持从 checkpoint 真恢复，再区分 `start fresh` 与 `resume existing run`

### 4.4 Pipeline 侧栏虽然已对齐骨架，但会话操作仍偏轻量

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`

当前问题：

- 现在已经具备重命名和置顶，但与 Agent 相比仍缺少更完整的会话治理能力
- 例如归档入口、明确的工作中分区、更多 hover 操作尚未接通

建议：

- 第二阶段补齐：
  - Pipeline 已归档视图
  - 当前运行 / 等待审核 / 已完成 的分区视图
  - 更明确的会话生命周期筛选

## 5. 低优先级但值得提前设计的项

### 5.1 Pipeline artifact 缺少专门落点与 UI 消费路径

当前问题：

- 目录结构已经预留了 `pipeline-artifacts`
- 但目前几乎没有真正写入“可交付产物”

建议：

- developer / tester 阶段逐步引入 artifact 约定
- 例如：
  - patch 摘要
  - 测试报告
  - 关键 diff
  - 相关文件快照

### 5.2 缺少更完整的集成测试和 E2E 覆盖

当前问题：

- 目前有 graph / service 级单测
- 但 stop、resume 异常路径、前端状态一致性、真实 IPC 联动覆盖还不足

建议：

- 增补测试优先级：
  1. stop during running
  2. stop during waiting_human
  3. respondGate 后节点失败
  4. 无渠道/无工作区 preflight
  5. renderer 监听器在终态下能正确清理 gate 和 running indicator

### 5.3 Pipeline 和 Agent 的底座能力仍可进一步抽象共享

当前问题：

- 现在已经在工作区、MCP、Skills、渠道配置上复用了一部分 Agent 能力
- 但执行生命周期、状态同步、会话列表治理仍有重复实现趋势

建议：

- 后续把以下能力抽成共享层：
  - session list item 行为
  - stream lifecycle 包装器
  - terminal status -> renderer state 的统一同步器
  - sidebar 会话治理动作

## 6. 建议的实施顺序

建议按三阶段推进：

### 第一阶段：先修正确性

1. reviewer 驳回后也进入人工审核 gate
2. stop / abort 终态同步补齐
3. start / resume 生命周期统一封装
4. 启动前 preflight 校验

### 第二阶段：补强可读性和可运维性

1. reviewer `review_result` 结构化落盘
2. records 视图升级为阶段产物视图
3. 会话状态和分区视图增强

### 第三阶段：为后续能力做底座

1. pipeline artifact 真正落盘
2. 增补集成测试 / E2E
3. 抽象与 Agent 共享的执行和侧边栏能力

## 7. 总结

当前 Pipeline 的主要问题不在“有没有功能”，而在“状态语义和恢复语义还不够硬”。

从投入产出比看，最值得优先做的不是继续堆新界面，而是先把下面四件事做扎实：

1. reviewer 驳回路径的人审语义修正
2. stop / abort 的前后端一致性修正
3. start / resume 生命周期收敛
4. 启动前配置校验

这四项修完之后，Pipeline 才算从“最小可用原型”进入“可以稳定承接真实开发任务”的阶段。
