# Pipeline 模式 v1 优化开发跟踪清单

> 日期：2026-05-28
> 依据方案：`docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`
> 适用范围：当前 Pipeline v2 六阶段贡献工作流的可靠性、可见性、审核体验、提交安全和可维护性优化。
> 说明：本文中的 v1 指“优化方案版本”，不是旧 `PipelineVersion = 1` 会话协议。

## 最新开发状态

> 更新时间：2026-05-29
> 当前分支：`pipeline-improve`
> 最新开发基线：`4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`；上一稳定基线：`dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`
> 最新恢复入口：本轮 `docs(pipeline): 同步 Phase 3 后续开发状态` 提交；上一恢复入口：`24562792 docs(pipeline): 补齐 Phase 2 最新恢复状态`。
> 当前结论：Phase 0 清理与对齐、Phase 1 Preflight 主路径、Phase 2 PipelineView 拆分、Phase 3 Patch-work Document Workbench 已完成并通过聚焦验证；Phase 4-6 尚未开始。下次正式开发应从 **Phase 4：Contribution Dashboard 与 Submission Plan** 开始。

### 已完成

- [x] 完成 Pipeline v1 优化方案文档：`docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`。
- [x] 完成 Pipeline v1 开发跟踪清单：`docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
- [x] 完成阶段提交习惯同步：`tasks/lessons.md` 已记录“重新启动 Codex 会话后也要主动检查已完成但未提交阶段成果”。
- [x] 已按阶段提交成果：
  - `ae5c85ba docs(pipeline): 完善 Pipeline v1 优化方案`
  - `3c754ac6 docs(pipeline): 新增 Pipeline v1 开发跟踪清单`
  - `3ce1402e docs(tasks): 同步阶段提交长期习惯`
  - `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`
  - `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`
  - `0102ed09 docs(pipeline): 同步 Phase 1 后续开发状态`
  - `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`
  - `6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`
  - `24562792 docs(pipeline): 补齐 Phase 2 最新恢复状态`
  - `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`
- [x] 已确认根 `README.md` / 根 `AGENTS.md` 不在本阶段修改范围内。
- [x] Phase 0：清理与对齐。
  - Records 阶段过滤已按 `PipelineVersion` 区分，v2 显示 `committer` / “提交”，v1 和缺失 version 的旧会话保持五节点。
  - `pipeline-record-view-model` artifact group 排序已显式使用 `getPipelineNodeOrder(version)`，v2 `committer` 稳定排在 `tester` 后。
  - 已新增 `openPipelinePatchWorkDir(sessionId)` shared IPC / preload / main handler / service / Tester / Committer UI 入口；Renderer 只传 `sessionId`，main 端重新解析 repo 内 `patch-work/`。
  - 已按规则递增 `@codeinsights/shared` 到 `0.1.50`、`@codeinsights/electron` 到 `0.0.122`，并同步 `bun.lock`。
- [x] Phase 1：Preflight 主路径。
  - 已新增 repository preflight shared 契约 / IPC / preload API：`PipelineRunPreflightInput`、`PipelinePreflightAcknowledgement`、`RUN_PREFLIGHT`、`window.electronAPI.runPipelinePreflight()`。
  - `runPipelinePreflight()` 已返回 `checkedAt` / `fingerprint`，fingerprint 纳入 HEAD / dirty status digest，并对 credentialed remote URL、query/hash token、Authorization 和 runtime diagnostic 做脱敏。
  - `PipelineService.start()` 已对 v2 会话服务端复验 preflight；blocker 和未确认 / 过期 warning acknowledgement 都会阻断 Graph invoke。
  - Renderer 启动前展示 `PipelinePreflightPanel`，blocker 禁止启动但可重新检查，warning 需用户明确点击“记录风险继续”。
  - warning acknowledgement 匹配服务端最新 fingerprint / warning code 后，会由服务端重写审计时间并写入 `preflight_completed` ContributionTask event。
  - 已按规则递增 `@codeinsights/shared` 到 `0.1.51`、`@codeinsights/electron` 到 `0.0.123`，并同步 `bun.lock`。
- [x] Phase 2：PipelineView 拆分。
  - 已新增 `pipeline-gate-panel-model.ts`、`PipelineGateSidePanel.tsx`、`usePipelineRecordsTail.ts`、`usePipelineSessionSnapshot.ts`、`usePipelinePatchWorkDocuments.ts`、`usePipelineExplorerReports.ts`、`usePipelineGateActions.ts`，将 records tail、session snapshot、patch-work 文档读取、explorer reports、gate action 和 gate 面板选择从 `PipelineView` 拆出。
  - 已收敛 Phase 1 遗留项：preflight result 超过 60 秒或 workspace 变化后显示“启动前检查需要刷新”，清空旧 acknowledgement 复用路径，并禁用 Composer 直接启动。
  - 已按规则递增 `@codeinsights/electron` 到 `0.0.124`，并同步 `bun.lock`。
- [x] Phase 3：Patch-work Document Workbench。
  - 已新增 patch-work revision read model、`LIST_PATCH_WORK_REVISIONS` / `READ_PATCH_WORK_REVISION` IPC 和受控 `OPEN_PATCH_WORK_FILE` 入口，Renderer 只传 `sessionId`、`relativePath`、`revision`。
  - 已新增统一只读 `PatchWorkDocumentWorkbench`，支持 markdown、patch/diff、json/text、revision selector、current / accepted badge、checksum mismatch / read error、current vs accepted 对比。
  - 已接入 `ReviewDocumentBoard`、`TesterResultBoard`、`CommitterPanel`，并保留既有审核 / 提交流程的保守阻断条件。
  - 已按规则递增 `@codeinsights/shared` 到 `0.1.52`、`@codeinsights/electron` 到 `0.0.125`，并同步 `bun.lock`。

### 尚未开始

- [ ] Phase 4：Contribution Dashboard 与 Submission Plan。
- [ ] Phase 5：远端写确认与 GitHub 增强。
- [ ] Phase 6：真实端到端验收与交付准备。

### 当前未完成的关键能力

- [ ] ContributionTask Dashboard 和 SubmissionPlan read model 仍未实现。
- [ ] 独立 `remote_write_confirmation` 状态和 GitHub API / existing PR 增强仍未实现。
- [ ] 真实 smoke、packaged smoke 和公开文档同步均未开始。

### 下次启动入口

下次启动 Codex 后先执行以下动作：

1. 读取 `tasks/lessons.md`，特别是阶段提交、Pipeline patch-work 路径安全、Git 防护、stop 后副作用、Codex secret 注入和状态同步习惯。
2. 读取本文和优化方案文档，确认当前状态是“Phase 0、Phase 1、Phase 2、Phase 3 已完成，Phase 4 未开始”。
3. 运行 `git status --short --branch` 和 `git log -6 --oneline`，确认没有未提交改动，并确认最近历史包含 `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`、`24562792 docs(pipeline): 补齐 Phase 2 最新恢复状态`、`dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分` 和 `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`。
4. 在 `tasks/todo.md` 写入 Phase 4 计划。
5. 从 Phase 4 开始开发，先补测试，再实现 Contribution Dashboard 与 Submission Plan read model / UI。
6. Phase 4 完成后更新本文状态、更新 next-session prompt、追加 `tasks/todo.md` Review，并单独提交。

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
| M0 | Phase 0 | 清理与对齐：Records v2 committer、patch-work 入口、shared 注释 | [x] |
| M1 | Phase 1 | Preflight 主路径：IPC / UI / start guard | [x] |
| M2 | Phase 2 | PipelineView 拆分：hook / view model / 行为不变 | [x] |
| M3 | Phase 3 | Patch-work Document Workbench：revision / diff / 统一文档查看 | [x] |
| M4 | Phase 4 | Contribution Dashboard + Submission Plan | [ ] |
| M5 | Phase 5 | 远端写确认 + GitHub 增强 | [ ] |
| M6 | Phase 6 | 端到端验收、打包 smoke、公开文档准备 | [ ] |

## Phase 0：清理与对齐

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] 实现完成
- [x] 验证完成
- [x] 阶段提交完成

### 目标

关闭低风险但高可见性的 v2 漂移问题，不改变 Graph、runner 和提交逻辑。

### 入口条件

- [x] 已阅读 v1 优化方案的“最小可交付切片”。
- [x] 当前工作树无无关未提交改动，或已确认只会 stage 本阶段文件。
- [x] 明确本阶段不接入完整 Preflight Center，不拆 PipelineView 主体。

### 测试任务

- [x] 在 `PipelineRecords.test.ts` 增加 v2 阶段过滤包含 `committer` 的测试。
- [x] 在 `pipeline-record-view-model.test.ts` 增加 v2 artifact group 中 `committer` 排在 `tester` 后的测试。
- [x] 增加 v1 兼容测试：旧会话或 `version=1` 不显示 `committer` filter。
- [x] 为 `openPipelinePatchWorkDir` 增加 main IPC 或 service 聚焦测试。

### 实现任务

- [x] `PipelineRecords.tsx`：把 `STAGE_FILTERS` 改成 version-aware builder。
- [x] `PipelineRecords.tsx`：新增 `version?: PipelineVersion` prop。
- [x] `PipelineView.tsx`：向 `PipelineRecords` 传 `session?.version ?? state?.version`。
- [x] `pipeline-record-view-model.ts`：`buildPipelineRecordGroups(records, { version })` 使用 `getPipelineNodeOrder(version)`。
- [x] `pipeline-record-experience-model.ts`：检查 stage focus / external filter 对 `committer` 的支持。
- [x] `packages/shared/src/types/pipeline.ts`：检查 Pipeline 相关历史注释，清理明显过期说明；不改行为。
- [x] `PIPELINE_IPC_CHANNELS`：新增 `OPEN_PATCH_WORK_DIR`。
- [x] `pipeline-handlers.ts`：新增打开仓库内 `patch-work/` 的 handler，路径来自 `PipelineService`，不能由 Renderer 传任意路径。
- [x] `preload/index.ts`：暴露 `openPipelinePatchWorkDir(sessionId)`。
- [x] `TesterResultBoard.tsx` / `CommitterPanel.tsx`：增加“打开 patch-work 目录”入口。

### 触达文件

- [x] `packages/shared/src/types/pipeline.ts`
- [x] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [x] `apps/electron/src/preload/index.ts`
- [x] `apps/electron/src/main/lib/pipeline-service.ts`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.ts`
- [x] `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.ts`
- [x] `apps/electron/src/renderer/components/pipeline/TesterResultBoard.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`
- [x] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts
```

```bash
bun test apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [x] v2 Records filter 显示 explorer / planner / developer / reviewer / tester / committer。
- [x] v1 Records filter 不显示 committer。
- [x] committer artifact group 排序稳定在 tester 之后。
- [x] Tester / Committer 面板可以打开 repo 内 `patch-work/`。
- [x] 没有改动 Graph、runner、Git submission 行为。
- [x] 受影响 package patch version 已递增。
- [x] 阶段 Review 已写入 `tasks/todo.md`。
- [x] 阶段提交完成。

