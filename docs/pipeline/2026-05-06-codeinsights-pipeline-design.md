# 2026-05-06 CodeInsights Pipeline 设计稿

> 状态：已确认  
> 范围：首版 `pipeline` 平替 `chat`，保留隐藏回退  
> 文档位置：`docs/pipeline/`

## 1. 目标与边界

本次改造的目标不是在现有 `chat` 旁边再挂一个新页面，而是让 CodeInsights 的主入口从“自由对话”切换为“面向 RISC-V 贡献的结构化流水线”。首版优先打通以下闭环：

1. `explorer -> planner -> developer -> reviewer -> tester`
2. 每个节点输出后必须暂停，等待人工审核
3. `developer / reviewer` 支持多轮迭代，直到 reviewer 通过或达到上限
4. 所有节点统一通过 `Claude Agent SDK` 执行
5. 底层使用 LangGraph 在主进程编排
6. 本地 JSON / JSONL / checkpoint 持久化，支持中断恢复

首版暂不追求：

- 大规模真实 RISC-V 邮件列表抓取与复杂可信度评分
- reviewer 多模型仲裁
- pipeline 专属右侧文件树面板
- 多 pipeline 并发调度队列
- 云端同步和数据库化存储
- 立即物理删除旧 `chat` 代码

## 2. 核心决策

### 2.1 模式切换

- 对外模式从 `chat | agent` 调整为 `pipeline | agent`
- 默认模式改为 `pipeline`
- 旧 `chat` 代码首版保留为隐藏回退，不进入普通用户路径

### 2.2 会话域拆分

- `pipeline session` 独立于 `chat conversation`
- 不把 pipeline 状态硬塞进现有 `agent session`
- Tab 体系继续复用现有多标签结构，只把 `chat` 标签替换为 `pipeline`

### 2.3 技术实现方向

- 推荐方案：独立 `pipeline` 域 + 复用现有 `agent` 底座能力
- 不采用“把 pipeline 强行塞进 agent 会话”的方案
- 不采用“首版全量重建全部基础设施”的方案

## 3. 架构总览

整体链路保持仓库现有风格：

`shared types/constants -> main ipc handlers -> preload API -> renderer atoms/listeners -> React view`

新增域如下：

- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/main/lib/pipeline-*.ts`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- `apps/electron/src/renderer/components/pipeline/*`

保留并复用的能力：

- `agent-orchestrator.ts` 中的 SDK 环境构建经验
- 工作区、技能、MCP、权限模式等既有配置能力
- `AppShell`、`TabBar`、多标签、左侧栏整体框架
- 本地 JSON / JSONL 文件存储方式

## 4. Mode / Tab / Session 设计

### 4.1 AppMode

- `apps/electron/src/renderer/atoms/app-mode.ts`
- 类型从 `'chat' | 'agent'` 改为 `'pipeline' | 'agent'`
- 默认值改为 `'pipeline'`

### 4.2 Tab 模型

- `apps/electron/src/renderer/atoms/tab-atoms.ts`
- `TabType` 从 `'chat' | 'agent'` 改为 `'pipeline' | 'agent'`
- `tabStreamingMapAtom` 和 `tabIndicatorMapAtom` 新增 `pipeline` 映射逻辑

### 4.3 Pipeline Session 元数据

新增 `PipelineSessionMeta`，至少包含：

- `id`
- `title`
- `channelId`
- `workspaceId`
- `threadId`
- `currentNode`
- `status`
- `reviewIteration`
- `lastApprovedNode`
- `pendingGate`
- `pinned`
- `archived`
- `createdAt`
- `updatedAt`

设计原则：

- `pipeline session` 是工作流对象，不是线性聊天对象
- 节点状态、人工审核状态、迭代轮次必须是一级字段

## 5. LangGraph 编排与人工审核

### 5.1 主进程编排

LangGraph 只放在主进程，不进入 preload / renderer。

推荐主服务：

- `pipeline-service.ts`
- `pipeline-session-manager.ts`
- `pipeline-human-gate-service.ts`
- `pipeline-checkpointer.ts`
- `pipeline-graph.ts`
- `pipeline-node-runner.ts`

### 5.2 Graph 流程

首版固定流程：

1. `explorer`
2. `human_gate(explorer)`
3. `planner`
4. `human_gate(planner)`
5. `developer`
6. `reviewer`
7. `reviewer approved ?`
8. `yes -> human_gate(reviewer)`
9. `no -> developer`
10. `tester`
11. `human_gate(tester)`
12. `done`

### 5.3 节点执行

5 个节点统一走 `runClaudeAgent(role, input, context)` 适配层：

- explorer：最小可用外部探索 + 用户输入归并
- planner：输出开发 / 测试计划
- developer：执行开发
- reviewer：产出结构化 review 结论
- tester：执行验证并生成测试报告

### 5.4 人工审核

人工审核不走 SDK 自带 `AskUserQuestion`，而是走 pipeline 自己的 gate 服务：

- 节点完成后 LangGraph `interrupt`
- 主进程记录 pending gate
- 渲染进程展示通过 / 驳回 / 带反馈重跑
- 用户选择后通过 `resume` 恢复 graph

这样做的原因：

- gate 是 pipeline 的一等概念，不应混进普通工具调用
- 应用重启后可以恢复待审批状态
- 审批链路更容易持久化和回放

## 6. Shared 类型、IPC 与持久化

### 6.1 Shared 类型

新增 `packages/shared/src/types/pipeline.ts`，建议包含：

- `PipelineSessionMeta`
- `PipelineRecord`
- `PipelineNodeKind`
- `PipelineSessionStatus`
- `PipelineGateRequest`
- `PipelineGateResponse`
- `PipelineStartInput`
- `PipelineResumeInput`
- `PipelineStreamPayload`
- `PIPELINE_IPC_CHANNELS`

### 6.2 IPC 设计

首版至少需要：

- `pipeline:list-sessions`
- `pipeline:create-session`
- `pipeline:get-records`
- `pipeline:update-title`
- `pipeline:delete-session`
- `pipeline:toggle-pin`
- `pipeline:toggle-archive`
- `pipeline:start`
- `pipeline:resume`
- `pipeline:respond-gate`
- `pipeline:stop`
- `pipeline:get-pending-gates`
- `pipeline:get-session-state`
- `pipeline:stream:event`
- `pipeline:stream:complete`
- `pipeline:stream:error`

### 6.3 存储设计

继续使用本项目已有的本地文件策略：

- `~/.codeinsights/pipeline-sessions.json`
- `~/.codeinsights/pipeline-sessions/{sessionId}.jsonl`
- `~/.codeinsights/pipeline-checkpoints/{sessionId}/...`
- 可选：`~/.codeinsights/pipeline-artifacts/{sessionId}/...`

说明：

- 索引文件只存轻量元数据
- JSONL 存完整节点输出、人工审核、状态切换记录
- checkpoint 专门服务 LangGraph interrupt / resume
- 不引入本地数据库

## 7. 前端 PipelineView

### 7.1 接入方式

不新开旁路页面，直接接入现有：

- `AppShell`
- `MainArea`
- `TabContent`
- `LeftSidebar`
- `ModeSwitcher`

### 7.2 Pipeline 模式交互

- 左侧栏显示 `pipeline sessions`
- `ModeSwitcher` 显示 `Pipeline / Agent`
- `TabContent` 根据 `tab.type === 'pipeline'` 渲染 `PipelineView`
- `useCreateSession` / `useOpenSession` 增加 pipeline 分支

### 7.3 PipelineView 结构

建议组件：

- `PipelineView`
- `PipelineHeader`
- `PipelineStageRail`
- `PipelineRecords`
- `PipelineRecordItem`
- `HumanGateCard`
- `PipelineComposer`

表现形式：

- 左侧阶段轨：5 个固定节点 + 状态
- 右侧记录流：用户输入、节点输出、review 结果、人工审核记录
- developer / reviewer 多轮往返按轮次分组，而不是伪装成聊天气泡

### 7.4 人工审核 UX

等待审核时：

- 视图顶部与底部都展示 `HumanGateCard`
- 默认输入区切换成“反馈 + 审核动作”
- 动作至少包含：`通过`、`驳回并反馈`、`要求当前节点重跑`

## 8. 错误处理与恢复

### 8.1 错误分类

首版至少区分 4 类：

1. `node_failed`：节点执行失败
2. `human_rejected`：人工审核拒绝
3. `review_iteration_exhausted`：review 循环超限
4. `recovery_failed`：checkpoint 或持久化恢复失败

### 8.2 恢复策略

- 每个节点完成后写 checkpoint
- 每次进入 human gate 前写 checkpoint
- 每轮 developer / reviewer 切换前写 checkpoint
- 应用重启后根据 `status + currentNode + pendingGate + threadId` 恢复界面

### 8.3 停止语义

区分两种停止：

- `stop current run`：停止当前节点执行，可继续恢复
- `terminate pipeline`：终止整个流水线，只允许查看历史

## 9. 测试策略

首版以 BDD + TDD 为主，但遵循当前仓库现实：

### 9.1 自动化测试优先级

1. shared 状态与 reducer 单测
2. 主进程 session manager / checkpointer / human gate 单测
3. 主进程 graph 流转与 reviewer 回环单测
4. IPC / listener 集成测试

### 9.2 首版手工验收场景

至少覆盖：

1. 新建 pipeline 会话并启动 explorer
2. explorer 输出后等待人工审核
3. planner 输出后等待人工审核
4. developer -> reviewer 驳回 -> developer 修复 -> reviewer 通过
5. tester 输出后等待人工审核
6. 应用重启后恢复到待审批状态
7. 节点失败后可重试当前节点

## 10. 依赖与版本策略

本项目要求新增依赖先做版本调研。对 LangGraph 的处理策略如下：

- 实现前先查官方安装文档与 npm 包信息
- 由于 `@langchain/langgraph` 仍处于 `0.x` 版本线，首版采用“精确锁定版本”，不直接使用宽松 `^`
- 与其配套的 `@langchain/core` 同样采用调研后精确锁定

依赖落点：

- `apps/electron/package.json`

不做的事：

- 不把 LangGraph 标记为 esbuild external
- 不修改 `electron-builder.yml` 去单独复制 LangGraph 包

## 11. 受影响文件范围

预计核心改动：

- `packages/shared/src/types/*`
- `packages/shared/src/index.ts`
- `apps/electron/src/main/ipc.ts`
- `apps/electron/src/preload/index.ts`
- `apps/electron/src/main/lib/config-paths.ts`
- `apps/electron/src/main/lib/agent-orchestrator.ts` 或新建共享 adapter
- `apps/electron/src/renderer/atoms/*`
- `apps/electron/src/renderer/hooks/*`
- `apps/electron/src/renderer/components/app-shell/*`
- `apps/electron/src/renderer/components/tabs/*`
- `apps/electron/src/renderer/components/pipeline/*`

## 12. 延后事项

由于当前仓库要求功能变更后同步 `README.md` 和 `AGENTS.md`，但同时又要求修改前先获得用户许可，因此本轮只落设计与实施计划。等实现完成且获得许可后，再同步：

- `README.md`
- `README.en.md`
- `AGENTS.md`

