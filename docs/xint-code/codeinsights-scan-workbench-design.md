# CodeInsights 漏洞扫描工作台页面集成设计

> 文档日期：2026-05-05
> 目标：在 CodeInsights 中实现类似截图所示的“软件/版本 → 左侧漏洞列表 → 右侧漏洞详情”工作台页面，并给出贴合当前代码结构的前后端集成方案。
> 范围：本地优先、Electron 桌面端、现有 `Jotai + IPC + JSON/JSONL` 架构内演进，不引入本地数据库。

---

## 执行摘要

从当前 CodeInsights 的架构看，这个功能**不应该**被实现成：

- 一个挂在 Chat/Agent 消息里的巨型卡片
- 一个独立的 React Router 页面系统
- 一个单纯显示“长文本报告”的只读页

更合适的方案是：

> 新增一个独立的 **Scan Domain（扫描域）**，并在现有多标签体系中新增 `scan` tab 类型。
> 该 tab 自身是一个“两栏工作台”：左侧漏洞导航列表，右侧漏洞详情面板。
> 数据层采用“项目索引 + 扫描运行索引 + 摘要文件 + 详情文件”的本地文件模型，走与现有 Chat/Agent 一致的 `shared types -> main ipc -> preload -> renderer atoms/components` 四层接入方式。

这是我推荐的原因：

1. **最贴合现有架构**
   - 当前主内容区就是 `TabBar + TabContent`，没有完整前端路由系统。
   - 本地持久化已是 JSON/JSONL 模式，新增扫描域自然延续即可。

2. **最小侵入**
   - V1 不必立刻引入新的 `appMode='scan'`，可以先只新增 `scan` tab。
   - 全局左侧边栏保持现有 Chat/Agent 结构，扫描页自己的左栏放在 tab 内容内部。

3. **可持续扩展**
   - 后续要加筛选、排序、状态流转、评论、导出、回链到源码、回链到 Agent 执行轨迹，都有明确数据承载点。

4. **能支撑截图里的交互密度**
   - 左侧是轻量摘要列表
   - 右侧是完整报告
   - 顶部可以有 breadcrumb、过滤、排序、状态 chip、版本切换

如果只想先做一个可交付的 V1，我建议目标收敛为：

- 支持从“软件/项目名称”打开扫描工作台 tab
- 左侧显示漏洞摘要列表
- 右侧显示完整漏洞详情
- 支持基础筛选/排序
- 支持点击源码路径跳转文件预览
- 数据从本地扫描结果文件或导入结果读取

---

## 一、目标体验复述

用户提供的目标页，本质上是一个 **漏洞 triage 工作台**，核心交互为：

1. 用户先在某处看到“软件名称/项目名称/版本名”
2. 点击后打开一个对应的软件扫描结果页
3. 页面左侧是该次扫描探测出的潜在问题点列表
4. 点击任一问题项，右侧展示该问题的完整分析报告
5. 报告包括：
   - 标题
   - 严重级别
   - 标签 / CWE / 状态
   - 文件 / 函数 / 行号
   - Summary
   - Conditions
   - Impact
   - 可能的 Remediation

换成 CodeInsights 语境，这个页面不是“会话页”，而是一个新的 **分析结果工作页**。

---

## 二、现有 CodeInsights 架构约束

在提出方案前，必须先尊重当前系统的真实形态。

### 2.1 当前主内容区不是 Router，而是 Tab 容器

当前主界面结构是：

```text
LeftSidebar | MainArea(TabBar + TabContent) | RightSidePanel
```

关键事实：

- [`AppShell.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/app-shell/AppShell.tsx) 负责三栏骨架
- [`MainArea.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/MainArea.tsx) 负责标签页区域
- [`TabContent.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabContent.tsx) 目前只认识 `chat` / `agent`

因此“跳转到页面”在 CodeInsights 内部的正确翻译不是“切换路由”，而是：

> 打开或聚焦一个新的 tab，并渲染一种新的内容视图。

### 2.2 现有全局模式只有 `chat` 和 `agent`

当前 [`app-mode.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/atoms/app-mode.ts) 中：

```ts
export type AppMode = 'chat' | 'agent'
```

左侧边栏逻辑、右侧文件面板、Tab 切换副作用，很多都写死围绕这两个模式。

