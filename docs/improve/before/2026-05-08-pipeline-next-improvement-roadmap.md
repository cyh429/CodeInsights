# 2026-05-08 Pipeline 后续优化路线

## 1. 背景

本文基于当前截图、现有前后端实现、历史优化文档以及两轮只读代码评审整理。目标是给出下一阶段最值得投入的 Pipeline 优化方向。

当前 Pipeline 已经完成一轮从“最小可用闭环”到“结构化工作台”的升级：

- `explorer -> planner -> developer -> reviewer -> tester` 主链路已打通
- LangGraph checkpoint、人工审核 gate、stop / resume 基础链路已具备测试覆盖
- Header 已经从 raw enum 改为中文状态文案
- StageRail 已经升级为 stepper，支持 running / waiting / failed / done
- Records 已经拆分为“阶段产物 / 运行日志”，并支持阶段筛选、搜索、报告复制
- 节点输出已引入结构化 `stage_artifact`
- reviewer 多轮对比面板已经落地
- 阶段产物已经能落盘为 Markdown / JSON，并可从 UI 打开产物目录
- 侧边栏已经支持活跃 / 归档视图、生命周期分组、置顶与归档互斥

因此，下一轮优化不应再重复讨论“改 Header、改颜色、加 stepper、加阶段产物”这些已完成事项。更高价值的方向是：

1. 运行生命周期更可靠
2. 崩溃、刷新、重启后的恢复语义更明确
3. 人工审核和失败恢复更不容易误操作
4. 长会话、大产物、多轮 review 下仍然稳定
5. Pipeline 与 Agent 共用底座时的边界更清晰

## 2. 当前验证基线

本次评审期间已执行 Pipeline 相关自动化测试：

```bash
bun test packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-artifact-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-session-manager.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-record-builder.test.ts apps/electron/src/renderer/atoms/pipeline-atoms.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-review-comparison-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-display-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.test.ts
```

结果：`62 pass / 0 fail`。

这说明当前实现的核心模型测试是绿色的。下面的建议主要是提升真实运行可靠性、窗口生命周期、可恢复性、长任务体验和交互完整性。

更新：2026-05-08 已完成 Phase A 最小正确性加固，覆盖启动失败回滚、`STREAM_ERROR` 状态同步、运行中删除保护、gate 响应幂等/陈旧校验和 GateCard 提交锁定。后续应从 Phase B 恢复与刷新可靠性继续推进。

## 3. 总体判断

当前 Pipeline 的主要风险已经从“功能是否存在”转移为“边界条件是否可靠”。

用户真实使用时最容易遇到的问题包括：

- 启动失败后 UI 仍短暂或长期显示运行中
- 窗口刷新后 stream 回调绑定到旧 sender，新的 UI 无法继续接收实时事件
- 应用崩溃或强退后，会话仍标记为 running，但主进程已经没有 active controller
- 人工审核响应重复提交或陈旧 gate 响应可能推进错误节点
- 运行中删除会话时，后台 graph / runner 仍可能继续写 records 或发 stream
- 长 records 会话仍需要全量读取、全量搜索、全量报告生成
- 失败后用户知道“失败了”，但定位错误、复制错误、打开产物、重跑节点的路径还不够直接

优先级建议：

| 优先级 | 方向 | 目标 |
| --- | --- | --- |
| P0 | 生命周期正确性 | 不允许假运行、误删除、重复 gate 推进 |
| P1 | 恢复与 stream 可靠性 | 刷新、重启、崩溃后状态可解释、可恢复 |
| P2 | 人审与失败恢复体验 | 用户清楚下一步动作，减少重复点击和误操作 |
| P3 | 大任务性能 | 长日志、多轮 review、大产物仍然顺滑 |
| P4 | 可维护性与共享抽象 | 减少状态推导漂移，沉淀 Pipeline / Agent 共用能力 |

## 4. P0：生命周期正确性