### 禁止事项

- [x] 不引入新的 Preflight UI。
- [x] 不新增真实 Git 写操作。
- [x] 不改远端 PR 行为。
- [x] 不把 `patch-work/**` 纳入提交候选。

### 阶段 Review 模板

```markdown
## Phase 0 Review

- 主要变更：
- 验证命令：
- 兼容性确认：
- 未完成项：
- 提交：
```

## 2026-05-29 Pipeline v1 Phase 0 Review

- 阶段范围：清理与对齐；仅修复 Records v2 committer 可见性 / 排序、新增打开 repo 内 `patch-work/` 的受控入口、清理 shared 类型注释。
- 主要变更：`PipelineRecords` 阶段过滤改为 version-aware；`PipelineView` 向 Records 传入版本；record group / stage focus / Markdown report 支持 version-aware 分组；新增 `OPEN_PATCH_WORK_DIR`、`openPipelinePatchWorkDir(sessionId)`、`PipelineService.getPatchWorkDir(sessionId)` 和 Tester / Committer 面板入口。
- 触达文件：`packages/shared/src/types/pipeline.ts`、`apps/electron/src/main/ipc/pipeline-handlers.ts`、`apps/electron/src/preload/index.ts`、`apps/electron/src/main/lib/pipeline-service.ts`、`apps/electron/src/main/lib/pipeline-patch-work-service.ts`、Pipeline Records / Tester / Committer 组件与测试、workspace package versions、`bun.lock`、本文和 next-session prompt。
- 验证命令：`bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`。
- 兼容性确认：缺失 `version` 或 `version=1` 的旧会话仍只显示五阶段 filter；已存在的 committer 记录不被丢弃；Graph、runner、Git submission 和远端 PR 行为未修改。
- 安全确认：Renderer 只传 `sessionId`；main 端通过 ContributionTask 的 `repositoryRoot` 重新解析 `repoRoot/patch-work`；`resolvePatchWorkDir` 继续做 realpath / lstat / symlink 检查，并拒绝非目录路径。
- 未完成项 / [!]：Preflight 主路径、PipelineView 拆分、Patch-work Workbench、Contribution Dashboard / SubmissionPlan、远端写确认增强和真实端到端验收仍未开始。
- 阶段提交：`ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`。