这意味着：

- 如果直接引入全局 `scan` 模式，改动面会比较大
- 如果只想先完成截图页功能，**先新增 `scan` tab，而不是立刻新增 `scan` appMode**，会更稳妥

### 2.3 当前持久化是本地 JSON / JSONL

现有系统的典型模式：

- Chat：
  - 索引 `conversations.json`
  - 消息 `conversations/{id}.jsonl`
- Agent：
  - 索引 `agent-sessions.json`
  - 消息 `agent-sessions/{id}.jsonl`

路径工具集中在 [`config-paths.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/config-paths.ts)
CRUD 逻辑集中在：

- [`conversation-manager.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/conversation-manager.ts)
- [`agent-session-manager.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/agent-session-manager.ts)

所以扫描功能最自然的落点，也是：

- 一个轻量索引文件
- 若干按 run/finding 拆分的本地文件

### 2.4 IPC 是四层同步模型

新功能必须穿过这四层：

1. `packages/shared/src/types/*`
2. `apps/electron/src/main/ipc.ts`
3. `apps/electron/src/preload/index.ts`
4. `apps/electron/src/renderer/atoms + components`

如果不按这条链走，最终代码风格会和当前项目明显割裂。

---

## 三、推荐方案：独立 Scan Domain + Scan Tab

## 3.1 为什么不直接塞进 AgentView

不推荐把该页面直接做进 [`AgentView.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/agent/AgentView.tsx)，原因有四个：

1. `AgentView` 的核心是对话流
   - 消息列表
   - 输入框
   - 工具活动
   - 权限请求
   - AskUser / ExitPlan

2. 漏洞工作台的核心是“结果浏览与 triage”
   - 列表筛选
   - 报告阅读
   - 状态更新
   - 来源跳转

3. 两者生命周期不同
   - AgentView 是“执行中”
   - ScanWorkbench 是“执行后”

4. 后续权限、导出、评论、状态机都属于新的领域模型

结论：

> Agent 负责“产出扫描结果”，ScanWorkbench 负责“消费扫描结果”。

## 3.2 为什么不直接上 React Router

当前应用明显不是基于 URL 路由组织主内容区。
如果为了这一个页面引入完整 router，会带来：

- Tab 与 route 双重状态源
- settings 中 tabState 恢复逻辑重写
- 新的导航范式
- 更高的维护成本

所以更好的做法是：

> 继续沿用现有 tab 体系，把扫描页做成一种新的 tab 内容类型。

## 3.3 推荐的 V1 集成策略

### 核心思路

- 新增一个 `scan` tab 类型
- tab 内容组件为 `ScanWorkbenchView`
- `ScanWorkbenchView` 内部自己做左右分栏
- 全局左侧边栏暂不变成扫描项目列表
- 软件名称点击入口来自：
  - 新增“扫描项目列表”页面/卡片
  - Agent 完成后提示卡片
  - 全局搜索结果
  - Welcome / 工作区入口

### V1 的好处

- 不需要先发明完整“扫描模式”
- 不破坏现有 chat/agent 行为
- 可以先完成最关键的目标页能力

### V2 可扩展方向

当扫描结果域成熟后，再考虑：

- 新增 `appMode='scan'`
- 左侧边栏切到“软件/项目/扫描运行列表”
- 全局搜索统一覆盖 chat / agent / scan

---

## 四、领域模型设计

这里是整个功能成败的核心。

## 4.1 顶层实体划分

建议新增四类核心实体：

1. `ScanProjectMeta`
   - 对应“软件名称/项目名称”

2. `ScanRunMeta`
   - 对应某个版本、某次扫描执行结果

3. `ScanFindingSummary`
   - 左侧列表所需的轻量字段

4. `ScanFindingDetail`
   - 右侧详情所需的完整字段

## 4.2 推荐类型定义

建议新增文件：

`packages/shared/src/types/scan.ts`

参考结构：

```ts
export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type ScanFindingStatus =
  | 'new'
  | 'in_review'
  | 'confirmed'
  | 'remediated'
  | 'risk_accepted'
  | 'suppressed'

export interface ScanProjectMeta {
  id: string
  name: string
  slug: string
  description?: string
  workspaceId?: string
  sourceType: 'agent' | 'imported' | 'external'
  latestRunId?: string
  createdAt: number
  updatedAt: number
}

export interface ScanRunMeta {
  id: string
  projectId: string
  title: string
  versionLabel?: string
  sourceSessionId?: string
  workspaceId?: string
  status: 'processing' | 'completed' | 'failed'
  findingCount: number
  severityCounts: Record<ScanSeverity, number>
  createdAt: number
  updatedAt: number
}

export interface ScanFindingSummary {
  id: string
  runId: string
  ordinal: number
  title: string
  severity: ScanSeverity
  status: ScanFindingStatus
  file?: string
  functionName?: string
  lineStart?: number
  tags: string[]
  cweIds: number[]
  read?: boolean
}

export interface ScanFindingLocation {
  file: string
  functionName?: string
  lineStart?: number
  lineEnd?: number
  basePathType?: 'workspace' | 'session' | 'absolute'
}

export interface ScanFindingComment {
  id: string
  author: string
  body: string
  createdAt: number
}

export interface ScanFindingTraceRef {
  sessionId?: string
  sdkMessageUuid?: string
  toolUseId?: string
  workspaceRelativePath?: string
}

export interface ScanFindingDetail extends ScanFindingSummary {
  summaryMarkdown: string
  conditionsMarkdown: string
  impactMarkdown: string
  remediationMarkdown?: string
  cvssScore?: number
  cvssVector?: string
  locations: ScanFindingLocation[]
  comments: ScanFindingComment[]
  traceRefs?: ScanFindingTraceRef[]
  raw?: unknown
}

export interface ScanRunSummary {
  meta: ScanRunMeta
  findings: ScanFindingSummary[]
}

export interface ImportScanRunInput {
  projectId?: string
  projectName: string
  runTitle: string
  versionLabel?: string
  workspaceId?: string
  sourceSessionId?: string
  payload: unknown
}

export interface UpdateScanFindingStatusInput {
  runId: string
  findingId: string
  status: ScanFindingStatus
}

export interface AddScanFindingCommentInput {
  runId: string
  findingId: string
  body: string
  author: string
}

export interface ScanFindingFilterState {
  severity: ScanSeverity[]
  status: ScanFindingStatus[]
  query: string
}

export type ScanFindingSort =
  | 'severity-desc'
  | 'severity-asc'
  | 'ordinal-asc'
  | 'ordinal-desc'
```

## 4.3 为什么要拆 Summary 和 Detail

截图页面天然就是这种数据分层：

- 左栏只需要标题、编号、文件名、严重级别、状态
- 右栏才需要完整大段 Markdown 报告

如果不拆：

- 打开页面就要一次性加载所有完整详情
- 每条 finding 都会携带大量长文本
- 筛选与排序变慢

所以建议：

> 左栏走 summary，右栏点选后再读 detail。

---

## 五、本地存储设计

## 5.1 推荐目录结构

在 `~/.codeinsights/` 下新增：

```text
~/.codeinsights/
├── scan-projects.json
├── scan-runs.json
└── scan-runs/
    └── {run-id}/
        ├── summary.json
        └── findings/
            ├── {finding-id}.json
            ├── {finding-id}.json
            └── ...
```

## 5.2 每个文件承载什么

### `scan-projects.json`

轻量项目索引：

- 项目名
- slug
- workspace 关联
- latestRunId

### `scan-runs.json`

轻量扫描运行索引：

- run 与 project 的关系
- createdAt / updatedAt
- findingCount
- severityCounts
- sourceSessionId

### `scan-runs/{runId}/summary.json`

一次运行的页面首屏数据：

- breadcrumb 所需元数据
- 顶部总数/状态/版本信息
- 左栏 finding summaries

### `scan-runs/{runId}/findings/{findingId}.json`

单条完整详情：

- Summary
- Conditions
- Impact
- Remediation
- CVSS / CWE
- 代码位置
- 评论和状态
- trace refs

## 5.3 为什么不用单个大 JSON

单个大 JSON 当然最简单，但有三个现实问题：

1. 左侧列表会加载不必要的大段文本
2. 点开单条 finding 时无法懒加载
3. 后续 status/comment 更新会反复重写大文件

所以我建议的拆分是：

- **项目/运行层面走 index**
- **列表首屏走 summary**
- **明细走 per-finding detail**

这已经足够轻量，但比“一坨 report.json”更耐用。

## 5.4 `config-paths.ts` 需要新增的函数

建议在 [`config-paths.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/config-paths.ts) 中增加：

```ts
getScanProjectsIndexPath(): string
getScanRunsIndexPath(): string
getScanRunsDir(): string
getScanRunDir(runId: string): string
getScanRunSummaryPath(runId: string): string
getScanFindingDetailsDir(runId: string): string
getScanFindingDetailPath(runId: string, findingId: string): string
```

风格完全复用现有 `getConversations*` / `getAgentSessions*` 模式。

---

## 六、主进程服务设计

## 6.1 推荐新增的服务文件

建议新增：

```text
apps/electron/src/main/lib/
├── scan-project-manager.ts
├── scan-run-manager.ts
├── scan-import-normalizer.ts
└── scan-link-service.ts
```

### `scan-project-manager.ts`

职责：

- 读写 `scan-projects.json`
- 项目 CRUD
- 按 workspaceId 查项目
- 更新 `latestRunId`

### `scan-run-manager.ts`

职责：

- 读写 `scan-runs.json`
- 读写 `summary.json`
- 读写 finding detail
- 更新 finding 状态/评论
- 列出某个 project 的 runs

### `scan-import-normalizer.ts`

职责：

- 把外部扫描结果映射为 CodeInsights 内部 canonical model
- 尤其适合把 Xint 风格结果导入为本地工作台格式

### `scan-link-service.ts`

职责：

- 处理 finding 与 workspace/session/source file 的关联
- 生成 `previewFile` 需要的 basePath/basePaths
- 处理“打开原始 Agent 会话”跳转信息

## 6.2 推荐的导入 / 保存路径

如果扫描结果来源于 Agent 或外部服务，主进程最好不要直接吃“UI 结构”，而是先标准化：

```text
外部结果 / Agent 结果
  -> normalizeToScanRunBundle()
  -> saveScanProjectIfNeeded()
  -> saveScanRunMeta()
  -> saveRunSummary()
  -> saveFindingDetails()
```

这样前端永远面对统一的本地格式。

## 6.3 与现有 Agent 的关系

建议 `ScanRunMeta` 保留：

- `sourceSessionId`
- `workspaceId`

这样有两个重要收益：

1. 可以从漏洞页回到原始 Agent 会话
2. 可以为相对路径提供正确的 basePath 解析

---

## 七、IPC 与 Preload 设计

## 7.1 shared types 层

在 `packages/shared/src/types/scan.ts` 定义：

```ts
export const SCAN_IPC_CHANNELS = {
  LIST_PROJECTS: 'scan:list-projects',
  GET_PROJECT: 'scan:get-project',
  LIST_RUNS: 'scan:list-runs',
  GET_RUN_SUMMARY: 'scan:get-run-summary',
  GET_FINDING_DETAIL: 'scan:get-finding-detail',
  IMPORT_RUN: 'scan:import-run',
  UPDATE_FINDING_STATUS: 'scan:update-finding-status',
  ADD_FINDING_COMMENT: 'scan:add-finding-comment',
} as const
```

并在 [`packages/shared/src/types/index.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/packages/shared/src/types/index.ts) 导出。

## 7.2 main/ipc.ts 层

在 [`main/ipc.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/ipc.ts) 按当前风格注册：

```ts
ipcMain.handle(SCAN_IPC_CHANNELS.LIST_PROJECTS, ...)
ipcMain.handle(SCAN_IPC_CHANNELS.LIST_RUNS, ...)
ipcMain.handle(SCAN_IPC_CHANNELS.GET_RUN_SUMMARY, ...)
ipcMain.handle(SCAN_IPC_CHANNELS.GET_FINDING_DETAIL, ...)
ipcMain.handle(SCAN_IPC_CHANNELS.UPDATE_FINDING_STATUS, ...)
ipcMain.handle(SCAN_IPC_CHANNELS.ADD_FINDING_COMMENT, ...)
```

如果后续扫描是异步运行的，再加：

```ts
SCAN_IPC_CHANNELS.RUN_PROGRESS
SCAN_IPC_CHANNELS.RUN_COMPLETED
SCAN_IPC_CHANNELS.RUN_FAILED
```

V1 只做静态结果页时，不强制需要流式事件。

## 7.3 preload/index.ts 层

在 [`preload/index.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/preload/index.ts) 新增：

```ts
listScanProjects(): Promise<ScanProjectMeta[]>
getScanProject(projectId: string): Promise<ScanProjectMeta | null>
listProjectScanRuns(projectId: string): Promise<ScanRunMeta[]>
getScanRunSummary(runId: string): Promise<ScanRunSummary>
getScanFindingDetail(runId: string, findingId: string): Promise<ScanFindingDetail>
importScanRun(input: ImportScanRunInput): Promise<ScanRunMeta>
updateScanFindingStatus(input: UpdateScanFindingStatusInput): Promise<ScanFindingDetail>
addScanFindingComment(input: AddScanFindingCommentInput): Promise<ScanFindingComment>
```

这条链必须完整，否则渲染层会很快失控成“直接 IPC 字符串调用”。

---

## 八、Tab 与导航集成设计

## 8.1 关键结论：新增 `scan` tab 类型

当前 [`tab-atoms.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/atoms/tab-atoms.ts) 中：

```ts
export type TabType = 'chat' | 'agent'
```

建议改成：

```ts
export type TabType = 'chat' | 'agent' | 'scan'
```

但要注意，**不能简单复用现有 `sessionId` 字段**，否则语义会越来越乱。

## 8.2 推荐的 TabItem 结构

建议改成判别联合：

```ts
interface BaseTabItem {
  id: string
  type: TabType
  title: string
}

interface ChatTabItem extends BaseTabItem {
  type: 'chat'
  sessionId: string
}

interface AgentTabItem extends BaseTabItem {
  type: 'agent'
  sessionId: string
}

interface ScanTabItem extends BaseTabItem {
  type: 'scan'
  projectId: string
  runId: string
}

export type TabItem = ChatTabItem | AgentTabItem | ScanTabItem
```

为什么推荐这样做：

- 不继续让 `sessionId` 承担泛化资源 ID 的职责
- `scan` 可以天然同时带 `projectId + runId`
- breadcrumb、切换版本、恢复 tab 都更容易

## 8.3 `openScanTab` 的职责

建议新增：

`apps/electron/src/renderer/hooks/useOpenScanTab.ts`

职责：

- 如果同一个 `runId` 已打开，则聚焦
- 否则创建新 `scan` tab
- 不必强制改动 `appMode`
- 关闭时不需要像 agent 一样处理运行中的 stop 逻辑

## 8.4 `TabContent.tsx` 的扩展

当前 [`TabContent.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabContent.tsx) 只分 `chat` / `agent`。

新增一支：

```tsx
if (tab.type === 'scan') {
  return (
    <TabErrorBoundary key={tab.runId} sessionId={tab.id}>
      <ScanWorkbenchView projectId={tab.projectId} runId={tab.runId} />
    </TabErrorBoundary>
  )
}
```

## 8.5 Tab 持久化恢复

这是最容易漏的地方。

当前 [`main.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/main.tsx) 启动时恢复 tab，只会校验：

- conversations
- agent sessions

新增 `scan` 后，需要：

1. 启动时额外读取 `listProjectScanRuns()` 或 `listAllScanRuns()`
2. 校验 `runId` 是否存在
3. 扩展 [`settings.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/types/settings.ts) 里的 `PersistedTabSettings`

即：

```ts
type PersistedTabSettings['tabs'][number] =
  | { type: 'chat'; ... }
  | { type: 'agent'; ... }
  | { type: 'scan'; id: string; title: string; projectId: string; runId: string }
```

## 8.6 哪些文件一定要补 `scan` 分支

至少包括：

- [`tab-atoms.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/atoms/tab-atoms.ts)
- [`TabContent.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabContent.tsx)
- [`TabBar.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabBar.tsx)
- [`TabBarItem.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabBarItem.tsx)
- [`TabSwitcher.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabSwitcher.tsx)
- [`useCloseTab.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/hooks/useCloseTab.tsx)
- [`main.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/main.tsx)
- [`settings.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/types/settings.ts)

否则会出现：

- 关闭 tab 崩分支
- 重启恢复丢 tab
- 快捷切换器不识别
- tab 图标错误

---

## 九、前端状态管理设计

## 9.1 新增 `scan-atoms.ts`

建议新增：

`apps/electron/src/renderer/atoms/scan-atoms.ts`

## 9.2 推荐 atom 结构

```ts
export const scanProjectsAtom = atom<ScanProjectMeta[]>([])
export const scanRunsAtom = atom<Map<string, ScanRunMeta[]>>(new Map()) // projectId -> runs
export const scanRunSummaryAtom = atom<Map<string, ScanRunSummary>>(new Map()) // runId -> summary
export const scanFindingDetailAtom = atom<Map<string, Map<string, ScanFindingDetail>>>(new Map())

export const selectedFindingIdAtomFamily = atomFamily((runId: string) => atom<string | null>(null))
export const findingFilterAtomFamily = atomFamily((runId: string) => atom<ScanFindingFilterState>(DEFAULT_FILTER))
export const findingSortAtomFamily = atomFamily((runId: string) => atom<ScanFindingSort>('severity-desc'))
```

## 9.3 为什么用 atomFamily

一个用户可能同时打开多个扫描 tab。

如果只用单一全局：

- A tab 切换筛选会污染 B tab
- 不同 run 的选中 finding 会互相覆盖

`atomFamily(runId)` 可以天然做到：

- 每个 run 一套独立 UI 状态
- 切换 tab 不丢选择
- 逻辑和 `ChatView(conversationId)` / `AgentView(sessionId)` 一致

## 9.4 哪些状态放本地 state，哪些放 atom

### 建议放 atom 的

- 项目/运行缓存
- 选中的 findingId
- 筛选条件
- 排序方式
- comment/status 更新后的结果缓存

### 建议放组件本地 state 的

- hover 状态
- 菜单开关
- loading skeleton 局部态
- 面板拖拽宽度（如果只在当前 tab 内使用）

原则很简单：

> 会跨组件、跨 tab、跨刷新保留的状态进 atom；
> 纯 UI 瞬时交互留在本地 state。

---

## 十、页面组件设计

## 10.1 推荐目录

```text
apps/electron/src/renderer/components/scan/
├── ScanWorkbenchView.tsx
├── ScanHeader.tsx
├── ScanRunSwitcher.tsx
├── FindingListPane.tsx
├── FindingListToolbar.tsx
├── FindingListItem.tsx
├── FindingDetailPane.tsx
├── FindingMetaChips.tsx
├── FindingReportSections.tsx
├── FindingCommentTimeline.tsx
├── FindingEmptyState.tsx
└── index.ts
```

## 10.2 `ScanWorkbenchView`

职责：

- 根据 `projectId + runId` 加载 summary
- 初始化默认选中 finding
- 组织左右分栏布局

建议布局：

```text
ScanHeader
------------------------------------
FindingListPane | FindingDetailPane
```

## 10.3 左侧列表栏

建议复刻截图中的信息密度，但复用现有样式体系：

- 顶部显示：
  - finding 总数
  - filter 按钮
  - sort 按钮
  - 当前状态 quick chip

- 每条 finding item 显示：
  - 严重级别竖条 / 色条
  - 标题
  - `#编号`
  - 文件名
  - 状态 / 已读态

这部分可以借鉴：

- [`NavigatorPanel.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/app-shell/NavigatorPanel.tsx)
- `LeftSidebar` 中的 list item 交互风格

## 10.4 右侧详情栏

右栏建议使用滚动内容区，分节渲染：

- 标题区
- metadata chips
- 代码位置
- Summary
- Conditions
- Impact
- Remediation
- 评论 / 状态更新

### 报告正文渲染

不要重新造 Markdown 渲染器。
直接复用当前消息页使用的：

- [`MessageResponse`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/ai-elements/message.tsx)
- `@codeinsights/ui` 的 `CodeBlock`
- `@codeinsights/ui` 的 `MermaidBlock`

这样可以直接获得：

- Markdown
- GFM
- 代码高亮
- Mermaid
- 行内路径 chip

## 10.5 源码路径点击

这也是现成能力，不要重写。

现有：

- [`FilePathChip.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/ai-elements/file-path-chip.tsx)
- `window.electronAPI.previewFile(...)`

建议在 finding location 上直接复用这条链路。

如果 finding 的文件路径是相对路径，只要提供：

- workspace 根目录
- 或 session 附加目录 basePaths

就能直接跳预览。

---

## 十一、与现有 Agent 系统的集成方式

## 11.1 推荐的关系模型

不要把扫描结果塞进 Agent 消息正文里长期保存。
更好的做法是：

- Agent 负责“生成结构化扫描结果”
- Scan Domain 负责“持久化 + 浏览 + triage”

## 11.2 三种接入来源

### 来源 A：外部服务导入

例如 Xint 风格 JSON 或你自己的扫描器产出。

流程：

```text
导入文件 / 外部 API
  -> normalize
  -> save project/run/findings
  -> openScanTab()
```

### 来源 B：Agent 会话产出

Agent 最终把结构化 JSON 写到：

- session 工作目录
- 或 workspace 文件目录

主进程读取后导入 Scan Domain。

### 来源 C：Chat / Agent 工具执行后的“生成工作台”

例如工具结果返回：

```json
{
  "type": "scan_report",
  "project": "...",
  "run": "...",
  "findings": [...]
}
```

渲染层收到后触发：

```ts
window.electronAPI.importScanRun(...)
```

然后自动打开 scan tab。

## 11.3 必须预留的回链字段

为后续“从漏洞回跳 Agent 过程”预留：

- `sourceSessionId`
- `sdkMessageUuid`
- `toolUseId`

这样以后可以做：

- 查看原始 Agent 会话
- 跳到触发该 finding 的工具结果
- 回看原始 reasoning / tool trace

V1 可以先只保留字段，不一定做 UI。

---

## 十二、软件名称点击后的打开流

## 12.1 统一入口函数

建议定义统一的打开协议：

```ts
openScanTab({
  projectId,
  runId,
  title,
})
```

## 12.2 可能的入口位置

### 入口 1：未来的“扫描项目列表”页

最符合“点击软件名称进详情页”的直觉。

### 入口 2：Agent 完成卡片

Agent 扫描完后出现按钮：

- `打开漏洞工作台`

### 入口 3：全局搜索

后续 [`SearchDialog.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/app-shell/SearchDialog.tsx) 可以扩展一类结果：

- `scan-project`
- `scan-finding`

### 入口 4：Welcome / Dashboard 卡片

如果你想把“安全扫描”变成一类一等能力，可以在欢迎页或首页加入口。

## 12.3 当前阶段的建议

V1 先不改全局左边栏结构，只做：

- 一个能打开 scan tab 的入口组件
- 一个 scan tab 工作台页面

这是最小可交付路径。

---

## 十三、与现有代码的具体改动映射

## 13.1 共享类型层

新增或修改：

- [`packages/shared/src/types/index.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/packages/shared/src/types/index.ts)
- `packages/shared/src/types/scan.ts`

内容：

- 扫描域类型
- IPC channel 常量
- import/update payload 类型

## 13.2 主进程层

新增或修改：

- [`config-paths.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/lib/config-paths.ts)
- `scan-project-manager.ts`
- `scan-run-manager.ts`
- `scan-import-normalizer.ts`
- [`ipc.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/main/ipc.ts)

## 13.3 preload 层

修改：

- [`preload/index.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/preload/index.ts)

内容：

- 扩展 `ElectronAPI`
- 暴露 scan 相关 Promise API

## 13.4 renderer 状态层

新增或修改：

- `atoms/scan-atoms.ts`
- [`atoms/tab-atoms.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/atoms/tab-atoms.ts)
- [`types/settings.ts`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/types/settings.ts)
- [`renderer/main.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/main.tsx)

## 13.5 renderer 视图层

新增或修改：

- `components/scan/*`
- [`components/tabs/TabContent.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabContent.tsx)
- [`components/tabs/TabBar.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabBar.tsx)
- [`components/tabs/TabBarItem.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/components/tabs/TabBarItem.tsx)
- [`hooks/useCloseTab.tsx`](/Users/zq/Desktop/ai-projs/posp/CodeInsights/apps/electron/src/renderer/hooks/useCloseTab.tsx)
- `hooks/useOpenScanTab.ts`

---

## 十四、推荐的分阶段实施顺序

## Phase 1：数据与 IPC 打底

目标：

- 定义 `scan.ts`
- 新增本地存储目录与 manager
- 完成 `SCAN_IPC_CHANNELS`
- preload 暴露读取接口

交付物：

- 能从本地文件读取一个 scan run 的 summary 和 finding detail

## Phase 2：Tab 集成

目标：

- 新增 `scan` tab 类型
- `TabContent` 支持 `ScanWorkbenchView`
- settings tabState 支持恢复 `scan`

交付物：

- 可以手动打开一个 scan tab，并在重启后恢复

## Phase 3：工作台 UI

目标：

- 左侧列表
- 右侧详情
- 筛选/排序
- 默认选中逻辑
- Markdown 报告渲染

交付物：

- 截图同类体验可用

## Phase 4：源码跳转与 triage

目标：

- finding location 点击预览源码
- finding status 更新
- comment timeline
- 已读状态

交付物：

- 从“只读报告页”升级为“可 triage 工作台”

## Phase 5：Agent / 导入链路

目标：

- 外部结果导入
- Agent 结果导入
- “打开漏洞工作台”入口

交付物：

- 扫描产出真正接入 CodeInsights 主工作流

---

## 十五、风险与权衡

## 15.1 风险：把 `scan` 直接做成第三种全局模式

问题：

- `appMode`、`LeftSidebar`、`ModeSwitcher`、`WelcomeView`、`QuickTask` 都会被牵动

建议：

- V1 不做
- 先只加 `scan` tab

## 15.2 风险：详情文件太碎

问题：

- 每个 finding 一个 JSON，文件数会增长

权衡：

- 这是为了获得列表快、详情懒加载、单条更新便宜
- 对于 500~5000 finding 的桌面本地场景，可接受

如果后续发现文件数过大，再演进为：

- `details.jsonl + in-memory index`

## 15.3 风险：TabItem 类型改动波及广

问题：

- 当前很多地方写死了 `chat | agent`

建议：

- 一次性系统性扫全所有 `tab.type` 分支
- 不要边做边补

## 15.4 风险：来源路径不统一

问题：

- finding 可能来自 workspace 相对路径
- 也可能来自导入结果的绝对路径
- 也可能来自外部扫描器的虚拟路径

建议：

- `ScanFindingLocation` 必须从第一天开始带 `basePathType`
- `scan-link-service.ts` 集中做路径解析

---

## 十六、我建议的 V1 最小实现边界

如果你现在就想开始做，而不是先做完整平台，我建议 V1 只包含：

1. 新增 `scan` tab 类型
2. 新增扫描项目/运行/漏洞的本地类型与存储
3. 一个 `ScanWorkbenchView`
4. 左侧 finding summaries
5. 右侧 markdown detail
6. 基础 severity/status 筛选
7. 文件路径点击预览
8. 一个手动入口或导入入口

V1 先**不要**做：

- 全局 `scan` appMode
- 全局搜索聚合 scan finding
- 实时流式扫描进度
- 自动修复 patch 应用
- finding 到 agent message 的精确跳转

这样可以把复杂度控制在当前架构能稳定吸收的范围内。

---

## 十七、最终结论

要在 CodeInsights 中支持截图里的页面功能，最佳路线不是“临时做一个结果页”，而是：

> 把它作为一个新的 Scan Domain 正式纳入系统，
> 但在接入方式上保持克制：
> 先用新的 `scan` tab 接管主内容区，
> 先把“左侧漏洞导航 + 右侧报告详情”做出来，
> 再逐步向全局扫描模式和完整 triage 平台演进。

这个方案的关键优点是：

- 对现有架构友好
- 对本地优先存储友好
- 对后续 Agent 集成友好
- 对截图里的交互目标足够贴近

如果只看落地优先级，我建议你按下面顺序推进：

1. `shared scan types`
2. `main scan managers + IPC`
3. `scan tab type`
4. `ScanWorkbenchView`
5. `源码跳转 + triage`
6. `Agent/导入联动`

这是当前 CodeInsights 下最平衡、最优雅、也最不容易返工的实现方式。