### 4.1 启动失败后不要留下假运行状态

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`

当前现象：

- `PipelineView.handleStart()` 会先写 optimistic state，将会话设为 `running`
- 如果 `window.electronAPI.startPipeline()` 因重复运行、IPC 异常、后端校验失败而 reject，前端只在 catch 中 `console.error`
- `onPipelineStreamError` 目前只写 `pipelineStreamErrorsAtom`，不一定能把 `pipelineSessionStateMapAtom` 与 `pipelineSessionsAtom` 从 running 拉回失败态

用户影响：

- UI 会出现“按钮点击后一直运行中，但实际上没有任务在跑”的假状态
- 侧边栏和 tab indicator 可能持续显示 running
- 用户会误以为 Pipeline 卡住，而不是启动失败

建议方案：

1. `handleStart()` catch 后本地回滚为 `node_failed` 或 `idle`，并写入结构化错误
2. `STREAM_ERROR` 监听器统一更新：
   - `pipelineStreamErrorsAtom`
   - `pipelineSessionStateMapAtom`
   - `pipelineSessionsAtom`
   - `pipelinePendingGatesAtom`
   - `pipelineLiveOutputAtom`
3. 主进程 `start()` 如果在进入 graph 前失败，也应保证发出明确的错误或终态事件
4. 对“重复启动同一 session”的错误做专门文案，不混成普通节点失败

建议测试：

- `startPipeline` reject 时，session 不再保持 running
- `STREAM_ERROR` 后 pending gate 清理
- optimistic user_input 记录是否保留，需要明确产品语义
- 重复启动 active session 时显示可理解错误

风险：

- 中等。需要明确 `start` 失败到底算 `idle`、`node_failed` 还是 `terminated`。建议已有 user input 写入后失败用 `node_failed`，未进入 graph 前的配置问题仍走 preflight。

### 4.2 运行中删除会话必须被保护

涉及文件：

- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/pipeline-session-manager.ts`
- `apps/electron/src/main/ipc.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`

当前风险：

- `deleteSession()` 会清理 metadata、records、artifacts、checkpoint
- 如果该 session 正在运行，active graph / runner 之后仍可能继续 append JSONL、emit stream 或持久化 artifact
- `checkpointer.deleteThread()` 当前调用没有 await，删除链路和 checkpoint 清理也不是强同步语义

用户影响：

- 已删除会话可能重新生成 records 文件
- UI 可能收到已经删除会话的 stream 事件
- checkpoint 与 artifacts 可能出现半清理状态

建议方案：

短期：

1. `deleteSession()` 如果命中 `activeControllers.has(sessionId)`，直接拒绝并提示“Pipeline 正在运行，请先停止”
2. UI 删除按钮在 running / waiting_human 时禁用或先引导停止
3. `checkpointer.deleteThread()` 改为 await，`deleteSession` 变为 async

中期：

1. 支持 `stopAndDelete(sessionId)`：先 abort，等待 runner 生命周期结束，再删除
2. 删除前从 `gateService` 清理 pending gate
3. 删除完成后广播 session removed 事件，前端关闭相关 tab

建议测试：

- running session 删除会被拒绝
- waiting_human session 删除会被拒绝或进入 stop-and-delete
- stop 后删除不会再收到 stream event
- checkpoint 删除失败时不会误删 index 或至少返回明确错误

风险：

- 中等。`deleteSession` 从 sync 变 async 会影响 IPC、调用方和测试。

### 4.3 Gate 响应需要幂等和陈旧校验

涉及文件：

- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/pipeline-human-gate-service.ts`
- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineGateCard.tsx`

当前风险：

- `respondGate()` 如果内存 pending 命中会 resolve
- 如果内存 pending 未命中，会读取 `meta` 并直接追加 `gate_decision`，随后 resume graph
- 该路径没有严格校验：
  - `meta.status === 'waiting_human'`
  - `meta.pendingGate` 存在
  - `response.gateId === meta.pendingGate.gateId`
  - `response.sessionId === meta.id`
  - iteration 是否匹配

用户影响：

- 重复点击审核按钮可能触发重复响应
- UI 上旧的 gate card 如果没有及时刷新，可能提交陈旧 gate
- 应用重启后的 pending gate 恢复如果不完整，可能推进错误节点