## Phase 1：Preflight 主路径

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] shared / IPC / preload 完成
- [x] main service 完成
- [x] renderer UI 完成
- [x] 验证完成
- [x] 阶段提交完成

### 目标

把已有 `runPipelinePreflight()` 接入产品主路径：Renderer 启动前可见，`PipelineService.start()` 服务端复验 blocker。

### 入口条件

- [x] Phase 0 已完成并提交。
- [x] 已确认 Codex SDK 模式和 CLI 模式的 runtime 检查语义。
- [x] 已明确 warning acknowledgement 只对当前 preflight fingerprint 有效。

### 契约任务

- [x] `packages/shared/src/types/pipeline.ts`：新增 `PipelineRunPreflightInput`。
- [x] `packages/shared/src/types/pipeline.ts`：新增 `PipelinePreflightAcknowledgement` 或等价字段。
- [x] `packages/shared/src/types/pipeline.ts`：新增 `PIPELINE_IPC_CHANNELS.RUN_PREFLIGHT`。
- [x] 明确 `PipelinePreflightRuntimeKind` 是否需要拆分 `codex-sdk-auth` / `codex-cli`。
- [x] 明确 warning code 白名单，拒绝前端传入未知 warning code。
- [x] `PipelineRunPreflightInput` 只暴露 `sessionId` / `workspaceId`，不允许 Renderer 传入任意 repository path 或 require override。

