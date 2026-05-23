# CodeInsights Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Electron 主应用中引入以 LangGraph 编排的 `pipeline` 域，用 `explorer -> planner -> developer -> reviewer -> tester` 工作流平替 `chat` 主入口，并支持人工审核停顿、Developer/Reviewer 多轮迭代、本地持久化与恢复。

**Architecture:** 采用“独立 `pipeline` 域 + 复用现有 `agent` 底座能力”的方案。主进程新增 `pipeline-service / session-manager / graph / human-gate / checkpointer`，渲染进程新增 `pipeline-atoms / listeners / components`，并把 `AppMode` 与 `TabType` 从 `chat` 切换到 `pipeline`。

**Tech Stack:** Bun、TypeScript、Electron、React、Jotai、Claude Agent SDK、LangGraph、Zod、JSON/JSONL 本地存储。

---

### Task 1: 锁定依赖版本并建立 Pipeline 基础骨架

**Files:**
- Modify: `apps/electron/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/electron/src/main/lib/config-paths.ts`
- Create: `packages/shared/src/types/pipeline.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/utils/pipeline-state.ts`
- Create: `packages/shared/src/utils/pipeline-state.test.ts`

**Step 1: 调研并记录 LangGraph 安装版本**

Run: 打开官方安装文档与 npm 包页面，确认 `@langchain/langgraph` 与 `@langchain/core` 当前稳定版本，记录到实现说明或提交说明中。
Expected: 得到“精确锁定版本”结论，而不是直接复用旧文档中的版本号。

**Step 2: 写失败的 shared 状态测试**

```ts
import { describe, expect, test } from 'bun:test'
import { applyPipelineRecord, createInitialPipelineState } from './pipeline-state'

test('developer review rejected 后回到 developer 节点并增加轮次', () => {
  const state = createInitialPipelineState('session-1')
  const next = applyPipelineRecord(state, {
    type: 'review_result',
    sessionId: 'session-1',
    approved: false,
    createdAt: Date.now(),
  })

  expect(next.currentNode).toBe('developer')
  expect(next.reviewIteration).toBe(1)
})
```

**Step 3: 运行测试，确认失败原因正确**

Run: `bun test packages/shared/src/utils/pipeline-state.test.ts`
Expected: FAIL，提示 `applyPipelineRecord` / `createInitialPipelineState` 不存在。

**Step 4: 写最小实现与 shared 类型**

实现至少包含：

- `PipelineNodeKind = 'explorer' | 'planner' | 'developer' | 'reviewer' | 'tester'`
- `PipelineSessionStatus = 'idle' | 'running' | 'waiting_human' | 'node_failed' | 'completed' | 'terminated' | 'recovery_failed'`
- `PipelineRecord` 的基础结构
- `PIPELINE_IPC_CHANNELS` 初版常量
- `pipeline-state.ts` 中的最小状态推进逻辑
- `config-paths.ts` 中新增 pipeline 索引、JSONL、checkpoint 路径函数

**Step 5: 重新运行 shared 测试**

Run: `bun test packages/shared/src/utils/pipeline-state.test.ts`
Expected: PASS

**Step 6: 验证类型导出与版本变更**

Run: `bun run --filter='@codeinsights/shared' typecheck`
Expected: PASS

**Step 7: 提交**

```bash
git add packages/shared/package.json packages/shared/src/types/pipeline.ts packages/shared/src/types/index.ts packages/shared/src/index.ts packages/shared/src/utils/pipeline-state.ts packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/config-paths.ts apps/electron/package.json
git commit -m "feat: add pipeline shared foundation"
```

### Task 2: Pipeline Session Manager 与持久化

**Files:**
- Create: `apps/electron/src/main/lib/pipeline-session-manager.ts`
- Create: `apps/electron/src/main/lib/pipeline-session-manager.test.ts`
- Modify: `apps/electron/src/main/lib/config-paths.ts`

**Step 1: 写失败的 session manager 测试**

```ts
import { test, expect } from 'bun:test'
import { createPipelineSession, appendPipelineRecord, getPipelineRecords } from './pipeline-session-manager'

test('创建会话后可追加并读取 JSONL 记录', () => {
  const session = createPipelineSession('测试会话', 'channel-1', 'workspace-1')
  appendPipelineRecord(session.id, {
    type: 'user_input',
    sessionId: session.id,
    createdAt: Date.now(),
    content: '请帮我找一个 RISC-V 贡献点',
  })

  const records = getPipelineRecords(session.id)
  expect(records).toHaveLength(1)
  expect(records[0]?.type).toBe('user_input')
})
```

