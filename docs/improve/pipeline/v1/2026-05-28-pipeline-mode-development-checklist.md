# Pipeline 模式 v1 优化开发跟踪清单

> 日期：2026-05-28
> 依据方案：`docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`
> 适用范围：当前 Pipeline v2 六阶段贡献工作流的可靠性、可见性、审核体验、提交安全和可维护性优化。
> 说明：本文中的 v1 指“优化方案版本”，不是旧 `PipelineVersion = 1` 会话协议。

## 使用规则

后续 Pipeline 优化开发必须以本文为执行入口。每次开始新阶段时，先在 `tasks/todo.md` 写本阶段计划；阶段完成后在本文对应阶段勾选、追加阶段 Review，并单独提交该阶段相关文件。

### 强制规则

- [ ] 每个阶段开始前，先确认上一阶段已满足完成定义。
- [ ] 每个阶段开始前，在 `tasks/todo.md` 写清本轮范围、文件边界、验证命令和不做事项。
- [ ] 每个阶段必须先补或更新测试，再实现功能；确实无法测试的 UI 行为必须写明验证替代方案。
- [ ] 每个阶段完成后，必须运行本阶段验证命令和 `git diff --check`。
- [ ] 每个阶段完成后，必须在 `tasks/todo.md` 追加 Review，并在本文对应阶段记录验证结果。
- [ ] 每个阶段完成后必须单独提交，提交范围只包含本阶段相关文件。
- [ ] 未经用户明确要求，不 push、不创建 PR、不执行真实远端写。
- [ ] 不默认纳入 `patch-work/**`、`.DS_Store`、临时产物、截图大文件或无关改动。
- [ ] 修改功能代码时，受影响 package 的 patch version 必须递增，并同步 `bun.lock`。
- [ ] 根 `README.md` 和根 `AGENTS.md` 只有在用户明确允许后才同步。
- [ ] 状态管理继续使用 Jotai；不引入 localStorage 作为主状态源，不引入本地数据库。
- [ ] 注释、日志和用户可见错误优先中文，保留必要英文技术术语。