### 后端任务

- [x] `pipeline-service.ts`：新增 `runPreflight(input)`。
- [x] `pipeline-service.ts`：`start()` 解析 workspace session path 后执行服务端 preflight。
- [x] `pipeline-service.ts`：blocker 阻断 Graph invoke。
- [x] `pipeline-service.ts`：warning acknowledgement 与 fingerprint 不匹配时要求重新确认。
- [x] `pipeline-service.ts`：重复 / 未知 warning code 会阻断启动；服务端重写 acknowledgement 审计时间。
- [x] `pipeline-service.ts`：写入 Pipeline record 或 status/error record，便于审计。
- [x] `contribution-task-service.ts`：写入 `preflight_completed` event。
- [x] `pipeline-preflight-service.ts`：补齐 runtime 检查缺口和错误脱敏。
- [x] `pipeline-handlers.ts`：注册 `RUN_PREFLIGHT`。
- [x] `preload/index.ts`：暴露 `runPipelinePreflight()`。

### 前端任务

- [x] `pipeline-atoms.ts`：新增 `pipelinePreflightResultAtom`。
- [x] `pipeline-atoms.ts`：新增 warning acknowledgement atom。
- [x] 新增 `PipelinePreflightPanel.tsx`。
- [x] `PipelinePreflightPanel` 展示 Repository / Runtime / Package Manager / Blockers / Warnings。
- [x] `PipelineView.tsx` 或 `usePipelinePreflight()`：启动前自动运行 preflight。
- [x] blocker 禁用启动按钮。
- [x] blocker 修复后可通过 `PipelinePreflightPanel` 重新检查。
- [x] warning 需要用户明确“记录风险继续”。
- [x] preflight 早退不会清空用户输入。
- [x] 渠道 / 工作区错误仍能跳转设置页。
- [ ] preflight result 超过 60 秒或 workspace 变化后标记“需要刷新”。