建议方案：

1. `respondGate()` 在 fallback resume 前增加严格校验
2. 如果 gate 已被处理，返回 no-op 成功或明确的 `gate_already_resolved`
3. 如果 gateId 不匹配，拒绝并返回 `stale gate response`
4. `PipelineGateCard` 提交后立即进入本地 `submitting` / `submitted` 状态，直到收到 `gate_resolved` 或错误
5. 可考虑在 `PipelineGateResponse` 增加 `iteration` 字段，提升陈旧响应识别能力

建议测试：

- 重复提交同一 gate，第二次不会 resume graph
- 提交错误 gateId 会失败
- session 不在 waiting_human 时提交 gate 会失败
- 重启后 pendingGate 恢复路径仍可提交正确 gate

风险：

- 低到中等。逻辑边界清晰，但需要决定重复响应的 API 语义是 no-op 还是 error。

## 5. P1：恢复与 stream 可靠性

### 5.1 应用启动时 reconcile running / waiting_human 会话

涉及文件：

- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/main/lib/pipeline-checkpointer.ts`
- `apps/electron/src/main/lib/pipeline-session-manager.ts`
- `apps/electron/src/renderer/main.tsx`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`

当前风险：

- `getSessionState()` 能从 checkpoint fallback，但服务初始化没有系统性 reconcile
- 应用崩溃或强退后，`pipeline-sessions.json` 中的 session 可能仍是 `running`
- 新进程里没有 active controller，也没有 active runner

用户影响：

- 侧边栏一直显示运行中，但任务实际已经不存在
- 用户不知道是可恢复、等待审核、已失败，还是需要重新启动

建议方案：

应用启动或 `listSessions()` 时执行 reconcile：

1. 扫描 `status in ['running', 'waiting_human']` 的 session
2. 读取 checkpoint snapshot 和 pending interrupts
3. 如果有 pending gate：
   - 状态修正为 `waiting_human`
   - 回填 `pendingGate`
4. 如果没有 active controller 且 checkpoint 不在 interrupt：
   - 保守修正为 `recovery_failed`
   - 写入 `status_change` record，reason 为“应用重启后无法恢复运行中节点”
5. 如果未来支持继续运行，则提供显式“恢复运行”按钮，而不是自动恢复

建议测试：

- running session 无 active controller，重启后变成 recovery_failed
- waiting_human session 有 checkpoint interrupt，重启后仍显示 pending gate
- 损坏 checkpoint 不阻断 listSessions，但会写 recovery_failed

风险：

- 中到高。需要理解 LangGraph checkpoint `tasks.interrupts` 的稳定语义，避免误判。

### 5.2 Stream 不应只绑定发起方窗口

涉及文件：