### 状态标记

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[x]` | 已完成并通过该项验证 |
| `[!]` | 阻塞，需要在阶段 Review 写明 blocker |

### 全局不变量

- [ ] 旧会话兼容：缺失 `version` 的历史 Pipeline 会话仍按 v1 五节点处理。
- [ ] 新建 Pipeline 入口仍默认创建 `PipelineVersion = 2`。
- [ ] v2 StageRail / Records / Gate 面板对 `committer` 可见。
- [ ] Agent / Codex runner 不直接执行真实 `git commit`、`git push`、`gh pr create`。
- [ ] 本地 commit 和远端 PR 只能由 `PipelineService` 在人工确认后执行。
- [ ] `patch-work/**` 默认永远不进入 patch-set、commit、push 或 PR。
- [ ] patch-work 路径安全必须使用 realpath / lstat / symlink 检查，不只做词法路径判断。
- [ ] Stop / abort 后，runner 在写本地文件或发送 `node_complete` 前必须再次检查 signal。
- [ ] Tester 证据保守处理：缺失、空 evidence、failed、skipped 不能被 `passed: true` 覆盖。
- [ ] 错误、records、diagnostics、task events 不得泄露 token、Authorization header、credentialed remote URL。

## 里程碑总览

| 里程碑 | 阶段 | 目标 | 初始状态 |
|--------|------|------|----------|
| M0 | Phase 0 | 清理与对齐：Records v2 committer、patch-work 入口、shared 注释 | [ ] |
| M1 | Phase 1 | Preflight 主路径：IPC / UI / start guard | [ ] |
| M2 | Phase 2 | PipelineView 拆分：hook / view model / 行为不变 | [ ] |
| M3 | Phase 3 | Patch-work Document Workbench：revision / diff / 统一文档查看 | [ ] |
| M4 | Phase 4 | Contribution Dashboard + Submission Plan | [ ] |
| M5 | Phase 5 | 远端写确认 + GitHub 增强 | [ ] |
| M6 | Phase 6 | 端到端验收、打包 smoke、公开文档准备 | [ ] |

## Phase 0：清理与对齐

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] 实现完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

关闭低风险但高可见性的 v2 漂移问题，不改变 Graph、runner 和提交逻辑。

### 入口条件

- [ ] 已阅读 v1 优化方案的“最小可交付切片”。
- [ ] 当前工作树无无关未提交改动，或已确认只会 stage 本阶段文件。
- [ ] 明确本阶段不接入完整 Preflight Center，不拆 PipelineView 主体。

### 测试任务

- [ ] 在 `PipelineRecords.test.ts` 增加 v2 阶段过滤包含 `committer` 的测试。
- [ ] 在 `pipeline-record-view-model.test.ts` 增加 v2 artifact group 中 `committer` 排在 `tester` 后的测试。
- [ ] 增加 v1 兼容测试：旧会话或 `version=1` 不显示 `committer` filter。
- [ ] 为 `openPipelinePatchWorkDir` 增加 main IPC 或 service 聚焦测试。

### 实现任务

- [ ] `PipelineRecords.tsx`：把 `STAGE_FILTERS` 改成 version-aware builder。
- [ ] `PipelineRecords.tsx`：新增 `version?: PipelineVersion` prop。
- [ ] `PipelineView.tsx`：向 `PipelineRecords` 传 `session?.version ?? state?.version`。
- [ ] `pipeline-record-view-model.ts`：`buildPipelineRecordGroups(records, { version })` 使用 `getPipelineNodeOrder(version)`。
- [ ] `pipeline-record-experience-model.ts`：检查 stage focus / external filter 对 `committer` 的支持。
- [ ] `packages/shared/src/types/pipeline.ts`：检查 Pipeline 相关历史注释，清理明显过期说明；不改行为。
- [ ] `PIPELINE_IPC_CHANNELS`：新增 `OPEN_PATCH_WORK_DIR`。
- [ ] `pipeline-handlers.ts`：新增打开仓库内 `patch-work/` 的 handler，路径来自 `PipelineService`，不能由 Renderer 传任意路径。
- [ ] `preload/index.ts`：暴露 `openPipelinePatchWorkDir(sessionId)`。
- [ ] `TesterResultBoard.tsx` / `CommitterPanel.tsx`：增加“打开 patch-work 目录”入口。

### 触达文件

- [ ] `packages/shared/src/types/pipeline.ts`
- [ ] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [ ] `apps/electron/src/preload/index.ts`
- [ ] `apps/electron/src/main/lib/pipeline-service.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/TesterResultBoard.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`
- [ ] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] v2 Records filter 显示 explorer / planner / developer / reviewer / tester / committer。
- [ ] v1 Records filter 不显示 committer。
- [ ] committer artifact group 排序稳定在 tester 之后。
- [ ] Tester / Committer 面板可以打开 repo 内 `patch-work/`。
- [ ] 没有改动 Graph、runner、Git submission 行为。
- [ ] 受影响 package patch version 已递增。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不引入新的 Preflight UI。
- [ ] 不新增真实 Git 写操作。
- [ ] 不改远端 PR 行为。
- [ ] 不把 `patch-work/**` 纳入提交候选。

### 阶段 Review 模板

```markdown
## Phase 0 Review

- 主要变更：
- 验证命令：
- 兼容性确认：
- 未完成项：
- 提交：
```

## Phase 1：Preflight 主路径

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] shared / IPC / preload 完成
- [ ] main service 完成
- [ ] renderer UI 完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

把已有 `runPipelinePreflight()` 接入产品主路径：Renderer 启动前可见，`PipelineService.start()` 服务端复验 blocker。

### 入口条件

- [ ] Phase 0 已完成并提交。
- [ ] 已确认 Codex SDK 模式和 CLI 模式的 runtime 检查语义。
- [ ] 已明确 warning acknowledgement 只对当前 preflight fingerprint 有效。

### 契约任务

- [ ] `packages/shared/src/types/pipeline.ts`：新增 `PipelineRunPreflightInput`。
- [ ] `packages/shared/src/types/pipeline.ts`：新增 `PipelinePreflightAcknowledgement` 或等价字段。
- [ ] `packages/shared/src/types/pipeline.ts`：新增 `PIPELINE_IPC_CHANNELS.RUN_PREFLIGHT`。
- [ ] 明确 `PipelinePreflightRuntimeKind` 是否需要拆分 `codex-sdk-auth` / `codex-cli`。
- [ ] 明确 warning code 白名单，拒绝前端传入未知 warning code。

### 后端任务

- [ ] `pipeline-service.ts`：新增 `runPreflight(input)`。
- [ ] `pipeline-service.ts`：`start()` 解析 workspace session path 后执行服务端 preflight。
- [ ] `pipeline-service.ts`：blocker 阻断 Graph invoke。
- [ ] `pipeline-service.ts`：warning acknowledgement 与 fingerprint 不匹配时要求重新确认。
- [ ] `pipeline-service.ts`：写入 Pipeline record 或 status/error record，便于审计。
- [ ] `contribution-task-service.ts`：写入 `preflight_completed` event。
- [ ] `pipeline-preflight-service.ts`：补齐 runtime 检查缺口和错误脱敏。
- [ ] `pipeline-handlers.ts`：注册 `RUN_PREFLIGHT`。
- [ ] `preload/index.ts`：暴露 `runPipelinePreflight()`。

### 前端任务

- [ ] `pipeline-atoms.ts`：新增 `pipelinePreflightResultAtom`。
- [ ] `pipeline-atoms.ts`：新增 warning acknowledgement atom。
- [ ] 新增 `PipelinePreflightPanel.tsx`。
- [ ] `PipelinePreflightPanel` 展示 Repository / Runtime / Package Manager / Blockers / Warnings。
- [ ] `PipelineView.tsx` 或 `usePipelinePreflight()`：启动前自动运行 preflight。
- [ ] blocker 禁用启动按钮。
- [ ] warning 需要用户明确“记录风险继续”。
- [ ] 渠道 / 工作区错误仍能跳转设置页。
- [ ] preflight result 超过 60 秒或 workspace 变化后标记“需要刷新”。

### 测试任务

- [ ] `pipeline-preflight-service.test.ts`：Git root 不存在。
- [ ] `pipeline-preflight-service.test.ts`：非 Git root。
- [ ] `pipeline-preflight-service.test.ts`：Git conflict blocker。
- [ ] `pipeline-preflight-service.test.ts`：dirty worktree warning。
- [ ] `pipeline-preflight-service.test.ts`：Claude / Codex runtime 缺失。
- [ ] `pipeline-service.test.ts`：start 遇 blocker 不调用 Graph。
- [ ] `pipeline-service.test.ts`：warning acknowledgement 通过后可启动。
- [ ] `pipeline-preflight.test.ts`：渠道 / 工作区错误保持原行为。
- [ ] `PipelinePreflightPanel.test.tsx`：blocker / warning / runtime status 展示。

### 触达文件

- [ ] `packages/shared/src/types/pipeline.ts`
- [ ] `apps/electron/src/main/lib/pipeline-preflight-service.ts`
- [ ] `apps/electron/src/main/lib/pipeline-service.ts`
- [ ] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [ ] `apps/electron/src/preload/index.ts`
- [ ] `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [ ] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] Renderer 启动前能显示 repository / runtime preflight 结果。
- [ ] blocker 禁止启动，Service start 也会阻断。
- [ ] warning 可以人工接受，接受记录可审计。
- [ ] 服务端不会信任前端传回的旧 preflight result。
- [ ] preflight 错误不泄露 secret。
- [ ] 受影响 package patch version 已递增。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不绕过服务端 preflight。
- [ ] 不把 warning 当 blocker 一概阻断。
- [ ] 不在 Renderer 直接运行 shell 检查。
- [ ] 不把真实 token、auth header、credentialed remote URL 写入 records。

## Phase 2：PipelineView 拆分

### 阶段状态

- [ ] 阶段开始
- [ ] 测试先行完成
- [ ] hooks 拆分完成
- [ ] UI 行为回归完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

在保持行为不变的前提下，把 `PipelineView.tsx` 从全能组件拆成布局层 + hooks + side panel，降低后续功能叠加风险。

### 入口条件

- [ ] Phase 1 已完成并提交。
- [ ] 已列出现有 `PipelineView` 行为快照：records loading、document loading、gate respond、stop/restart、settings jump。
- [ ] 明确本阶段不引入 Document Workbench 主体验。

### 拆分任务

- [ ] 新增 `usePipelineSessionState(sessionId)`。
- [ ] 新增 `usePipelineRecords(sessionId)`。
- [ ] 新增 `usePatchWorkDocuments(sessionId, refs)`。
- [ ] 新增 `usePipelineGateActions(sessionId, pendingGate)`。
- [ ] 新增 `usePipelinePreflight(sessionId, workspaceId)` 或迁移 Phase 1 临时逻辑。
- [ ] 新增 `PipelineGateSidePanel.tsx`。
- [ ] `PipelineView.tsx` 只保留布局组合、状态传递和少量事件 wiring。
- [ ] 保留现有 error display、failure card、live output、settings jump 行为。
- [ ] 保留 stop 乐观状态和失败回滚行为。

### 测试任务

- [ ] `usePipelineRecords`：session 切换不串数据。
- [ ] `usePipelineRecords`：refresh 后按 cursor 追赶 records。
- [ ] `usePatchWorkDocuments`：同 checksum 缓存、不重复读取。
- [ ] `usePatchWorkDocuments`：session 切换清空旧 loading / error。
- [ ] `usePipelineGateActions`：approve / reject / rerun / select task 参数正确。
- [ ] `PipelineGateSidePanel`：按 gate kind 选择正确面板。
- [ ] 现有 panel 测试全部通过。

### 触达文件

- [ ] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [ ] `apps/electron/src/renderer/components/pipeline/hooks/usePipelineSessionState.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/hooks/usePipelineRecords.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/hooks/usePatchWorkDocuments.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/hooks/usePipelineGateActions.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/hooks/usePipelinePreflight.ts`
- [ ] `apps/electron/src/renderer/components/pipeline/PipelineGateSidePanel.tsx`
- [ ] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/ExplorerTaskBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] `PipelineView.tsx` 不再直接包含 records tail loading 主体逻辑。
- [ ] `PipelineView.tsx` 不再直接管理 patch-work document loading maps。
- [ ] 所有现有 gate 面板行为保持。
- [ ] stop/restart/gate respond 关键路径无回归。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不重做视觉设计。
- [ ] 不改变 Graph / service / runner 行为。
- [ ] 不把局部 textarea feedback 放入全局 atom，除非明确要跨页面恢复草稿。

## Phase 3：Patch-work Document Workbench

### 阶段状态

- [ ] 阶段开始
- [ ] read model 完成
- [ ] Workbench MVP 完成
- [ ] 面板接入完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

把 `plan.md`、`dev.md`、`review.md`、`result.md`、`patch-set/*`、`commit.md`、`pr.md` 从各面板内联 `<pre>` 升级为统一、可审计、可对比的 Document Workbench。

### 入口条件

- [ ] Phase 2 已完成并提交。
- [ ] 已确认本阶段 MVP 只读，不做用户编辑。
- [ ] 已确认 revision 数据从现有 manifest / revision 存储读取，不破坏旧 manifest。

### 契约与后端任务

- [ ] 新增 `PatchWorkDocumentRevision` 类型。
- [ ] 新增 `LIST_PATCH_WORK_REVISIONS` IPC。
- [ ] 新增 `READ_PATCH_WORK_REVISION` IPC。
- [ ] `pipeline-patch-work-service.ts`：提供 list/read revision API。
- [ ] 路径校验复用现有 patch-work 安全规则。
- [ ] 读取 revision 时校验 checksum。
- [ ] 读取当前文件时能标记是否与 manifest checksum 匹配。

### 前端任务

- [ ] 新增 `PatchWorkDocumentWorkbench.tsx`。
- [ ] 新增 `PatchWorkDocumentTree.tsx` 或等价文件分组 view model。
- [ ] `.md` 使用 Markdown 渲染。
- [ ] `.patch` 使用 diff 渲染。
- [ ] `.json` 格式化展示，解析失败时显示原文和错误。
- [ ] 展示 revision selector。
- [ ] 展示 current / accepted badge。
- [ ] 支持 compare current vs accepted。
- [ ] 支持打开 patch-work 目录和打开当前文件。
- [ ] `ReviewDocumentBoard` 接入 Workbench。
- [ ] `TesterResultBoard` 接入 Workbench。
- [ ] `CommitterPanel` 接入 Workbench。

### 测试任务

- [ ] `pipeline-patch-work-service.test.ts`：list revisions。
- [ ] `pipeline-patch-work-service.test.ts`：read revision checksum。
- [ ] `pipeline-patch-work-service.test.ts`：拒绝 unsafe relativePath。
- [ ] Workbench 测试：Markdown / patch / JSON 渲染分支。
- [ ] Workbench 测试：revision selector 和 accepted badge。
- [ ] 面板测试：缺 checksum / 读取失败仍阻止 approve。

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] 所有 patch-work 文档读取通过统一 Workbench。
- [ ] 用户能查看 revision 列表。
- [ ] 用户能对比 current 和 accepted revision。
- [ ] `changes.patch` 有可读 diff 视图。
- [ ] checksum mismatch 有明确提示。
- [ ] 旧 manifest 仍可读。
- [ ] 受影响 package patch version 已递增。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不在 Renderer 直接读取本地文件。
- [ ] 不提供编辑保存。
- [ ] 不改变 patch-work manifest 结构，除非有迁移测试。

## Phase 4：Contribution Dashboard 与 Submission Plan

### 阶段状态

- [ ] 阶段开始
- [ ] read model 完成
- [ ] Dashboard 完成
- [ ] CommitterPanel 三段式改造完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

让 ContributionTask 成为一等 UI，并把提交前信息收敛为 `PipelineSubmissionPlan`，避免 CommitterPanel 从多个 stage output 零散拼状态。

### 入口条件

- [ ] Phase 3 已完成并提交。
- [ ] 已确认本阶段不改变真实 commit / remote PR 执行服务。
- [ ] 已确认 Dashboard 使用 read model，不从 records 文本反推状态。

### 契约与后端任务

- [ ] 新增 `ContributionTaskSummary` 类型。
- [ ] 新增 `PipelineSubmissionPlan` 类型。
- [ ] 新增 `GET_CONTRIBUTION_TASK_SUMMARY` IPC。
- [ ] 新增 `GET_SUBMISSION_PLAN` IPC。
- [ ] 新增 `pipeline-read-model-service.ts`。
- [ ] Summary 包含 task、repo、branch、mode、patch-work、commit、PR、最近事件。
- [ ] SubmissionPlan 包含 commit message、PR title/body、candidate files、excluded files、blockers、warnings、local commit、remote submission。
- [ ] service 读取失败时返回可解释错误，不让 UI 静默空白。

### 前端任务

- [ ] 新增 `ContributionTaskDashboard.tsx`。
- [ ] 新增 `useContributionTaskSummary(sessionId)`。
- [ ] 新增 `usePipelineSubmissionPlan(sessionId)`。
- [ ] Dashboard 展示 selected task、repository、branch、mode、patch-work 状态、commit hash、PR URL、最近事件。
- [ ] CommitterPanel 改为三段：保存材料、本地 commit、Draft PR。
- [ ] 本地 commit 前展示 candidate files / excluded files / branch。
- [ ] Draft PR 前展示 remote / base/head / PR preview。
- [ ] push 成功但 PR 失败时展示恢复入口。

### 测试任务

- [ ] `pipeline-read-model-service.test.ts`：summary 缺 task。
- [ ] `pipeline-read-model-service.test.ts`：summary 从 events 汇总 commit / PR。
- [ ] `pipeline-read-model-service.test.ts`：submission plan 排除 `patch-work/**`。
- [ ] `CommitterPanel.test.tsx`：三段按钮禁用条件。
- [ ] `CommitterPanel.test.tsx`：没有 local commit 时不能进入 Draft PR。
- [ ] `ContributionTaskDashboard.test.tsx`：summary 正常 / 空态 / 错误态。

### 验证命令

```bash
bun test apps/electron/src/main/lib/contribution-task-service.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] Dashboard 可见 task / repo / branch / mode / patch-work / commit / PR。
- [ ] CommitterPanel 不再零散拼提交计划。
- [ ] local patch / local commit / remote PR 三个动作清晰分区。
- [ ] `patch-work/**` 明确显示在 excluded files。
- [ ] read model 错误可见且不阻断 records。
- [ ] 受影响 package patch version 已递增。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不引入真实远端写新路径。
- [ ] 不把 Dashboard 状态写入 localStorage。
- [ ] 不让 UI 直接计算提交候选文件作为事实源。

## Phase 5：远端写确认与 GitHub 增强

### 阶段状态

- [ ] 阶段开始
- [ ] 独立远端确认模型完成
- [ ] GitHub API / existing PR 策略完成
- [ ] UI 恢复路径完成
- [ ] 验证完成
- [ ] 阶段提交完成

### 目标

收敛远端写语义：把 remote PR 从 CommitterPanel checkbox 提升为独立确认状态，并补充 GitHub API / existing PR / PR 创建失败恢复能力。

### 入口条件

- [ ] Phase 4 已完成并提交。
- [ ] 已完成安全评审：远端写必须显式二次确认。
- [ ] 已确认真实 remote PR smoke 需要用户凭证或 CI secret。

### 契约与后端任务

- [ ] 明确 `remote_write_confirmation` 是独立 gate 还是 persisted pending operation。
- [ ] 如果采用独立 gate，更新 `pipeline-graph.ts` / `pipeline-state.ts` / tests。
- [ ] 远端确认 payload 包含 operationId、remote、base/head、commitHash、PR title、sanitized URL、warnings。
- [ ] Service 复验 operation id、commit hash、remote base、head branch safety。
- [ ] Service 复验待推送 tree / range 不包含 `patch-work/**`。
- [ ] 支持 push 成功 PR 失败后 `skipPush = true` 重试。
- [ ] GitHub API path 不泄露 token。
- [ ] existing PR 检测依据 head owner / head branch / base branch / repo。
- [ ] existing PR update 必须有 preview，不静默覆盖。

### 前端任务

- [ ] 新增 `RemoteWriteConfirmationPanel.tsx`。
- [ ] CommitterPanel 的 Draft PR 按钮进入远端确认，不直接执行 push。
- [ ] 展示 remote、base/head、commit hash、PR title/body、warnings。
- [ ] 用户必须明确确认远端写风险。
- [ ] push 成功 PR 失败时展示“重试创建 PR”和“打开远端分支”。
- [ ] PR 已存在时展示“打开 PR”或“更新现有 PR”选择。

### 测试任务

- [ ] `pipeline-graph.test.ts`：remote confirmation gate 顺序。
- [ ] `pipeline-state.test.ts`：remote gate replay。
- [ ] `pipeline-service.test.ts`：remote confirmation 未确认不执行。
- [ ] `pipeline-git-submission-service.test.ts`：push success / PR failure / retry skipPush。
- [ ] `pipeline-git-submission-service.test.ts`：existing PR 分支检测。
- [ ] `RemoteWriteConfirmationPanel.test.tsx`：风险确认和按钮状态。
- [ ] 脱敏测试：token、credentialed URL、Authorization header 不出现在输出。

### 验证命令

```bash
bun test packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [ ] 远端写有独立、可审计、可恢复的确认状态。
- [ ] 未二次确认时不会执行 `git push` 或创建 PR。
- [ ] push / PR 任一失败都能脱敏展示并判断是否可重试。
- [ ] existing PR 不会被静默覆盖。
- [ ] `patch-work/**` 不会进入待推送 commit tree 或 push range。
- [ ] 受影响 package patch version 已递增。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不默认执行远端写。
- [ ] 不把 GitHub token 写入 config、records、events、diagnostics。
- [ ] 不把 `gh` CLI 失败包装成成功。
- [ ] 不跳过 remote base/head 安全检查。

## Phase 6：真实端到端验收与交付准备

### 阶段状态

- [ ] 阶段开始
- [ ] fixture repo 完成
- [ ] smoke 完成
- [ ] 打包验证完成
- [ ] 文档同步准备完成
- [ ] 阶段提交完成

### 目标

在不伪装未验证能力的前提下，完成从 preflight 到 draft-only、local commit、remote PR 的端到端验证，并准备公开文档同步。

### 入口条件

- [ ] Phase 5 已完成并提交。
- [ ] 已确认哪些 smoke 不需要真实模型，哪些需要真实凭证。
- [ ] 已确认 README / AGENTS 仍需用户允许后再修改。

### Fixture repo 任务

- [ ] clean repo fixture：可完成 happy path。
- [ ] dirty repo fixture：验证 warning acknowledgement。
- [ ] conflict repo fixture：验证 blocker。
- [ ] local bare remote fixture：验证 push 前置逻辑。
- [ ] Git author、default branch、remote URL 在测试内显式设置。
- [ ] fixture 不依赖开发机全局 Git 配置。

### Smoke 任务

- [ ] preflight IPC smoke，不需要真实模型。
- [ ] draft-only fake runner smoke。
- [ ] local commit fake runner smoke。
- [ ] packaged app draft-only smoke。
- [ ] packaged app local commit smoke。
- [ ] remote PR smoke gated：只在用户提供 GitHub / gh / API token 条件下运行。
- [ ] 记录未覆盖平台：macOS x64、Windows x64、Linux 等不在本机验证的项必须标 `[!]`。

### 文档准备任务

- [ ] 整理实际已落地功能和未落地功能。
- [ ] 准备 README 更新草案，但不直接修改根 README，除非用户确认。
- [ ] 准备 AGENTS 更新草案，但不直接修改根 AGENTS，除非用户确认。
- [ ] 更新 v1 方案和 checklist 的最终状态。
- [ ] 准备下一轮真实使用验收 prompt。

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron docs/improve/pipeline/v1 tasks/todo.md
```

### 完成定义

- [ ] draft-only 不产生 commit。
- [ ] local commit 只提交候选文件且不包含 `patch-work/**`。
- [ ] remote PR 只在显式确认和凭证可用时创建 Draft PR。
- [ ] packaged app 至少通过 draft-only 和 local commit smoke。
- [ ] 所有未验证平台和未验证真实远端能力明确标 `[!]`。
- [ ] 根 README / AGENTS 是否同步已得到用户决定。
- [ ] 阶段 Review 已写入 `tasks/todo.md`。
- [ ] 阶段提交完成。

### 禁止事项

- [ ] 不把 fake runner smoke 伪装成真实模型验收。
- [ ] 不把 app bundle 通过伪装成 DMG / installer 通过。
- [ ] 不在无用户确认情况下运行真实远端 PR smoke。
- [ ] 不修改根 README / AGENTS，除非用户明确允许。

## 横向工作流

### 安全审查清单

- [ ] 新增 IPC handler 均校验输入。
- [ ] Renderer 不能传任意本地路径让 main 打开或读取。
- [ ] patch-work 相对路径拒绝绝对路径、`..`、reserved path、symlink。
- [ ] Git 写操作只能在 service 受控路径执行。
- [ ] Codex workspace-write 节点继续阻断 commit/push/tag/reset/rebase/fetch/pull/gh/hub。
- [ ] 事后 Git 校验覆盖 HEAD、refs、index、local config 和 patch 丢失。
- [ ] 远端 URL、token、Authorization header 全部脱敏。

### 可用性检查清单

- [ ] 新功能必须能从默认 v2 新建会话入口到达。
- [ ] 运行中无文本输出时仍有静默运行反馈。
- [ ] stop 按钮有“正在停止”和“已停止”反馈。
- [ ] blocker / warning 有清晰解释和下一步动作。
- [ ] 长路径、长 commit message、长 PR title 不撑破 UI。
- [ ] 按钮 disabled 时能看出原因。
- [ ] 错误态不吞掉 records 和历史产物。

### 测试纪律清单

- [ ] 优先写单测或 BDD 场景。
- [ ] Main service 测试覆盖成功、失败、幂等、恢复。
- [ ] Renderer 测试覆盖空态、错误态、loading、disabled、用户确认。
- [ ] Git 相关测试不依赖开发机全局 Git 配置。
- [ ] Codex auth 相关测试不依赖开发机已有登录。
- [ ] 真实 remote smoke 必须 gated。

### 版本与提交清单

- [ ] 修改 `packages/shared` 运行时契约时递增 shared patch version。
- [ ] 修改 `apps/electron` 业务逻辑或 UI 时递增 electron patch version。
- [ ] 修改 lockfile 后确认只包含预期 workspace version 变化。
- [ ] 每阶段独立提交。
- [ ] 提交信息使用详细中文，说明主要变更、验证、未做事项。
- [ ] 提交前 `git status --short` 确认无无关文件。

## 后续积压池

这些事项不阻塞 Phase 0-6，但后续可以单独排期：

- [ ] Patch-work 文档内评论和锚点反馈。
- [ ] 用户编辑 `plan.md` / `pr.md` 后保存为新 revision。
- [ ] Workflow Profile 设置页。
- [ ] Pipeline Report Export HTML / PDF。
- [ ] GitHub labels / reviewers / linked issue。
- [ ] 现有 PR 更新的冲突预览。
- [ ] Pipeline run policy per session 固化。
- [ ] 更细的 node rerun impact preview。
- [ ] packaged app 多平台 smoke 自动化。

## 阶段 Review 统一模板

每个阶段完成后，在 `tasks/todo.md` 和本文对应阶段填写：

```markdown
## YYYY-MM-DD Pipeline v1 Phase N Review

- 阶段范围：
- 主要变更：
- 触达文件：
- 验证命令：
- 兼容性确认：
- 安全确认：
- 未完成项 / [!]：
- 阶段提交：
```

## 下一轮启动入口

下一轮正式开发从 Phase 0 开始，推荐首个最小 PR：

1. 修复 Records v2 `committer` filter / group。
2. 新增 `openPipelinePatchWorkDir` IPC / preload / UI 入口。
3. 不改 Graph、runner、Git submission。
4. 跑 Phase 0 聚焦测试、typecheck、diff check。
5. 阶段完成后单独提交。