### 测试任务

- [x] `pipeline-preflight-service.test.ts`：Git root 不存在。
- [x] `pipeline-preflight-service.test.ts`：非 Git root。
- [x] `pipeline-preflight-service.test.ts`：Git conflict blocker。
- [x] `pipeline-preflight-service.test.ts`：dirty worktree warning。
- [x] `pipeline-preflight-service.test.ts`：dirty 文件集合变化会改变 fingerprint。
- [x] `pipeline-preflight-service.test.ts`：remote URL query/hash token、Authorization / token diagnostic 脱敏。
- [x] `pipeline-preflight-service.test.ts`：Claude / Codex runtime 缺失。
- [x] `pipeline-service.test.ts`：start 遇 blocker 不调用 Graph。
- [x] `pipeline-service.test.ts`：warning acknowledgement 通过后可启动。
- [x] `pipeline-service.test.ts`：过期 fingerprint、重复 / 未知 warning code 不调用 Graph。
- [x] `pipeline-service.test.ts`：RUN_PREFLIGHT 忽略 renderer 传入的 repositoryRoot / require override。
- [x] `pipeline-service.test.ts`：`preflight_completed` event 二次脱敏且服务端生成审计时间。
- [x] `pipeline-preflight.test.ts`：渠道 / 工作区错误保持原行为。
- [x] `PipelinePreflightPanel.test.tsx`：blocker / warning / runtime status 展示。
- [x] `PipelineComposer.test.ts`：preflight 阻断或等待风险确认时不清空输入。

### 触达文件

- [x] `packages/shared/src/types/pipeline.ts`
- [x] `apps/electron/src/main/lib/pipeline-preflight-service.ts`
- [x] `apps/electron/src/main/lib/pipeline-service.ts`
- [x] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [x] `apps/electron/src/preload/index.ts`
- [x] `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- [x] `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts`
- [x] `apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [x] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts
```

```bash
bun run --filter='@codeinsights/electron' typecheck
git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [x] Renderer 启动前能显示 repository / runtime preflight 结果。
- [x] blocker 禁止启动，Service start 也会阻断。
- [x] warning 可以人工接受，接受记录可审计。
- [x] 服务端不会信任前端传回的旧 preflight result。
- [x] Renderer 不能通过 preflight IPC 探测任意本地路径。
- [x] preflight 错误不泄露 secret。
- [x] 受影响 package patch version 已递增。
- [x] 阶段 Review 已写入 `tasks/todo.md`。
- [x] 阶段提交完成。

### 禁止事项

- [x] 不绕过服务端 preflight。
- [x] 不把 warning 当 blocker 一概阻断。
- [x] 不在 Renderer 直接运行 shell 检查。
- [x] 不把真实 token、auth header、credentialed remote URL 写入 records。

## 2026-05-29 Pipeline v1 Phase 1 Review