**Step 2: 运行测试，确认失败**

Run: `bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts`
Expected: FAIL，提示模块不存在。

**Step 3: 写最小实现**

实现至少包含：

- `listPipelineSessions()`
- `createPipelineSession()`
- `updatePipelineSessionMeta()`
- `deletePipelineSession()`
- `appendPipelineRecord()`
- `getPipelineRecords()`
- `searchPipelineRecords()` 可后置，但至少预留接口

存储模式严格对齐 `agent-session-manager.ts`：

- 索引：`pipeline-sessions.json`
- 详情：`pipeline-sessions/{id}.jsonl`

**Step 4: 重新运行测试**

Run: `bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts`
Expected: PASS

**Step 5: 补一个恢复索引顺序测试**

再加一个测试，断言 `updatedAt` 新的会话排在前面。

**Step 6: 提交**

```bash
git add apps/electron/src/main/lib/pipeline-session-manager.ts apps/electron/src/main/lib/pipeline-session-manager.test.ts apps/electron/src/main/lib/config-paths.ts
git commit -m "feat: add pipeline session persistence"
```

### Task 3: Human Gate 服务与恢复

**Files:**
- Create: `apps/electron/src/main/lib/pipeline-human-gate-service.ts`
- Create: `apps/electron/src/main/lib/pipeline-human-gate-service.test.ts`
- Modify: `packages/shared/src/types/pipeline.ts`

**Step 1: 写失败的 human gate 测试**

```ts
import { test, expect } from 'bun:test'
import { PipelineHumanGateService } from './pipeline-human-gate-service'

test('发起 gate 后可等待并接收 approve 响应', async () => {
  const service = new PipelineHumanGateService()
  const promise = service.waitForDecision('session-1', {
    gateId: 'gate-1',
    node: 'planner',
  })

  service.respond({
    gateId: 'gate-1',
    action: 'approve',
  })

  const result = await promise
  expect(result.action).toBe('approve')
})
```

**Step 2: 运行测试，确认失败**

Run: `bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts`
Expected: FAIL

**Step 3: 实现最小 gate 服务**

参考 `agent-ask-user-service.ts` 的 Promise + Map 模式，实现：

- `waitForDecision(sessionId, request)`
- `respond(response)`
- `getPendingRequests()`
- `clearSessionPending(sessionId)`

响应动作至少支持：

- `approve`
- `reject_with_feedback`
- `rerun_node`

**Step 4: 增加“应用中止时自动 deny”测试**

为 `AbortSignal` 场景补一个测试，断言未完成 gate 会被安全清理。

**Step 5: 重新运行测试**

Run: `bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts`
Expected: PASS

**Step 6: 提交**

```bash
git add apps/electron/src/main/lib/pipeline-human-gate-service.ts apps/electron/src/main/lib/pipeline-human-gate-service.test.ts packages/shared/src/types/pipeline.ts
git commit -m "feat: add pipeline human gate service"
```

### Task 4: Claude 节点执行适配层与 Graph 骨架

**Files:**
- Create: `apps/electron/src/main/lib/pipeline-node-runner.ts`
- Create: `apps/electron/src/main/lib/pipeline-graph.ts`
- Create: `apps/electron/src/main/lib/pipeline-graph.test.ts`
- Modify: `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`
- Modify: `apps/electron/src/main/lib/agent-orchestrator.ts`

**Step 1: 写失败的 graph 流转测试**

```ts
import { test, expect } from 'bun:test'
import { createPipelineGraph } from './pipeline-graph'

test('reviewer 拒绝后回到 developer，reviewIteration +1', async () => {
  const graph = createPipelineGraph({
    runNode: async (node) => {
      if (node === 'reviewer') return { approved: false, issues: ['缺少测试'] }
      return { ok: true }
    },
  })

  const result = await graph.invoke({
    sessionId: 's1',
    currentNode: 'developer',
    reviewIteration: 0,
  })

  expect(result.currentNode).toBe('developer')
  expect(result.reviewIteration).toBe(1)
})
```

**Step 2: 运行测试，确认失败**