- `apps/electron/src/main/ipc.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/preload/index.ts`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`

当前风险：

- `START` / `RESUME` / `RESPOND_GATE` handler 中的 callbacks 使用 `event.sender.send`
- 如果窗口刷新、renderer 重载或未来多窗口，active callbacks 仍指向旧 sender
- 新 renderer 只能拉 records / state，无法收到实时 stream 补偿

用户影响：

- 刷新后实时输出中断
- gate 处理后新界面可能只靠轮询或重新读取 records 才恢复
- 长任务期间窗口重载体验不稳定

建议方案：

短期：

1. 主进程维护 Pipeline event bus
2. stream 事件广播给所有有效 `BrowserWindow.webContents`
3. 发送前检查 `webContents.isDestroyed()`

中期：

1. 增加 `pipeline:get-events-since` 或 `pipeline:get-records-tail`
2. renderer listener 初始化时按 `updatedAt` 或 record cursor 补读
3. `STREAM_EVENT` 可以携带 sequence number，支持去重

建议测试：

- 模拟旧 sender destroyed 后不会 throw
- 新 listener 能通过 tail API 补齐 missed records
- 多窗口接收 stream 事件不会重复写 records

风险：

- 中等。要避免广播造成多 renderer 重复处理同一 stream。前端需要以 `sessionId + eventId/recordId` 去重。

### 5.3 Checkpointer 持久化需要更稳

涉及文件：

- `apps/electron/src/main/lib/pipeline-checkpointer.ts`
- `apps/electron/src/main/lib/config-paths.ts`
- `apps/electron/src/main/lib/safe-file.ts`

当前风险：

- 当前继承 `MemorySaver`，并直接读写内部 `storage` / `writes`
- 这依赖 LangGraph 内部结构，未来升级风险较高
- `writeFileSync` 不是 atomic，崩溃时可能留下半写 JSON

建议方案：

短期：

1. checkpoint 文件写入改为 atomic write
2. 增加 schema version
3. 损坏 checkpoint 移到隔离文件或忽略，并写 warning record
4. `loadAll()` 对单 session 失败不影响其他 session

中期：

1. 评估 LangGraph 是否有稳定的文件型 saver 接口
2. 如果没有，封装自有 saver，不直接依赖 `MemorySaver` 私有结构

建议测试：

- 半截 JSON checkpoint 不阻断服务启动
- 单个坏 checkpoint 不影响其他 session
- checkpoint schema version 不匹配时走 recovery_failed

风险：

- 中到高。替换 saver 影响恢复路径，需要保守推进。

## 6. P2：人审、失败恢复与前端交互

### 6.1 Gate 审核面板需要更强动作状态

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineGateCard.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-display-model.ts`

当前不足：

- 提交期间按钮 disabled 只能覆盖当前组件本地状态
- 提交成功后，如果 stream 事件稍慢，用户仍可能看到同一个 gate
- 窄屏时 gate panel 在 records 与 composer 的布局中不一定足够显眼

建议方案：

1. 提交后进入 `submittedGateIds` 本地状态或全局 atom
2. 同一 gateId 的所有按钮显示“处理中”
3. `gate_resolved` 或 `STREAM_ERROR` 后清理 submitted 状态
4. 窄屏下 pending gate 提到 records 前面，或 Header 下方显示醒目 action bar
5. 对 reviewer gate 展示更明确的模型结论、issues 数量和人工动作后果

建议测试：

- 点击 approve 后按钮立即不可重复点击
- 提交失败后恢复按钮可用并显示错误
- 窄屏布局下 pending gate 在主内容前可见

风险：

- 低到中等。主要是状态协调。

### 6.2 StageRail 应成为阶段导航

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineStageRail.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.ts`

当前不足：

- StageRail 只能显示状态，不能点击定位阶段
- Records 的 `stageFilter` 是内部 state，外部无法驱动

建议方案：

1. 将 Records 的 `stageFilter` 上提到 `PipelineView`
2. `PipelineStageRail` 点击节点后更新 filter
3. Records 收到 filter 后滚动到对应阶段第一条产物
4. stage node 显示 count 或状态摘要：
   - 已有产物数量
   - 是否有错误
   - 是否有 pending gate
5. disabled / todo 节点仍可点击，但只筛选空态，避免用户困惑

建议测试：

- 点击 planner 后 Records 切到 planner filter
- 点击 reviewer 后多轮 review 面板仍按 reviewer 展示
- 当前搜索条件与阶段点击的优先级明确

风险：

- 中等。需要避免 `PipelineRecords` 变成过度受控组件。

### 6.3 失败卡增加定位与恢复工具

涉及文件：

- `apps/electron/src/renderer/components/pipeline/PipelineFailureCard.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.ts`

当前不足：

- 失败态可以显示错误详情和重新启动入口
- 但缺少“定位错误记录”“复制错误”“打开产物目录”“查看失败前输出”的直达动作

建议方案：

1. 增加 `复制错误`
2. 增加 `定位错误日志`，联动 Records 的 logs tab 和 error record
3. 增加 `打开产物目录`
4. 如果失败前存在 live output，支持展开完整 partial output
5. 后端若未来支持 `rerun_node`，再加 `重跑当前节点`

建议测试：

- failure card 能定位最新 error record
- copy error 成功 / 失败状态可见
- 无 artifacts 时打开目录按钮禁用或提示

风险：

- 中等。复制与定位低风险，重跑当前节点需要后端能力确认。

### 6.4 Sidebar 状态与可访问性增强

涉及文件：

- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineSidebar.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-session-sidebar-model.ts`