- 阶段范围：Preflight 主路径；仅接入 repository preflight IPC / preload / Renderer / `PipelineService.start()` 守卫与 warning acknowledgement 审计。
- 主要变更：shared 新增 `PipelineRunPreflightInput`、`PipelinePreflightAcknowledgement`、`PipelinePreflightResult.checkedAt/fingerprint` 和 `RUN_PREFLIGHT`；main handler / preload 暴露 `runPipelinePreflight()`；`PipelineService.start()` 在 v2 会话进入 Graph 前服务端复验 preflight，blocker、未确认 warning 与过期 warning acknowledgement 均阻断；Renderer 新增 `PipelinePreflightPanel`、重新检查入口和 Jotai preflight state。
- 审计与安全：warning acknowledgement 只对最新 fingerprint 和 warning code 有效；匹配后由服务端重写 `acknowledgedAt` 并写入 `preflight_completed` ContributionTask event；fingerprint 纳入 HEAD / dirty status digest；RUN_PREFLIGHT IPC 不接受 renderer 路径 / require override；credentialed remote URL、query/hash token、Authorization / token / api key 形态诊断已脱敏。
- 兼容性确认：渠道 / 工作区配置错误仍走原 `resolvePipelineRunConfig()` 和设置跳转；旧 v1 会话不强制 repository preflight；未修改 Graph、runner、Git submission 或真实远端写路径。
- 验证命令：`bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项 / [!]：Phase 1 当时遗留的 preflight result 超过 60 秒或 workspace 变化后的“需要刷新”显式标记已在 Phase 2 收敛；Phase 3-6 仍未开始。
- 阶段提交：`ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`。

## Phase 2：PipelineView 拆分

### 阶段状态

- [x] 阶段开始
- [x] 测试先行完成
- [x] hooks 拆分完成
- [x] UI 行为回归完成
- [x] 验证完成
- [x] 阶段提交完成

### 目标

在保持行为不变的前提下，把 `PipelineView.tsx` 从全能组件拆成布局层 + hooks + side panel，降低后续功能叠加风险。

### 入口条件

- [x] Phase 1 已完成并提交。
- [x] 已列出现有 `PipelineView` 行为快照：records loading、document loading、gate respond、stop/restart、settings jump。
- [x] 明确本阶段不引入 Document Workbench 主体验。

### 拆分任务

- [x] 新增 `usePipelineSessionState(sessionId)` 的等价实现：`usePipelineSessionSnapshot.ts`。
- [x] 新增 `usePipelineRecords(sessionId)` 的等价实现：`usePipelineRecordsTail.ts`。
- [x] 新增 `usePatchWorkDocuments(sessionId, refs)` 的等价实现：`usePipelinePatchWorkDocuments.ts`。
- [x] 新增 `usePipelineGateActions(sessionId, pendingGate)` 的等价实现：`usePipelineGateActions.ts`。
- [x] 新增 `usePipelinePreflight(sessionId, workspaceId)` 的等价 freshness helper：`getPipelinePreflightRefreshState()` + `PipelinePreflightPanel`。
- [x] 新增 `PipelineGateSidePanel.tsx`。
- [x] `PipelineView.tsx` 只保留布局组合、状态传递和少量事件 wiring。
- [x] 保留现有 error display、failure card、live output、settings jump 行为。
- [x] 保留 stop 乐观状态和失败回滚行为。

### 测试任务

- [x] `usePipelineRecords`：session 切换不串数据。
- [x] `usePipelineRecords`：refresh 后按 cursor 追赶 records。
- [x] `usePatchWorkDocuments`：同 checksum 缓存、不重复读取。
- [x] `usePatchWorkDocuments`：session 切换清空旧 loading / error。
- [x] `usePipelineGateActions`：approve / reject / rerun / select task 参数正确。
- [x] `PipelineGateSidePanel`：按 gate kind 选择正确面板。
- [x] 现有 panel 测试全部通过。

### 触达文件

- [x] `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelineSessionSnapshot.ts`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelineRecordsTail.ts`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelinePatchWorkDocuments.ts`
- [x] `apps/electron/src/renderer/components/pipeline/usePipelineGateActions.ts`
- [x] `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts`
- [x] `apps/electron/src/renderer/components/pipeline/PipelineGateSidePanel.tsx`
- [x] 相关测试文件

### 验证命令

```bash
bun test apps/electron/src/renderer/components/pipeline/pipeline-gate-panel-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun install --frozen-lockfile --dry-run
git diff --check -- apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [x] `PipelineView.tsx` 不再直接包含 records tail loading 主体逻辑。
- [x] `PipelineView.tsx` 不再直接管理 patch-work document loading maps。
- [x] 所有现有 gate 面板行为保持。
- [x] stop/restart/gate respond 关键路径无回归。
- [x] 阶段 Review 已写入 `tasks/todo.md`。
- [x] 阶段提交完成。

