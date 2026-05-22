# 2026-05-06 CodeInsights Pipeline 开发任务清单

> 状态：进行中（后端主链路与基础 UI 已落地）
> 唯一活跃任务单：是
> 真源文档：
> - `docs/pipeline/2026-05-06-codeinsights-pipeline-design.md`
> - `docs/pipeline/2026-05-06-codeinsights-pipeline-implementation-plan.md`

## 更新规则

- 仅以 2026-05-06 两份确认稿为实现依据。
- `codeinsights-pipeline-development-plan.md` 仅作为历史草稿保留，不参与决策。
- 每个阶段必须先补失败测试，再补最小实现，再记录验证结果。
- 本文件是本次 CodeInsights Pipeline 改造的唯一进度追踪文档，不再并行维护第二份活跃 checklist。

## 状态图例

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 明确延期或本期不做

## 阶段清单

### Phase 1 Foundation

- [x] 锁定 `@langchain/langgraph` 与 `@langchain/core` 版本
- [x] 新增 pipeline shared 类型与 IPC 常量
- [x] 新增 pipeline 状态推进工具与测试
- [x] 补齐 pipeline 本地存储路径函数
- [x] 递增受影响包 patch 版本并更新依赖
交付物：shared pipeline 契约、`pipeline-state.ts`、基础测试、pipeline 路径工具
验证命令/场景：`npm view @langchain/langgraph version`、`npm view @langchain/core version`、`bun test packages/shared/src/utils/pipeline-state.test.ts`、`bun run --filter='@codeinsights/shared' typecheck`
完成定义：shared 层可独立通过测试和 typecheck，并具备主进程接入所需的最小契约

### Phase 2 Main Process Persistence

- [x] 新增 `pipeline-session-manager.ts` 与 JSONL 持久化测试
- [x] 新增 `pipeline-human-gate-service.ts` 与待审批恢复测试
- [x] 新增 `pipeline-node-runner.ts`
- [x] 新增 `pipeline-graph.ts` 与 reviewer 回跳测试
交付物：pipeline session 管理、gate 服务、节点执行适配层、LangGraph 骨架
验证命令/场景：`bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts`、`bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts`、`bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
完成定义：主进程可在不依赖 UI 的情况下完成 session 持久化、gate 等待和 graph 主链路流转

### Phase 3 Runtime Orchestration

- [x] 新增 `pipeline-checkpointer.ts`
- [x] 新增 `pipeline-service.ts`
- [x] 打通 start / stop / resume / recover 生命周期
- [x] 复用现有 agent 底座完成 Claude 节点执行环境注入
交付物：pipeline service、checkpoint 恢复、stream 事件派发与记录落盘
验证命令/场景：`bun test apps/electron/src/main/lib/pipeline-service.test.ts`
完成定义：pipeline service 能独立驱动主流程，并支持中断和恢复

### Phase 4 IPC / Preload

- [x] 注册 pipeline IPC handlers
- [x] 在 preload 暴露 pipeline API
- [x] 暴露 pipeline stream 事件订阅接口
交付物：主进程 IPC handlers、`window.electronAPI` pipeline API
验证命令/场景：`bun run --filter='@codeinsights/electron' typecheck`
完成定义：renderer 可通过 preload 调用和订阅完整 pipeline 生命周期

### Phase 5 Renderer State

- [x] 新增 `pipeline-atoms.ts`
- [x] 新增 `useGlobalPipelineListeners.ts`
- [x] 新增 pipeline stream / gate / refresh / running 状态映射
- [x] 补 Tab 相关纯逻辑测试
交付物：pipeline Jotai 状态、全局监听器、tab 适配
验证命令/场景：相关 `bun test`、`bun run --filter='@codeinsights/electron' typecheck`
完成定义：renderer 可在不接 UI 细节的情况下稳定消费 pipeline IPC 事件

### Phase 6 UI Activation

- [x] 新增 `PipelineView`、`PipelineHeader`、`PipelineStageRail`
- [x] 新增 `PipelineRecords`、`PipelineComposer`、`PipelineGateCard`
- [x] 将 `AppMode` / `TabType` 主入口切到 `pipeline | agent`
- [x] 更新 sidebar、search、快捷键、welcome / onboarding 入口
- [~] 保留旧 chat 代码为隐藏回退，不进入普通用户路径
交付物：Pipeline 主界面、模式切换、会话入口切换
验证命令/场景：`bun run --filter='@codeinsights/electron' typecheck`、`bun run electron:build`
完成定义：应用默认进入 pipeline 主入口，正常 UI 仅显示 `Pipeline / Agent`

### Phase 7 End-to-End Behavior

- [x] 打通 happy path：`explorer -> planner -> developer -> reviewer -> tester`
- [x] 打通 reviewer 驳回反馈重跑
- [x] 打通 rerun node / stop / terminate
- [x] 验证中断恢复、重启恢复和 pending gate 恢复（以 graph/service/checkpointer 测试覆盖为主）
- [~] 完成 smoke test 与收尾 review
- [-] README / README.en / AGENTS 同步更新（等待用户批准）
交付物：可运行的 CodeInsights Pipeline 首版闭环和最终验证记录
验证命令/场景：`bun test`、`bun run typecheck`、`bun run electron:build`、手工 smoke test
完成定义：主链路和恢复链路均可验证通过，且所有结果写回本文件

## 验证记录

- 2026-05-06：版本调研完成，npm 官方源返回 `@langchain/langgraph@1.3.0`、`@langchain/core@1.1.44`
- 2026-05-06：失败测试先行证据
- `bun test packages/shared/src/utils/pipeline-state.test.ts` 初次失败：`Cannot find module './pipeline-state'`
- `bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts` 初次失败：`Cannot find module './pipeline-session-manager'`
- `bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts` 初次失败：`Cannot find module './pipeline-human-gate-service'`
- `bun test apps/electron/src/main/lib/pipeline-graph.test.ts` 初次失败：`Cannot find module './pipeline-graph'`
- 2026-05-06：当前自动化验证通过
- `bun test packages/shared/src/utils/pipeline-state.test.ts`
- `bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts`
- `bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts`
- `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
- `bun test apps/electron/src/main/lib/pipeline-service.test.ts`
- `bun test apps/electron/src/renderer/atoms/tab-atoms.test.ts`
- `bun run --filter='@codeinsights/shared' typecheck`
- `bun run --filter='@codeinsights/electron' typecheck`
- `bun run electron:build`

## Review 结论

- 已完成：shared 契约、主进程 graph/checkpointer/service、IPC/preload、renderer atoms/listeners、最小可用 pipeline UI、主入口切换
- 已知未完成：SearchDialog 尚未改为检索 pipeline，会话/标题等 UI 仍保留少量 chat 内部回退分支，尚未做完整手工 smoke test