当前不足：

- 指示状态主要依赖 `pipelineSessionStateMapAtom`
- 如果 state map 没有回填，session meta 是 fallback，但 indicator 可能偏弱
- 会话行目前是 `div role="button"`，重命名、置顶、归档等 hover 操作对键盘用户不够友好

建议方案：

1. `pipelineSessionIndicatorMapAtom` 合并 `stateMap` 与 `pipelineSessionsAtom`，stateMap 优先，session meta 兜底
2. 会话副标题增加当前节点与轮次，例如 `开发中 · 第 2 轮`
3. waiting_human 和 node_failed 行显示更明确的视觉提示
4. 会话行改为实际 `<button>` 或补齐键盘 Enter / Space 操作
5. hover 操作提供更多键盘可见入口

建议测试：

- 没有 stateMap 时，sidebar indicator 仍根据 session.status 显示 blocked / running
- 键盘 Enter / Space 能打开 session
- 归档、置顶、重命名不破坏 hover 操作

风险：

- 中等。需要小心 titlebar drag 区域与按钮事件冲突。

### 6.5 Pipeline 关闭确认文案不要复用 Agent 文案

涉及文件：

- `apps/electron/src/renderer/hooks/useCloseTab.tsx`
- `apps/electron/src/renderer/components/tabs/TabCloseConfirmDialog.tsx`

当前不足：

- 运行中 Pipeline 关闭确认可能复用 Agent 语义
- 用户可能看到不匹配的文案，例如“Agent 还在执行任务”

建议方案：

1. `TabCloseConfirmDialog` 根据 `tab.type` 输出不同标题和描述
2. Pipeline 文案应明确：
   - 关闭标签不会停止 Pipeline
   - 若要停止，请先点击停止运行
   - 后台运行可在侧边栏重新打开

风险：

- 低。纯文案和类型分支。

## 7. P3：长会话和大产物性能

### 7.1 Records 改为分页 / tail / 增量读取

涉及文件：