### 禁止事项

- [x] 不重做视觉设计。
- [x] 不改变 Graph / service / runner 行为。
- [x] 不把局部 textarea feedback 放入全局 atom，除非明确要跨页面恢复草稿。

## 2026-05-29 Pipeline v1 Phase 2 Review

- 阶段范围：PipelineView 拆分与 Phase 1 preflight freshness 收敛；未修改 Graph、runner、Git submission、main IPC / preload、根 `README.md` 或根 `AGENTS.md`。
- 主要变更：`PipelineView` 迁出 records tail、session snapshot、patch-work 文档读取、explorer reports、gate actions 和 gate 面板选择；新增 `PipelineGateSidePanel` 作为右侧 gate / composer 组合层。
- Preflight 收敛：preflight result 超过 60 秒或 workspace 变化后会显示“启动前检查需要刷新”，隐藏风险确认入口，并阻止直接复用旧 acknowledgement。
- 版本同步：`@codeinsights/electron` 从 `0.0.123` 提升到 `0.0.124`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/renderer/components/pipeline/pipeline-gate-panel-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-tail-model.test.ts apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项：Patch-work Document Workbench、Contribution Dashboard / SubmissionPlan、远端写确认增强和真实端到端验收仍未开始。
- 阶段提交：`dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`。

## Phase 3：Patch-work Document Workbench

### 阶段状态

- [x] 阶段开始
- [x] read model 完成
- [x] Workbench MVP 完成
- [x] 面板接入完成
- [x] 验证完成
- [x] 阶段提交完成

### 目标

把 `plan.md`、`dev.md`、`review.md`、`result.md`、`patch-set/*`、`commit.md`、`pr.md` 从各面板内联 `<pre>` 升级为统一、可审计、可对比的 Document Workbench。

### 入口条件

- [x] Phase 2 已完成并提交。
- [x] 已确认本阶段 MVP 只读，不做用户编辑。
- [x] 已确认 revision 数据从现有 manifest / revision 存储读取，不破坏旧 manifest。

### 契约与后端任务

- [x] 新增 `PatchWorkDocumentRevision` 类型。
- [x] 新增 `LIST_PATCH_WORK_REVISIONS` IPC。
- [x] 新增 `READ_PATCH_WORK_REVISION` IPC。
- [x] `pipeline-patch-work-service.ts`：提供 list/read revision API。
- [x] 路径校验复用现有 patch-work 安全规则。
- [x] 读取 revision 时校验 checksum。
- [x] 读取当前文件时能标记是否与 manifest checksum 匹配。

### 前端任务

- [x] 新增 `PatchWorkDocumentWorkbench.tsx`。
- [x] 新增 `PatchWorkDocumentTree.tsx` 或等价文件分组 view model。
- [x] `.md` 使用 Markdown 渲染。
- [x] `.patch` 使用 diff 渲染。
- [x] `.json` 格式化展示，解析失败时显示原文和错误。
- [x] 展示 revision selector。
- [x] 展示 current / accepted badge。
- [x] 支持 compare current vs accepted。
- [x] 支持打开 patch-work 目录和打开当前文件。
- [x] `ReviewDocumentBoard` 接入 Workbench。
- [x] `TesterResultBoard` 接入 Workbench。
- [x] `CommitterPanel` 接入 Workbench。

### 测试任务

- [x] `pipeline-patch-work-service.test.ts`：list revisions。
- [x] `pipeline-patch-work-service.test.ts`：read revision checksum。
- [x] `pipeline-patch-work-service.test.ts`：拒绝 unsafe relativePath。
- [x] Workbench 测试：Markdown / patch / JSON 渲染分支。
- [x] Workbench 测试：revision selector 和 accepted badge。
- [x] 面板测试：缺 checksum / 读取失败仍阻止 approve。