Run: `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
Expected: FAIL

**Step 3: 实现 `runClaudeAgent()` 适配层**

目标：

- 统一 5 个节点的 Claude Agent SDK 调用
- 复用现有工作区路径、环境变量、模型选择、渠道解析逻辑
- 返回标准化节点结果，而不是直接返回原始 SDK 事件

建议最小接口：

```ts
export interface PipelineNodeRunner {
  run(input: {
    sessionId: string
    node: 'explorer' | 'planner' | 'developer' | 'reviewer' | 'tester'
    workspaceId?: string
    channelId: string
    modelId?: string
    userInput: string
    context: Record<string, unknown>
  }): Promise<Record<string, unknown>>
}
```

**Step 4: 实现 Graph 骨架**

要求：

- explorer / planner / developer / reviewer / tester 五节点
- reviewer 不通过时回 developer
- human gate 不在节点内部实现，保留 interrupt 钩子
- 最大 review 次数先做常量限制

**Step 5: 重新运行 graph 测试**

Run: `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
Expected: PASS

**Step 6: 提交**

```bash
git add apps/electron/src/main/lib/pipeline-node-runner.ts apps/electron/src/main/lib/pipeline-graph.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/adapters/claude-agent-adapter.ts apps/electron/src/main/lib/agent-orchestrator.ts
git commit -m "feat: add pipeline graph and claude node runner"
```

### Task 5: Checkpoint 与 Pipeline Service

**Files:**
- Create: `apps/electron/src/main/lib/pipeline-checkpointer.ts`
- Create: `apps/electron/src/main/lib/pipeline-service.ts`
- Create: `apps/electron/src/main/lib/pipeline-service.test.ts`
- Modify: `apps/electron/src/main/lib/config-paths.ts`

**Step 1: 写失败的 service 测试**

```ts
import { test, expect } from 'bun:test'
import { createPipelineService } from './pipeline-service'

test('planner 完成后进入 waiting_human 并产生 pending gate', async () => {
  const service = createPipelineService(/* fake deps */)

  await service.start({
    sessionId: 's1',
    userInput: '请探索一个 RISC-V 贡献点',
    channelId: 'c1',
  })

  const snapshot = service.getSessionState('s1')
  expect(snapshot.status).toBe('waiting_human')
  expect(snapshot.currentNode).toBe('planner')
})
```

**Step 2: 运行测试，确认失败**

Run: `bun test apps/electron/src/main/lib/pipeline-service.test.ts`
Expected: FAIL

**Step 3: 实现 checkpointer**

至少支持：

- `saveCheckpoint(sessionId, snapshot)`
- `loadCheckpoint(sessionId)`
- `deleteCheckpoint(sessionId)`

**Step 4: 实现 pipeline service**

至少支持：

- `start(input)`
- `resume(input)`
- `respondHumanGate(response)`
- `stop(sessionId)`
- `getSessionState(sessionId)`
- `getPendingGates()`

同时负责：

- 向 renderer 推送 `pipeline:stream:event`
- 写 `PipelineRecord`
- 更新 `PipelineSessionMeta`
- 在节点边界写 checkpoint

**Step 5: 补“应用重启后恢复 gate”测试**

模拟：

- 先保存 waiting_human 状态
- 再重新构建 service
- 断言能恢复 pending gate

**Step 6: 重新运行测试**

Run: `bun test apps/electron/src/main/lib/pipeline-service.test.ts`
Expected: PASS

**Step 7: 提交**

```bash
git add apps/electron/src/main/lib/pipeline-checkpointer.ts apps/electron/src/main/lib/pipeline-service.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/config-paths.ts
git commit -m "feat: add pipeline service and checkpoint recovery"
```

### Task 6: IPC 与 Preload 接入

**Files:**
- Modify: `apps/electron/src/main/ipc.ts`
- Modify: `apps/electron/src/preload/index.ts`
- Modify: `packages/shared/src/types/pipeline.ts`

**Step 1: 写失败的 preload/import 验证测试或最小 smoke 脚本**

如果仓库当前没有 preload 自动化测试框架，至少新增一个小型 smoke 验证脚本，断言 `PIPELINE_IPC_CHANNELS` 与 `window.electronAPI` 暴露接口完整。

**Step 2: 先接最小 IPC handler**

首批 handler：

- `LIST_SESSIONS`
- `CREATE_SESSION`
- `GET_RECORDS`
- `START`
- `RESPOND_GATE`
- `RESUME`
- `STOP`
- `GET_PENDING_GATES`
- `GET_SESSION_STATE`

**Step 3: 在 preload 暴露 `pipeline` API**

建议接口：

- `listPipelineSessions()`
- `createPipelineSession()`
- `getPipelineRecords()`
- `startPipeline()`
- `respondPipelineGate()`
- `resumePipeline()`
- `stopPipeline()`
- `getPendingPipelineGates()`
- `getPipelineSessionState()`
- `onPipelineStreamEvent()`
- `onPipelineStreamComplete()`
- `onPipelineStreamError()`