- `apps/electron/src/main/lib/pipeline-session-manager.ts`
- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/main/ipc.ts`
- `apps/electron/src/preload/index.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`

当前不足：

- `getPipelineRecords(sessionId)` 每次读取完整 JSONL
- 前端每个 refreshVersion 都重新读取全量 records
- 前端虽然做了分段渲染，但数据层仍是全量

建议方案：

第一步：

1. 新增 `getPipelineRecordsTail(sessionId, limit)`
2. 新增 `getPipelineRecordsPage(sessionId, cursor, limit)`
3. Records 默认只加载 artifacts 相关记录和最近日志

第二步：

1. `PipelineStreamEvent` 中携带新生成的 `PipelineRecord[]` 或 record refs
2. 前端本地增量 append records
3. 刷新时再做 tail reconcile

第三步：

1. 引入虚拟列表或更细粒度的 lazy render
2. 搜索走主进程流式 / 分页搜索，不再全量 stringify

建议测试：

- 500 条 records 下首屏只加载 tail
- 搜索结果能跨页定位
- stream append 不重复写 UI records

风险：

- 中到高。会影响 IPC 契约和 Records UI 状态，需要分阶段迁移。

### 7.2 大内容不要在 record、JSON、Markdown 中重复保存

涉及文件：

- `apps/electron/src/main/lib/pipeline-artifact-service.ts`
- `apps/electron/src/main/lib/pipeline-record-builder.ts`
- `packages/shared/src/types/pipeline.ts`

当前不足：

- `stage_artifact` record 包含完整 `artifact.content`
- artifact JSON 文件也保存完整内容
- Markdown 文件也保存完整内容
- 大会话会带来磁盘膨胀和读取成本

建议方案：

短期：

1. record 保留 summary、bullets、artifactFiles
2. 大字段 `content` 可设长度上限，超过后仅保存引用
3. `buildPipelineMarkdownReport` 需要时从 artifact 文件读取全文

中期：

1. 定义 `PipelineArtifactContentRef`
2. 结构化产物 metadata 与正文分离
3. UI 展开全文时 lazy load 文件

建议测试：

- 大 content stage artifact 只在文件中保存一次
- UI summary 不受影响
- 展开全文时能 lazy load 成功
- 文件丢失时 UI 能降级显示摘要

风险：

- 中等。需要处理历史 records 兼容。

## 8. P4：可维护性和共享抽象

### 8.1 状态推导来源需要收敛

涉及文件：

- `apps/electron/src/main/lib/pipeline-session-manager.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `packages/shared/src/utils/pipeline-state.ts`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`

当前现状：

- `pipeline-session-manager.appendPipelineRecord()` 会根据 record patch session meta
- `pipeline-service.syncSessionState()` 会根据 graph snapshot patch session meta
- `packages/shared/src/utils/pipeline-state.ts` 也能根据 records replay state
- renderer 还通过 `applyPipelineStreamState()` 推进前端 state map

风险：

- 同一件事有多个 reducer，长期会漂移
- 恢复、records replay、stream state、session meta 可能产生不同答案

建议方案：

1. 明确权威状态来源：
   - 运行中：graph snapshot 为权威
   - 历史回放：shared reducer 为权威
   - session meta：只是查询索引与缓存
2. 主进程尽量复用 shared reducer 或统一状态 patch helper
3. `gate_requested` record 补齐 title、feedbackHint、iteration，保证 replay 能重建完整 pending gate
4. renderer 的 `applyPipelineStreamState()` 只做 UI 快照，最终以 session state reconcile

建议测试：

- 同一条 records replay 得到的 state 与 session meta 一致
- gate requested / decision replay 能恢复 pendingGate 和 reviewIteration
- node_failed / terminated / completed 的 replay 一致

风险：

- 中等。需要兼容旧 records。

### 8.2 Runner prompt 和 structured output 校验需要拆分

涉及文件：

- `apps/electron/src/main/lib/pipeline-node-runner.ts`
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`

当前不足：

- `prompt` 和 `systemPrompt` 当前都使用 `buildRolePrompt()`
- structured output 解析失败后会静默生成空字段
- reviewer 的 `approved` 解析失败时会默认 false，可能把格式问题当成审查驳回

建议方案：

1. 拆分 system prompt 和 user prompt
   - system prompt：角色、边界、输出格式、工具策略
   - user prompt：用户任务、上游 stageOutputs、人工反馈
2. 对 JSON schema 输出做严格校验
3. 解析失败时明确：
   - 重试一次
   - 或标记 `node_failed`
   - 或写 `structured_output_parse_failed` error record
4. UI 需要能区分“模型审查驳回”和“结构化输出解析失败”

建议测试：

- reviewer 返回非 JSON 时不被误判为模型驳回
- explorer / planner 空数组字段是否允许
- schema 缺 required 字段时输出明确错误

风险：

- 中等。需要确认 Claude Agent SDK 的 `outputFormat` 实际返回行为。

### 8.3 Pipeline 与 Agent 共享生命周期底座

涉及文件：