### 验证命令

```bash
bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts
```

```bash
bun test apps/electron/src/renderer/components/pipeline/PatchWorkDocumentWorkbench.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx
```

```bash
bun run --filter='@codeinsights/electron' typecheck
bun run --filter='@codeinsights/electron' build:renderer
bun install --frozen-lockfile --dry-run
git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1
```

### 完成定义

- [x] 所有 patch-work 文档读取通过统一 Workbench。
- [x] 用户能查看 revision 列表。
- [x] 用户能对比 current 和 accepted revision。
- [x] `changes.patch` 有可读 diff 视图。
- [x] checksum mismatch 有明确提示。
- [x] 旧 manifest 仍可读。
- [x] 受影响 package patch version 已递增。
- [x] 阶段 Review 已写入 `tasks/todo.md`。
- [x] 阶段提交完成。

### 禁止事项

- [x] 不在 Renderer 直接读取本地文件。
- [x] 不提供编辑保存。
- [x] 不改变 patch-work manifest 结构，除非有迁移测试。

## 2026-05-29 Pipeline v1 Phase 3 Review

- 阶段范围：只完成 Phase 3，只读 Patch-work Document Workbench MVP；未修改 Graph、Claude / Codex runner、Git submission 真实写逻辑、远端写确认语义、根 `README.md` 或根 `AGENTS.md`。
- 主要变更：新增 `PatchWorkDocumentRevision`、`LIST_PATCH_WORK_REVISIONS`、`READ_PATCH_WORK_REVISION` 和受控 `OPEN_PATCH_WORK_FILE`；main 端通过 `sessionId + relativePath + revision` 读取 patch-work revision，复用 realpath / lstat / symlink 路径安全；当前文件 checksum 与 manifest 不一致时返回 `checksumMatches=false`。
- Workbench：新增 `PatchWorkDocumentWorkbench`，支持 markdown、patch/diff、json/text 展示、revision selector、current / accepted / checksum mismatch / read error badge、current vs accepted 对比、打开 patch-work 目录和打开当前文件。
- 面板接入：`ReviewDocumentBoard`、`TesterResultBoard`、`CommitterPanel` 已用统一 Workbench 替换重复内联 `<pre>` 文档展示；既有 approve 阻断逻辑仍使用 checksum、loading、read error、空正文等保守条件。
- 兼容性确认：不改变 `PatchWorkManifest.version` 和 manifest 结构；写新 revision 时保留已有 accepted revision 元数据，便于 Workbench 对比旧 accepted 与当前 revision。
- 版本同步：`@codeinsights/shared` 提升到 `0.1.52`，`@codeinsights/electron` 提升到 `0.0.125`，`bun.lock` 已同步。
- 验证命令：`bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`；`bun test apps/electron/src/renderer/components/pipeline/PatchWorkDocumentWorkbench.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`；`bun run --filter='@codeinsights/electron' typecheck`；`bun run --filter='@codeinsights/electron' build:renderer`；`bun install --frozen-lockfile --dry-run`；`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- 未完成项：Phase 4 Contribution Dashboard / SubmissionPlan、Phase 5 远端写确认增强、Phase 6 真实端到端验收仍未开始。
- 阶段提交：`4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`。

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

- [x] Phase 3 已完成并提交。
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

下一轮正式开发从 Phase 1 开始，推荐最小切片：

1. 新增 repository preflight IPC / preload / renderer 调用入口。
2. 接入 `PipelineView` 启动前 preflight 状态展示与 blocker 拦截。
3. 在 `PipelineService.start()` 增加服务端 preflight 守卫。
4. 不拆 `PipelineView`，不接入完整 Preflight Center，不改 runner / Graph。
5. 跑 Phase 1 聚焦测试、typecheck、diff check。
6. 阶段完成后单独提交。