**Step 4: 运行类型检查**

Run: `bun run --filter='@codeinsights/electron' typecheck`
Expected: PASS

**Step 5: 提交**

```bash
git add apps/electron/src/main/ipc.ts apps/electron/src/preload/index.ts packages/shared/src/types/pipeline.ts
git commit -m "feat: wire pipeline ipc and preload api"
```

### Task 7: Renderer 状态层与全局监听

**Files:**
- Create: `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- Modify: `apps/electron/src/renderer/atoms/index.ts`
- Create: `apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts`
- Modify: `apps/electron/src/renderer/main.tsx`

**Step 1: 写失败的状态迁移测试**

如果不引入新测试框架，至少给纯函数 reducer 写 Bun 测试，例如：

```ts
import { test, expect } from 'bun:test'
import { applyPipelineStreamEvent, createInitialPipelineStreamState } from './pipeline-atoms'

test('收到 waiting_human 事件后更新 pending gate', () => {
  const state = createInitialPipelineStreamState()
  const next = applyPipelineStreamEvent(state, {
    kind: 'waiting_human',
    gate: { gateId: 'g1', node: 'planner' },
  })

  expect(next.pendingGate?.gateId).toBe('g1')
})
```

**Step 2: 运行测试，确认失败**

Run: `bun test apps/electron/src/renderer/atoms/pipeline-atoms.test.ts`
Expected: FAIL

**Step 3: 实现 atoms**

至少包含：

- `pipelineSessionsAtom`
- `currentPipelineSessionIdAtom`
- `pipelineStreamingStatesAtom`
- `pipelinePendingGateMapAtom`
- `pipelineRecordRefreshAtom`
- `pipelineSessionChannelMapAtom`
- `pipelineSessionWorkspaceMapAtom`

**Step 4: 实现全局 listener**

模式直接参考 `useGlobalAgentListeners.ts`：

- 顶层挂载
- 永不销毁
- 收到事件后写入 Jotai Map

**Step 5: 在 `renderer/main.tsx` 挂载 initializer**

要求：

- 启动时加载 pipeline sessions
- 恢复 pending gates
- 注册 `useGlobalPipelineListeners`

**Step 6: 重新运行测试 / 类型检查**

Run: `bun test apps/electron/src/renderer/atoms/pipeline-atoms.test.ts && bun run --filter='@codeinsights/electron' typecheck`
Expected: PASS

**Step 7: 提交**

```bash
git add apps/electron/src/renderer/atoms/pipeline-atoms.ts apps/electron/src/renderer/atoms/index.ts apps/electron/src/renderer/hooks/useGlobalPipelineListeners.ts apps/electron/src/renderer/main.tsx apps/electron/src/renderer/atoms/pipeline-atoms.test.ts
git commit -m "feat: add pipeline renderer state and listeners"
```

### Task 8: 模式、Tab 与会话入口切换

**Files:**
- Modify: `apps/electron/src/renderer/atoms/app-mode.ts`
- Modify: `apps/electron/src/renderer/atoms/tab-atoms.ts`
- Modify: `apps/electron/src/renderer/hooks/useCreateSession.ts`
- Modify: `apps/electron/src/renderer/hooks/useOpenSession.ts`
- Modify: `apps/electron/src/renderer/hooks/useSyncActiveTabSideEffects.ts`
- Modify: `apps/electron/src/renderer/components/app-shell/ModeSwitcher.tsx`
- Modify: `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- Modify: `apps/electron/src/renderer/components/tabs/TabContent.tsx`
- Modify: `apps/electron/src/renderer/components/welcome/WelcomeView.tsx`
- Modify: `apps/electron/src/renderer/components/shortcuts/GlobalShortcuts.tsx`

**Step 1: 写失败的最小行为测试或验收清单**

如果当前没有稳定的 React UI 测试基础设施，则先写验收 checklist，并至少对纯函数 `openTab / closeTab / indicator` 补测试，验证 `pipeline` 类型进入后不会破坏现有 tab 行为。

**Step 2: 修改 `AppMode` 与 `TabType`**

要求：

- `AppMode = 'pipeline' | 'agent'`
- `TabType = 'pipeline' | 'agent'`
- 保留隐藏 `chat` 回退开关，不走用户主路径

**Step 3: 打通创建 / 打开 pipeline 会话**

要求：

- `useCreateSession` 新增 `createPipeline()`
- `useOpenSession` 支持 `pipeline`
- `LeftSidebar` 在 pipeline 模式展示 pipeline sessions