- `apps/electron/src/main/lib/agent-orchestrator.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- `apps/electron/src/renderer/components/agent/*`
- `apps/electron/src/renderer/components/pipeline/*`

当前现状：

- Pipeline 复用了 Agent 的渠道、工作区、MCP、Skills 能力
- 但 stream lifecycle、session indicator、sidebar item、错误处理正在形成两套相似逻辑

建议方案：

1. 抽象主进程 stream lifecycle wrapper：
   - active controller
   - abort
   - callbacks
   - terminal event
   - error record
2. 抽象前端 session indicator model
3. 抽象 sidebar session item 的 pin / archive / rename 行为
4. 错误模型统一为 `DisplayError`，再按 Agent / Pipeline 定制文案

风险：

- 中等。不要为了抽象而抽象，应在解决重复 bug 时提取。

## 9. 推荐实施顺序

### Phase A：正确性加固

目标：先确保不会假运行、误删、重复审核。

- [x] 修复启动失败 optimistic state 回滚
- [x] `STREAM_ERROR` 统一落状态和清理 pending gate
- [x] 运行中删除保护
- [x] `respondGate()` 增加 gateId / status / pendingGate 校验
- [x] GateCard 提交后进入 submitted 状态

验收：

- 启动失败不会卡 running
- 重复 gate 响应不会推进 graph
- 运行中删除会被阻止
- 相关 service / atoms / component model 测试通过

### Phase B：恢复与刷新可靠性

目标：窗口刷新、应用重启、checkpoint 异常都能给出可靠状态。

更新：2026-05-08 已完成 Phase B，覆盖启动 reconcile、损坏 checkpoint 降级、stream event bus 广播、records tail 补偿读取与 UI 增量刷新。

- [x] 启动时 reconcile running / waiting_human session
- [x] 损坏 checkpoint 降级为 recovery_failed
- [x] Pipeline stream 改为主进程 event bus 广播
- [x] 增加 records tail / events since 补偿接口

验收：

- 重启后不会出现无 active runner 的永久 running
- 窗口刷新后可以补齐当前 records 和 pending gate
- 旧 sender destroyed 不影响主进程运行

### Phase C：人审与失败恢复体验

目标：用户清楚当前该做什么，失败后能定位和恢复。

更新：2026-05-08 已完成 Phase C，覆盖移动端审核面板优先展示、StageRail 到 Records 的阶段定位、失败卡定位/复制/产物入口、Sidebar 节点轮次信号和 Pipeline 独立关闭确认。

- [x] Gate 面板在窄屏更显眼
- [x] StageRail 点击联动 Records 阶段筛选
- [x] FailureCard 增加定位错误、复制错误、打开产物目录
- [x] Sidebar 增强当前节点、轮次、等待/失败信号
- [x] Pipeline 关闭确认文案独立于 Agent

验收：

- 等待人工审核时，首屏能看到明确待处理动作
- 点击阶段能跳到对应产物
- 节点失败后 1-2 次点击内能定位错误记录

### Phase D：长任务性能

目标：多轮 review、长日志、大产物仍然稳定。

更新：2026-05-08 已完成 Phase D 的低风险性能项，覆盖 records tail / page API UI 接入确认、搜索防抖、主进程异步 JSONL 流式分页搜索和轻量命中摘要。

更新：2026-05-08 已补完 Phase D 大产物尾项，stage artifact 正文剥离到 content 文件，record / JSON / Markdown 只保存预览和引用；UI 展开全文与复制报告按需读取 content 文件。

- [x] records tail / page API 接入 UI
- [x] 搜索改为 debounce + 主进程分页搜索
- [x] 大内容从 record 中剥离为文件引用
- [x] 展开全文 lazy load artifact content
- [x] 报告生成按需读取 artifact 文件

验收：

- 500+ records 会话首屏仍然快速渲染
- 搜索不会卡主线程
- 产物文件缺失时 UI 有可理解降级

### Phase E：状态与底座收敛

目标：减少长期维护成本。

更新：2026-05-08 已完成 Phase E 的核心收敛项，覆盖状态权威边界、records replay 与 session meta patch 对齐、Pipeline runner prompt 拆分，以及 structured output 严格校验。共享抽象已先落在低风险 sidebar 基础行为：抽取通用 updatedAt 排序与今天 / 昨天 / 更早日期分组，供 Pipeline、Agent、Chat 侧边栏复用；Agent Working 分区、Pipeline 阶段状态和 lifecycle 编排仍保持独立，等待出现明确重复问题后再继续提取。

- [x] 明确 graph snapshot、shared reducer、session meta 的权威边界
- [x] 让 records replay 和 session meta 对齐
- [x] 拆分 Pipeline runner 的 system prompt / user prompt
- [x] structured output 增加严格校验与错误类型
- [x] 逐步抽象 Pipeline / Agent 共享 lifecycle 和 sidebar 行为

验收：

- 状态 replay 测试覆盖 gate、review iteration、terminal status
- JSON schema 解析失败不会被误判为 reviewer 驳回
- 新增共享抽象后不降低 Pipeline 与 Agent 的可读性

## 10. 具体任务候选清单

### 后端候选任务

1. `pipeline-service`: `deleteSession()` 改 async，并阻止 active session 删除
2. `pipeline-service`: `respondGate()` 增加 pendingGate 校验与重复响应 no-op
3. `pipeline-service`: `start()` 失败前后补 terminal event 或统一 error payload
4. `pipeline-service`: 增加 `reconcileSessionsOnStartup()`
5. `pipeline-checkpointer`: 改 atomic write，增加 schema version 和损坏 checkpoint 降级
6. `main/ipc`: Pipeline stream 从 `event.sender.send` 改为 event bus 广播
7. `pipeline-session-manager`: 增加 `getRecordsTail` / `getRecordsPage`
8. `pipeline-node-runner`: 拆分 prompt，严格校验 structured output

### 前端候选任务

1. `PipelineView`: start reject 时回滚 optimistic running
2. `useGlobalPipelineListeners`: `STREAM_ERROR` 同步 state map / sessions / gates / live output
3. `PipelineGateCard`: 增加 submitted gate 状态和重复提交保护
4. `PipelineStageRail`: 支持点击阶段筛选 Records
5. `PipelineRecords`: 暴露 stageFilter 控制接口，支持定位 record
6. `PipelineFailureCard`: 增加复制错误、定位日志、打开产物目录
7. `PipelineSidebar`: indicator 合并 session meta fallback，并改善键盘操作
8. `TabCloseConfirmDialog`: Pipeline 独立关闭文案

### Shared 契约候选任务

1. `PipelineGateResponse` 可选增加 `iteration`
2. `PipelineGateRequestedRecord` 补齐 title / feedbackHint / iteration
3. 新增 `PipelineDisplayError` 或主进程 error code 类型
4. 新增 records page / tail IPC input / output 类型
5. 新增 artifact content ref 类型，为大内容拆分做准备

## 11. 风险注意事项

### 11.1 不要把恢复做成自动继续运行

应用重启后自动继续执行 Pipeline 看起来高级，但风险较高：

- 旧 runner 状态不一定可恢复
- 工具调用上下文可能已经丢失
- 用户可能不希望重启后自动继续修改代码

建议先做“状态修正 + 人工确认恢复”，不要直接自动 resume running node。

### 11.2 不要让 event bus 导致重复 UI 写入

stream 广播后，多个 renderer 都会收到同一事件。前端必须按 `sessionId + event id / record id` 做幂等处理，或者只允许一个 store 实例处理写入。

### 11.3 不要一次性替换 records 存储模型

JSONL 当前简单可靠。分页、tail、大内容引用应逐步叠加，保留旧 records 兼容，不要一次性迁移所有历史数据。

### 11.4 不要把 Agent 和 Pipeline 过早抽象到同一个 UI 组件

Agent 是对话型执行，Pipeline 是阶段型工作流。共享 lifecycle 和 sidebar 基础行为是合理的，但核心 UI 信息架构应保持独立。

## 12. 结论

当前 Pipeline 已经进入第二阶段：不是从 0 到 1，而是从“能用”到“可信赖、可恢复、可长期运行”。

最建议先做的 5 件事：

1. 修复启动失败后的假 running 状态
2. 禁止或安全处理运行中删除会话
3. 给 gate 响应增加严格校验和幂等语义
4. 应用启动时 reconcile running / waiting_human 会话
5. 将 stream 从发起窗口回调升级为主进程事件总线加补读机制

这些改完后，Pipeline 的可靠性会明显提升。随后再推进 StageRail 导航、失败恢复工具、records 分页和大产物引用，用户体验会更自然，后续复杂 Pipeline 能力也会更容易承载。