**Step 4: 更新 ModeSwitcher / WelcomeView / Shortcuts**

目标：

- 所有“创建新对话”的入口改为创建 pipeline session
- 欢迎页文案与按钮切到 pipeline
- 快捷键切换逻辑从 `chat <-> agent` 改为 `pipeline <-> agent`

**Step 5: 运行类型检查**

Run: `bun run --filter='@codeinsights/electron' typecheck`
Expected: PASS

**Step 6: 提交**

```bash
git add apps/electron/src/renderer/atoms/app-mode.ts apps/electron/src/renderer/atoms/tab-atoms.ts apps/electron/src/renderer/hooks/useCreateSession.ts apps/electron/src/renderer/hooks/useOpenSession.ts apps/electron/src/renderer/hooks/useSyncActiveTabSideEffects.ts apps/electron/src/renderer/components/app-shell/ModeSwitcher.tsx apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx apps/electron/src/renderer/components/tabs/TabContent.tsx apps/electron/src/renderer/components/welcome/WelcomeView.tsx apps/electron/src/renderer/components/shortcuts/GlobalShortcuts.tsx
git commit -m "feat: switch main mode from chat to pipeline"
```

### Task 9: Pipeline UI 组件

**Files:**
- Create: `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/PipelineHeader.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/PipelineStageRail.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/PipelineRecordItem.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/HumanGateCard.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/PipelineComposer.tsx`
- Create: `apps/electron/src/renderer/components/pipeline/index.ts`
- Modify: `apps/electron/src/renderer/components/tabs/TabContent.tsx`

**Step 1: 先写最小交互验收用例**

记录首版 UI 必须满足：

1. 能看到 5 节点阶段轨
2. 能看到当前节点输出
3. 待审核时能看到 `HumanGateCard`
4. Developer/Reviewer 往返能按轮次分组

**Step 2: 先实现只读视图**

最小结构：

- header
- stage rail
- records list

此时按钮可先只渲染，不连后端。

**Step 3: 接入 gate 响应动作**

`HumanGateCard` 动作：

- approve
- reject with feedback
- rerun node

**Step 4: 接入启动与继续执行入口**

- `PipelineComposer` 用于首次输入
- 若 session 已处于 `waiting_human`，输入区变为反馈输入区

**Step 5: 手工验证**

Run:

```bash
bun run electron:build
bun run electron:start
```

Expected:

- 主界面默认进入 Pipeline 模式
- 新建会话后可看到空态 PipelineView
- 启动后节点流式输出可展示
- gate 卡片可以操作

**Step 6: 提交**

```bash
git add apps/electron/src/renderer/components/pipeline apps/electron/src/renderer/components/tabs/TabContent.tsx
git commit -m "feat: add pipeline workflow UI"
```

### Task 10: 集成回归、验证与文档收尾

**Files:**
- Modify: `tasks/todo.md`
- Optional with permission: `README.md`
- Optional with permission: `README.en.md`
- Optional with permission: `AGENTS.md`

**Step 1: 跑核心自动化验证**

Run:

```bash
bun test packages/shared/src/utils/pipeline-state.test.ts
bun test apps/electron/src/main/lib/pipeline-session-manager.test.ts
bun test apps/electron/src/main/lib/pipeline-human-gate-service.test.ts
bun test apps/electron/src/main/lib/pipeline-graph.test.ts
bun test apps/electron/src/main/lib/pipeline-service.test.ts
bun run --filter='@codeinsights/shared' typecheck
bun run --filter='@codeinsights/electron' typecheck
```

Expected: 全部 PASS

**Step 2: 跑 Electron 手工验收**

场景：

1. explorer -> approve
2. planner -> approve
3. developer -> reviewer reject -> developer
4. reviewer approve -> tester
5. tester -> approve
6. 应用重启后恢复 waiting_human 状态

**Step 3: 检查版本号**

要求至少递增：

- `packages/shared/package.json`
- `apps/electron/package.json`

**Step 4: 更新任务记录**

在 `tasks/todo.md` 中记录：

- 自动化测试结果
- 手工验收结果
- 未完成项与风险

**Step 5: 文档同步前等待授权**

如果用户授权，再更新：

- `README.md`
- `README.en.md`
- `AGENTS.md`

否则仅在交付说明中明确“文档同步待授权”。

**Step 6: 提交**

```bash
git add tasks/todo.md packages/shared/package.json apps/electron/package.json
git commit -m "feat: ship rv pipeline mvp"
```
