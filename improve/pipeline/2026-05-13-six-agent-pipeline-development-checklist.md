# CodeInsights Pipeline v2 阶段开发跟踪清单

> 日期：2026-05-13
> 适用范围：六 Agent 开源贡献 Pipeline v2。
> 依据文档：`improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`。
> 使用规则：后续 Codex 开发必须严格按本文阶段推进。未满足当前阶段完成定义前，不得进入后续阶段。

## 总体目标

将当前五节点 Pipeline 升级为六 Agent 开源贡献工作流：

```text
preflight
  -> explorer
  -> planner
  -> developer
  -> reviewer
  -> tester
  -> committer
```

目标交付不是一次性全自动提交社区，而是先完成安全、可审计、可恢复的本地贡献闭环，再逐步开放本地 commit 和远端 PR。

## 强制开发规则

- [ ] 每个阶段开始前，先在本文件对应阶段勾选“阶段开始”，并在 `tasks/todo.md` 写本阶段执行计划。
- [ ] 每个阶段必须先补测试或 BDD 场景，再实现功能。
- [ ] 每个阶段完成后，必须在本文件填写验证结果，并在 `tasks/todo.md` 追加 Review。
- [ ] 未通过本阶段“完成定义”前，不得进入下一阶段。
- [ ] 不得破坏 Pipeline v1 旧会话的打开、搜索、恢复和展示。
- [ ] 不得默认执行 `git commit`、`git push` 或创建 PR。
- [ ] 不得把 `patch-work/**` 默认加入 patch-set 或 commit。
- [ ] 不得引入本地数据库；继续使用 JSON、JSONL 和 manifest。
- [ ] 状态管理仍使用 Jotai。
- [ ] 命令使用 Bun：`bun run ...`、`bun test ...`。
- [ ] 修改功能代码时，受影响 package 的 patch 版本必须递增。
- [ ] README、AGENTS 等公开说明只有在用户明确允许后再同步修改。
- [ ] 所有新增注释和日志优先使用中文，保留必要英文术语。

## 状态标记

| 标记 | 含义 |
| --- | --- |
| `[ ]` | 未开始 |
| `[~]` | 进行中，后续提交时可临时改为文字说明 |
| `[x]` | 已完成，并已通过本阶段验证 |
| `[!]` | 阻塞，必须说明 blocker |

## 里程碑边界

| 里程碑 | 覆盖阶段 | 目标 | 是否允许进入下一里程碑 |
| --- | --- | --- | --- |
| MVP-A | Phase 0-3 | 贡献任务、preflight、patch-work、explorer 任务选择、planner 文档审核 | Phase 3 完成定义全部满足后 |
| MVP-B | Phase 4-6 | developer/reviewer/tester/committer draft-only 本地补丁闭环 | Phase 6 完成定义全部满足后 |
| MVP-C | Phase 7 | 受控本地 commit | Phase 7 完成定义全部满足后 |
| Remote | Phase 8 | 远端 PR 集成 | 需要单独安全评审 |

## 全局完成定义

Pipeline v2 总体完成前必须满足：

- [ ] 六 Agent 阶段轨道可展示并能按状态推进。
- [ ] `explorer / planner` 使用 Claude CLI 策略。
- [ ] `developer / reviewer / tester / committer` 使用 Codex CLI 策略。
- [ ] `ContributionTask`、Pipeline records、PatchWork manifest 三者 ID 能一致关联。
- [ ] `patch-work` 固定文件和 revision 能被 UI 读取。
- [ ] reviewer/tester 循环有上限和人工接管路径。
- [ ] committer 默认只生成 `commit.md` 和 `pr.md`。
- [ ] 本地 commit 和远端写操作都有独立人工 gate。
- [ ] 关键测试、类型检查和 fixture E2E 通过。

## Phase 0：规格冻结与测试骨架

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] 已阅读 Pipeline v2 分析文档。
- [x] 已确认本清单是后续开发的执行依据。
- [x] 本阶段不修改运行时代码，只允许补规格、测试骨架和 fixture 设计。

**开发任务**

- [x] 将核心状态机整理为 graph Mermaid 和状态表，必要时独立成 `docs` 或 `improve/pipeline` 文档。
- [x] 定义 BDD 场景清单：task selection、plan gate、dev gate、review loop、tester blocked、committer draft。
- [x] 设计 fixture repo，用于后续本地 Pipeline v2 E2E。
- [x] 明确 v1/v2 共存策略：旧会话默认 `version=1`，新贡献 Pipeline 使用 `version=2`。
- [x] 明确本阶段涉及 package version 是否需要变更；若仅文档可不变更。

**建议文件**

- [x] `improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md`
- [x] `improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md`
- [x] 后续可新增 `docs/pipeline-v2-spec.md`，但需确认文档同步范围。本阶段选择继续使用 `improve/pipeline` 文档，不修改 README / AGENTS。

**验证**

- [x] `git diff --check`
- [x] 关键章节可通过 `rg` 检索：`Phase 0`、`ContributionTask`、`patch-work`、`committer`。

**完成定义**

- [x] 规格明确回答每个节点 runtime、输入、输出、gate、失败循环和产物文件。
- [x] BDD 场景足以驱动后续测试先行开发。
- [x] 用户或维护者确认可以进入 Phase 1。

**禁止事项**

- [ ] 不改主进程 graph。
- [ ] 不改 shared 类型。
- [ ] 不改 UI 行为。

## Phase 1：Preflight、ContributionTask、PatchWork 基础

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 0 已完成。
- [x] 已确认本阶段目标是领域对象和文件契约，不扩展六节点 graph。

**开发任务**

- [x] 新增 `ContributionTask` 共享类型，包含 task id、session id、repo root、branch、mode、status、patchWorkDir。
- [x] 新增贡献任务索引服务，使用 `~/.codeinsights/contribution-tasks.json`。
- [x] 新增贡献任务 JSONL event 存储：`~/.codeinsights/contribution-tasks/{taskId}.jsonl`。
- [x] 新增 `pipeline-preflight-service.ts`。
- [x] preflight 检查 Git root、branch、remote、未提交变更、冲突、Claude CLI、Codex CLI、Git、包管理器。
- [x] 新增 `pipeline-patch-work-service.ts`。
- [x] 支持安全创建 `patch-work/manifest.json`。
- [x] 支持固定文件读写：`selected-task.md`、`plan.md`、`test-plan.md`、`dev.md`、`review.md`、`result.md`、`commit.md`、`pr.md`。
- [x] 支持 `patch-work/revisions/{node}/` 修订归档。
- [x] 支持原子写入：先写临时文件，再 rename 到正式路径。
- [x] 校验路径安全：禁止绝对路径、`..`、软链越界。

**建议文件**

- [x] `packages/shared/src/types/pipeline.ts`
- [x] `apps/electron/src/main/lib/pipeline-preflight-service.ts`
- [x] `apps/electron/src/main/lib/pipeline-patch-work-service.ts`
- [x] `apps/electron/src/main/lib/contribution-task-service.ts`
- [x] 对应测试文件。

**测试**

- [x] `bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`
- [x] `bun test apps/electron/src/main/lib/contribution-task-service.test.ts`
- [x] `bun test packages/shared/src/utils/pipeline-state.test.ts`

**完成定义**

- [x] 可以创建 `ContributionTask` 并持久化。
- [x] 可以在 fixture repo 安全创建 `patch-work`。
- [x] manifest 能记录文件 ref、checksum、revision 和更新时间。
- [x] 越界路径写入会失败。
- [x] preflight 能在 CLI 不可用、非 Git root、存在冲突时返回 blocker。
- [x] v1 Pipeline 行为未变化。

**禁止事项**

- [ ] 不将 `patch-work/**` 加入 commit 或 patch-set。
- [ ] 不修改 `.gitignore`。
- [ ] 不实现远端 GitHub 行为。

## Phase 2：Shared v2 类型与六节点状态机骨架

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 1 已完成。
- [x] `ContributionTask` 和 `patch-work` 文件契约已稳定。

**开发任务**

- [x] 为 Pipeline meta 增加 `version?: 1 | 2`。
- [x] `PipelineNodeKind` 增加 `committer`。
- [x] 新增或扩展 v2 stage output 类型：explorer reports、planner refs、developer devDoc、review issues、tester patchSet、committer submission。
- [x] 新增 gate kind：`task_selection`、`document_review`、`review_iteration_limit`、`test_blocked`、`submission_review`、`remote_write_confirmation`。
- [x] state replay 支持 v1/v2 分支。
- [x] LangGraph 新增 v2 fake graph 或 v2 builder，不替换 v1 graph。
- [x] 新增六节点 StageRail 的 display model 测试。
- [x] runner strategy 表驱动化：节点到 runtime 的映射明确可测。

**建议文件**

- [x] `packages/shared/src/types/pipeline.ts`
- [x] `packages/shared/src/utils/pipeline-state.ts`
- [x] `apps/electron/src/main/lib/pipeline-graph.ts`
- [x] `apps/electron/src/main/lib/pipeline-node-router.ts`
- [x] `apps/electron/src/renderer/components/pipeline/pipeline-display-model.ts`

**测试**

- [x] `bun test packages/shared/src/utils/pipeline-state.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-node-router.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/pipeline-display-model.test.ts`

**完成定义**

- [x] v1 records replay 不变。
- [x] v2 happy path 能从 explorer 推进到 committer。
- [x] tester approve 后不再直接 completed，而是进入 committer。
- [x] runtime strategy 明确显示 explorer/planner 为 Claude，developer/reviewer/tester/committer 为 Codex。
- [x] fake runner 测试可以覆盖六节点 graph。

**禁止事项**

- [ ] 不在此阶段接真实 CLI 复杂行为。
- [ ] 不做 UI 大改。
- [ ] 不开启真实 commit 或 push。

**验证结果（2026-05-14）**

- [x] Phase 2 指定测试通过：`pipeline-state.test.ts`、`pipeline-graph.test.ts`、`pipeline-node-router.test.ts`、`pipeline-display-model.test.ts`。
- [x] 补充验证通过：`pipeline-service.test.ts`、`pipeline-node-runner.test.ts`、`codex-pipeline-node-runner.test.ts`。
- [x] `bun run typecheck` 通过。
- [x] `git diff --check` 通过。
- [x] `bun install --frozen-lockfile --dry-run` 通过。
- [!] 全量 `bun test` 结果为 274 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 2 改动。
- [x] 本阶段未接真实 CLI 复杂行为，未做 UI 大改，未开启真实 commit / push / PR。

## Phase 3：Explorer 任务选择与 Planner 文档审核

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 2 已完成。
- [x] UI 能识别 v2 session 和六节点 stage。

**开发任务**

- [x] explorer 输出多份 Markdown 报告到 `patch-work/explorer/report-*.md`。
- [x] explorer structured output 返回 `ExplorerReportRef[]`。
- [x] 新增 task selection gate。
- [x] 用户选择 report 后生成或更新 `selected-task.md`。
- [x] planner 读取 `selected-task.md`。
- [x] planner 写 `plan.md` 和 `test-plan.md`。
- [x] planner gate 展示 Markdown 文档和 checksum。
- [x] gate feedback 能生成修订轮次。
- [x] UI 新增 `ExplorerTaskBoard`。
- [x] UI 新增或初步实现 `ReviewDocumentBoard`。
- [x] 新增 IPC：读取 patch-work manifest、读取 patch-work 文件、列 explorer reports、选择 task。

**建议文件**

- [x] `apps/electron/src/main/lib/pipeline-node-runner.ts`
- [x] `apps/electron/src/main/lib/pipeline-service.ts`
- [x] `apps/electron/src/main/ipc/pipeline-handlers.ts`
- [x] `apps/electron/src/preload/index.ts`
- [x] `apps/electron/src/renderer/components/pipeline/ExplorerTaskBoard.tsx`
- [x] `apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.tsx`
- [ ] `apps/electron/src/renderer/atoms/pipeline-atoms.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/ExplorerTaskBoard.test.tsx`
- [x] `bun test apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx`
- [x] `bun run typecheck`

**完成定义**

- [x] 用户可在 UI 看到多份 explorer 报告。
- [x] 用户必须选择一个 report 后才能进入 planner。
- [x] `plan.md` 和 `test-plan.md` 生成在 `patch-work/`。
- [x] 用户反馈会产生 planner revision。
- [x] 接受 planner 文档时记录 checksum。
- [x] MVP-A 的 explorer/planner 闭环成立。

**禁止事项**

- [x] 不让 explorer 或 planner 修改源码。
- [x] 不用 records 反推主业务状态，主 UI 走结构化 IPC。

## Phase 4：Developer 文档审核与 Reviewer Issue Loop

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 3 已完成。
- [x] planner 文档 gate 已能记录 accepted checksum。

**开发任务**

- [x] developer 必须读取 accepted `plan.md` 和 `test-plan.md`。
- [x] developer 完成源码修改后写 `dev.md`。
- [x] developer output 包含 changed files、diff summary、testsRun、risks。
- [x] developer 完成后新增 document gate，用户接受后才能进入 reviewer。
- [x] reviewer 读取 `dev.md`、Git diff 和测试方案。
- [x] reviewer 输出 `review.md` 和 stable issue ids。
- [x] reviewer 保持 read-only。
- [x] reviewer approved=false 且未达上限时自动回 developer。
- [x] 达到 review iteration 上限时进入人工 gate。
- [x] UI 增加 reviewer issue board 或在现有 board 中展示 severity/status。

**建议文件**

- [x] `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- [x] `apps/electron/src/main/lib/pipeline-graph.ts`
- [x] `apps/electron/src/main/lib/pipeline-service.ts`
- [x] `apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.tsx`
- [x] `packages/shared/src/types/pipeline.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/ReviewerIssueBoard.test.tsx`
- [x] `bun run typecheck`

**完成定义**

- [x] `dev.md` 固定生成，且 UI 可审核。
- [x] 用户接受 developer 文档后才进入 reviewer。
- [x] reviewer issue loop 可自动回 developer。
- [x] review iteration 有上限和人工接管。
- [x] reviewer 阶段不产生源码变更；若产生则标记失败。

**禁止事项**

- [x] reviewer 不直接修代码。
- [x] 不跳过 developer gate。
- [x] 不允许 reviewer 无限循环。

## Phase 5：Codex Tester、测试报告与 PatchSet

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 4 已完成。
- [x] developer/reviewer loop 已稳定。

**开发任务**

- [x] tester runtime 改为 Codex CLI 策略。
- [x] tester 必须读取 `test-plan.md`、`dev.md` 和 Git diff。
- [x] tester 运行测试方案中的命令。
- [x] tester 生成 `result.md`。
- [x] tester 生成 `patch-work/patch-set/changes.patch`。
- [x] tester 生成 `changed-files.json`、`diff-summary.md`、`test-evidence.json`。
- [x] patch-set 默认排除 `patch-work/**`。
- [x] 测试失败且可修复时回 developer。
- [x] 测试环境缺失时进入 `test_blocked` gate。
- [x] 测试未运行时不得直接进入 committer，除非用户接受风险。
- [x] UI 新增 `TesterResultBoard`。

**建议文件**

- [x] `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- [x] `apps/electron/src/main/lib/pipeline-git-submission-service.ts`
- [x] `apps/electron/src/main/lib/pipeline-patch-work-service.ts`
- [x] `apps/electron/src/renderer/components/pipeline/TesterResultBoard.tsx`
- [x] `packages/shared/src/types/pipeline.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx`
- [x] `bun run typecheck`

**完成定义**

- [x] tester 使用 Codex CLI 策略。
- [x] `result.md` 存在并包含测试结论、命令、通过项、失败项、阻塞。
- [x] patch-set 存在，且不包含 `patch-work/**`。
- [x] 测试失败路径可回 developer 或进入 blocked gate。
- [x] Phase 5 完成后可以进入 committer draft-only。

**禁止事项**

- [x] tester 不执行 commit、push、PR。
- [x] 不把环境失败当作测试通过。
- [x] 不把 `patch-work` 内部文档加入 patch。

## Phase 6：Committer Draft-Only

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 5 已完成。
- [x] patch-set、result.md 和 test evidence 已稳定。

**开发任务**

- [x] 新增 committer stage output 类型。
- [x] committer runtime 使用 Codex CLI 策略。
- [x] committer 读取 `result.md`、`patch-set/*`、CONTRIBUTING 和 Git 状态。
- [x] committer 生成 `commit.md`。
- [x] committer 生成 `pr.md`。
- [x] committer output 包含 commit message、PR title/body、blockers、risk。
- [x] submission gate 默认选项为“仅保存提交材料”。
- [x] UI 新增 `CommitterPanel`。
- [x] Git service 只提供 status/diff，不执行写操作。

**建议文件**

- [x] `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- [x] `apps/electron/src/main/lib/pipeline-git-submission-service.ts`
- [x] `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`
- [x] `packages/shared/src/types/pipeline.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`
- [x] `bun run typecheck`

**完成定义**

- [x] committer 可生成 `commit.md` 和 `pr.md`。
- [x] 默认不会执行本地 commit。
- [x] 默认不会执行 push 或创建 PR。
- [x] UI 清楚展示提交材料、风险和测试证据。
- [x] MVP-B 本地补丁闭环完成。

**禁止事项**

- [x] 不执行 `git add`。
- [x] 不执行 `git commit`。
- [x] 不执行 `git push`。
- [x] 不调用 GitHub 写 API。

**验证结果（2026-05-15）**

- [x] Phase 6 聚焦测试通过：150 pass。
- [x] runner 复核测试通过：54 pass。
- [x] `bun run typecheck` 通过。
- [x] `git diff --check` 通过。
- [x] `bun install --frozen-lockfile --dry-run` 通过。
- [!] 全量 `bun test` 结果为 362 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 6 改动。
- [x] 本阶段未开启真实 commit / push / PR，未默认将 `patch-work/**` 纳入 patch-set 或提交候选。

## Phase 7：受控本地 Commit Gate

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 6 已完成。
- [x] committer draft-only 行为已稳定。
- [x] 用户明确允许实现本地 commit 能力：2026-05-15 当前任务要求从 Phase 7 开始开发受控本地 Commit Gate。

**开发任务**

- [x] Git service 新增 `validateCommitPreconditions`。
- [x] Git service 新增受控 staging policy。
- [x] staging 默认排除 `patch-work/**`。
- [x] 本地 commit 前只读校验 `commit.md` / `pr.md` checksum，避免提交材料失效后仍创建真实 commit。
- [x] Git staging 使用 literal pathspec，防止特殊文件名扩大 stage 范围。
- [x] commit gate 展示 base branch、working branch、文件列表、排除列表、commit message、测试结论。
- [x] 用户确认后才执行 `git add` 和 `git commit`。
- [x] commit 后记录 commit hash。
- [x] commit result 写入 Contribution events。
- [x] commit 失败时保留 `commit.md`、`pr.md` 和错误信息。
- [x] 重试 commit 必须通过 operation id 防重复。

**建议文件**

- [x] `apps/electron/src/main/lib/pipeline-git-submission-service.ts`
- [x] `apps/electron/src/main/ipc/pipeline-handlers.ts`（沿用现有 `respondGate` 结构化 IPC，无需新增 handler）
- [x] `apps/electron/src/preload/index.ts`（沿用现有 `respondPipelineGate`，共享类型扩展自动透传）
- [x] `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`
- [x] `packages/shared/src/types/pipeline.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`
- [x] `bun test apps/electron/src/main/lib/pipeline-graph.test.ts`
- [x] `bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`
- [x] `bun run typecheck`

**完成定义**

- [x] 用户未确认时不会 commit。
- [x] 用户确认后可在 fixture repo 创建本地 commit。
- [x] commit 文件列表不包含 `patch-work/**`，除非用户显式选择。
- [x] 重复 resume 不会重复 commit。
- [x] MVP-C 完成。

**禁止事项**

- [x] 不实现 push。
- [x] 不创建 PR。
- [x] 不自动 stage 所有文件。

**验证结果（2026-05-15）**

- [x] Phase 7 聚焦测试通过：`pipeline-git-submission-service.test.ts`、`pipeline-patch-work-service.test.ts`、`pipeline-service.test.ts`、`pipeline-graph.test.ts`、`CommitterPanel.test.tsx` 共 80 pass。
- [x] shared state / ContributionTask 兼容测试通过：18 pass。
- [x] `bun run typecheck` 通过。
- [x] `git diff --check` 通过。
- [x] `bun install --frozen-lockfile --dry-run` 通过。
- [!] 全量 `bun test` 结果为 370 pass / 1 fail / 1 error；失败仍为既有 `apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` Electron named export 测试环境问题，未指向 Phase 7 改动。
- [x] 本阶段未开启 push / PR，未默认将 `patch-work/**` 纳入 patch-set 或 commit 候选。

## Phase 8：远端 PR 集成

**阶段状态**

- [x] 阶段开始
- [x] 阶段完成

**入口条件**

- [x] Phase 7 已完成。
- [x] 需要单独安全评审。
- [x] 用户明确允许实现远端写能力。
- [x] GitHub auth / token 存储方案已确认。

**开发任务**

- [x] 新增远端写 preflight：remote push URL、base/head branch、auth、权限、local commit hash。
- [x] remote write confirmation gate 二次确认。
- [x] push 前展示 remote、branch、commit hash。
- [x] PR 前展示 title、body、base、head、draft 状态。
- [ ] 支持只打开预填充 PR 页面作为低风险路径（首版暂不实现，后续可选增强）。
- [ ] 可选支持 GitHub API 创建 draft PR（首版使用本机 `gh` / git credential，不新增 token 存储）。
- [x] 远端提交结果写入 Contribution events。
- [x] 远端失败保留本地 commit、PR 草稿和错误信息。
- [x] 所有 token、Authorization header、remote credentials 日志脱敏。
- [x] 远端写拒绝 base/default 分支直推风险，且拒绝 `patch-work/**` 出现在待推送 commit tree 或 push range 历史中。

**建议文件**

- [x] `apps/electron/src/main/lib/pipeline-git-submission-service.ts`
- [ ] `apps/electron/src/main/lib/github-service.ts` 或等价服务（未新增，首版复用 Git submission service + `gh` CLI）。
- [ ] `apps/electron/src/main/ipc/pipeline-handlers.ts`（未新增通道，复用现有 gate response IPC）。
- [ ] `apps/electron/src/preload/index.ts`（未新增通道，复用现有 gate response IPC）。
- [x] `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`
- [x] `packages/shared/src/types/pipeline.ts`

**测试**

- [x] `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`
- [ ] `bun test apps/electron/src/main/lib/github-service.test.ts`（未新增 github-service）。
- [x] `bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`
- [x] `bun test apps/electron/src/main/lib/pipeline-service.test.ts`
- [x] `bun run typecheck`
- [x] 使用 mock runner 覆盖 GitHub 写路径，不直接打真实远端。

**完成定义**

- [x] 用户未二次确认时不会 push 或创建 PR。
- [x] 远端写操作有完整审计记录。
- [x] 失败可恢复，不丢本地 commit 和 PR 草稿。
- [x] 日志和 artifact 不泄露凭据。

**禁止事项**

- [x] 不默认开启远端写。
- [x] 不在没有二次确认时 push。
- [x] 不在测试中调用真实 GitHub 写接口。

## 跨阶段验证清单

每个阶段完成前都必须检查：

- [ ] `git diff --check`
- [ ] `bun run typecheck`
- [ ] 本阶段新增或修改的测试通过。
- [ ] v1 Pipeline 兼容测试通过。
- [ ] `patch-work/**` 未进入默认 patch-set。
- [ ] 没有默认远端写行为。
- [ ] records、Contribution events、manifest 的 session/task id 一致。
- [ ] gate 接受的文档有 checksum。
- [ ] reviewer/tester 循环有上限。
- [ ] 日志、records、artifact 未泄露 token、API key、SSH key 或 `.env` 内容。

## 进度记录

后续每完成一个阶段，在这里追加记录。

```text
阶段：
完成日期：
负责人：
主要变更：
验证命令：
剩余风险：
是否允许进入下一阶段：
```

```text
阶段：Phase 0 规格冻结与测试骨架
完成日期：2026-05-13
负责人：Codex
主要变更：补充 Phase 0 冻结确认，明确 fixture repo 设计、v1/v2 共存和 Phase 1 边界。
验证命令：git diff --check；rg -n "Phase 0|ContributionTask|patch-work|committer|flowchart TD|BDD 验收场景|节点输入输出契约" improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md
剩余风险：后续仍需用真实测试覆盖 Phase 1 服务契约。
是否允许进入下一阶段：是，进入 Phase 1。
```

```text
阶段：Phase 1 Preflight、ContributionTask、PatchWork 基础
完成日期：2026-05-13
负责人：Codex
主要变更：新增 ContributionTask 共享类型、贡献任务 JSON/JSONL 服务、preflight 服务、patch-work manifest/revision/固定文件服务和严格路径安全测试；同步 shared/electron package patch version 与 bun.lock workspace metadata。
验证命令：bun test apps/electron/src/main/lib/contribution-task-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/pipeline-preflight-service.test.ts packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts；bun run typecheck；git diff --check；bun install --frozen-lockfile --dry-run；bun test
剩余风险：全量 bun test 仍有 1 个既有失败，位于 apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts 的 Electron named export 测试环境问题，未指向 Phase 1 改动。
是否允许进入下一阶段：是，进入 Phase 2。
```

### Phase 2 完成记录

```text
阶段：Phase 2 Shared v2 类型与六节点状态机骨架
完成日期：2026-05-14
负责人：Codex
主要变更：新增 Pipeline version、committer 节点、v2 stage output / gate kind；state replay 按 v1/v2 分支处理 tester -> completed / tester -> committer；新增 createPipelineGraphV2 fake graph builder；runner strategy 表驱动化；StageRail display model 可按 v2 展示六节点。
审查修复：v2 explorer gate kind 明确为 task_selection；gate decision record 持久化 kind、selectedReportId、submissionMode。
验证命令：bun test apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-service.test.ts packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/pipeline-node-router.test.ts apps/electron/src/renderer/components/pipeline/pipeline-display-model.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts；bun run typecheck；git diff --check；bun install --frozen-lockfile --dry-run；bun test
剩余风险：全量 bun test 仍有 1 个既有失败 / 1 个对应 unhandled error，位于 apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts 的 Electron named export 测试环境问题，未指向 Phase 2 改动。
代码审查：复核通过，无阻塞 finding。
提交状态：已提交，commit `53119675ee4f975f463f7214d2b00a2ae9e0c4a5`（`feat(pipeline): 接入 Phase 2 六 Agent v2 骨架`）。
是否允许进入下一阶段：是，进入 Phase 3；但不得自动开始 Phase 3，需按阶段规则先写计划并等待用户安排。
```

```text
阶段：Phase 8 远端 PR 集成
完成日期：2026-05-15
负责人：Codex
主要变更：新增独立 remote_write_confirmation 高风险 gate；实现受控 git push + gh draft PR 创建；远端写 preflight 校验 push URL、GitHub repo、base/head branch、local commit hash、gh auth、remote base branch、patch-work tree/range；远端结果写入 Contribution events 和 committer stage output；支持 operation id 幂等、PR 已存在恢复、push 成功但 PR 失败后的 pushed 状态重试；统一脱敏 credentialed URL、Authorization、GitHub token 与 GH_TOKEN/GITHUB_TOKEN；CommitterPanel 展示远端目标、二次确认、成功/失败/可恢复状态。
验证命令：bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx；bun test packages/shared/src/utils/pipeline-state.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-node-runner.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx；bun run typecheck；git diff --check；bun install --frozen-lockfile --dry-run；bun test
剩余风险：全量 bun test 仍有 1 个既有失败 / 1 个对应 unhandled error，位于 apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts 的 Electron named export 测试环境问题，未指向 Phase 8 改动。首版使用本机 gh / git credential，不新增 token 存储；预填充 PR 页面和 GitHub API 创建路径留作后续可选增强。
提交状态：已提交，commit `906834a0`（`feat(pipeline): 完成 Phase 8 远端 PR 受控集成`）。
是否允许进入下一阶段：Phase 0-8 已完成；后续仅可在用户明确要求时执行真实远端写或进入新的改进阶段。
```

## 最新开发状态快照

> 更新时间：2026-05-16
> 最近阶段提交：Phase 8 远端 PR 受控集成，commit `906834a0`（`feat(pipeline): 完成 Phase 8 远端 PR 受控集成`）。
> 最新完成阶段：Phase 8 已完成。
> 当前分支状态：`base/pipeline-v0` 相对 `origin/base/pipeline-v0` ahead 16 commits；未执行 push / PR。

### 已完成

- [x] Phase 0：规格冻结与测试骨架。
- [x] Phase 1：Preflight、ContributionTask、PatchWork 基础。
- [x] Phase 1 已提交，提交范围不包含 `patch-work/**`，也没有前端功能变更。
- [x] Phase 1 已递增受影响 package patch version：`@codeinsights/shared`、`@codeinsights/electron`。
- [x] Phase 1 验证已记录：阶段测试、v1 graph 兼容测试、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 通过。
- [x] Phase 2：Shared v2 类型与六节点状态机骨架。
- [x] Phase 2 已提交，提交范围不包含 `patch-work/**`，未开启真实 commit / push / PR 能力。
- [x] Phase 2 已递增受影响 package patch version：`@codeinsights/shared`、`@codeinsights/electron`。
- [x] Phase 2 验证已记录：阶段测试、补充 service/runner 测试、代码审查复核、`bun run typecheck`、`git diff --check`、`bun install --frozen-lockfile --dry-run` 通过。
- [x] Phase 3：Explorer 任务选择与 Planner 文档审核。
- [x] Phase 3 已实现 patch-work manifest / 文件 / explorer reports / select-task IPC 与 preload 契约。
- [x] Phase 3 已实现 `ExplorerTaskBoard` / `ReviewDocumentBoard`，主 UI 通过结构化 IPC 读取 patch-work，不从 records 反推主业务状态。
- [x] Phase 3 已加固 explorer / planner：运行时只读工具约束、旧 explorer report 清理、受管文档 checksum 校验和未登记文件读取拒绝。
- [x] Phase 3 已提交，commit `881c7ad1`（`feat(pipeline): 完成 Phase 3 任务选择与文档审核`）。
- [x] Phase 3 前端可见性修复：新建 Pipeline 入口显式创建 v2 贡献会话，启动前自动创建 `ContributionTask` 和 `patch-work` manifest，确保 task selection / planner document gate 能从正常 UI 路径出现。
- [x] Phase 3 后续可用性修复已提交：
  - `e65f8ac2`（`fix(pipeline): 接通 v2 贡献 Pipeline 前端入口`）。
  - `71bcb1df`（`fix(pipeline): 容错 explorer 非 JSON 输出`）。
  - `364cf964`（`fix(pipeline): 增加停止运行的可见反馈`）。
  - `ffd1f309`（`fix(pipeline): 增加节点静默运行反馈`）。
- [x] Phase 4：Developer 文档审核与 Reviewer Issue Loop。
- [x] Phase 4 已实现 developer 读取 accepted `plan.md` / `test-plan.md`，输出 `dev.md` 并进入 developer 文档审核。
- [x] Phase 4 已实现 reviewer read-only issue loop：读取 accepted `dev.md`、输出结构化 issues 与 `review.md`，不通过未达上限自动回 developer，达到 3 轮进入人工接管 gate。
- [x] Phase 4 UI 已接入 developer document review 和 `ReviewerIssueBoard`，继续通过结构化 IPC 读取 patch-work 文档，不从 records 反推主业务状态。
- [x] Phase 4 已提交，commit `d10387cae3557ca57e3679f55c5ab48cd7e75766`（`feat(pipeline): 完成 Phase 4 开发审核与审查循环`）。
- [x] Phase 5：Codex Tester、测试报告与 PatchSet。
- [x] Phase 5 已提交，commit `aa08baf257fab43db6c9c30a106466f3b1629da1`（`feat(pipeline): 完成 Phase 5 Tester 结果与 patch-set 草稿闭环`），提交信息已包含详细中文说明。
- [x] Phase 5 已实现 tester 读取 accepted `test-plan.md` / `dev.md` 和最新 `review.md`，以 Codex workspace-write 运行测试和必要修复，并明确禁止 commit / push / PR。
- [x] Phase 5 已生成并登记 `result.md`、`patch-set/changes.patch`、`changed-files.json`、`diff-summary.md`、`test-evidence.json`，patch-set 默认排除 `patch-work/**`。
- [x] Phase 5 已实现测试失败 / 未运行进入 `test_blocked` gate，接受风险进入 committer draft-only，要求修订回 developer。
- [x] Phase 5 UI 已接入 `TesterResultBoard`，继续通过结构化 patch-work 文档读取，不从 records 反推主业务状态。
- [x] Phase 5 代码审查 hardening 已完成：禁用默认 `GIT_DIR` 阻断绝对路径 Git，运行前后校验 HEAD / refs / index / local config / 补丁丢弃，并修正 tester fallback `result.md` 的失败证据结论。
- [x] Phase 6：Committer Draft-Only。
- [x] Phase 6 已提交，commit `fab7f906f546e619157286ffb6fe40c869f1d3e2`（`feat(pipeline): 完成 Phase 6 提交材料草稿闭环`），提交信息已包含详细中文说明。
- [x] Phase 6 已实现 committer 读取 accepted `result.md`、`patch-set/*`、CONTRIBUTING 和 Git 状态，只生成 `commit.md` / `pr.md` 草稿。
- [x] Phase 6 已实现只读 Git submission context：status、diff 摘要、候选变更、分支、HEAD 和 CONTRIBUTING；读取 CONTRIBUTING 时拒绝 symlink 越界；不执行 Git / GitHub 写操作。
- [x] Phase 6 UI 已接入 `CommitterPanel`，继续通过结构化 patch-work 文档读取提交材料和测试证据，不从 records 反推主业务状态。
- [x] Phase 6 `submission_review` gate 默认且仅允许 `local_patch`：接受 `commit_doc` / `pr_doc` 并完成 ContributionTask，不开启本地 commit 或远端 PR；committer schema/parser 和 UI 会阻止非 `draft_only` 提交状态。
- [x] Phase 7：受控本地 Commit Gate。
- [x] Phase 7 已实现 `validateCommitPreconditions`、受控 staging policy 和 `createLocalPipelineCommit`，只有用户明确选择 `local_commit` 后才执行 `git add` / `git commit`。
- [x] Phase 7 staging 默认排除 `patch-work/**`，使用 literal pathspec 处理候选文件，如果 `patch-work/**` 已进入 Git index 会阻止 commit。
- [x] Phase 7 local commit 执行前会只读校验 `commit.md` / `pr.md` checksum，提交材料失效时不会先创建真实 commit。
- [x] Phase 7 已通过 operation id 记录本地 commit 结果，重复 resume 不会重复创建 commit；commit hash 会回填到 Contribution events 和 committer stage output。
- [x] Phase 7 UI 已接入 `CommitterPanel` 本地 commit 状态，展示分支、候选文件、排除项、测试证据和 commit result，仍通过结构化 patch-work 文档读取提交材料。
- [x] Phase 7 已单独提交，commit `d6da8380dc69e179c24d542d4a73cd1be90216cc`（`feat(pipeline): 完成 Phase 7 受控本地提交闭环`）。
- [x] Phase 8：远端 PR 集成。
- [x] Phase 8 已实现独立 `remote_write_confirmation` high-risk gate，不复用 Phase 7 `local_commit` gate。
- [x] Phase 8 已实现受控 `git push` + `gh pr create --draft`，必须在用户二次确认、operation id 未完成、local commit hash 可验证时执行；本会话未执行真实 push / PR。
- [x] Phase 8 已加固远端安全：实际 push URL 脱敏展示、`gh pr create --repo owner/repo`、拒绝 base/default 分支直推、校验 remote base branch、校验 `patch-work/**` 不在待推送 tree / history、错误统一脱敏。
- [x] Phase 8 已实现远端结果回填、失败审计、PR 已存在恢复和 push succeeded / PR failed 的 `pushed` 可重试状态。
- [x] Phase 8 已单独提交，commit `906834a0`（`feat(pipeline): 完成 Phase 8 远端 PR 受控集成`）。
- [x] 当前 `@codeinsights/shared` 版本为 `0.1.33`，`@codeinsights/electron` 版本为 `0.0.58`。

### 未完成

- [ ] 真实远端 push / PR 未执行；只有用户之后明确要求并通过 Phase 8 gate 才能执行。
- [ ] 预填充 PR 页面和 GitHub API 创建路径未纳入首版，留作后续可选增强。
- [ ] 既有全量测试失败尚未修复：`apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` 的 Electron named export 测试环境问题。
- [ ] README / AGENTS.md 未同步 Pipeline v2 最新功能；按用户规则，只有明确允许后才能修改。

### 当前边界

- Phase 0-8 已完成实现并已单独提交 Phase 8。
- Phase 8 只实现受控远端写能力代码；本会话不执行真实 push / PR。
- `patch-work/**` 仍不得默认加入 patch-set、commit、push 或 PR。
- README 和 AGENTS 不修改，除非用户明确允许。
- 不默认 push 或创建 PR，除非用户明确要求并通过 Phase 8 高风险 gate。

### 已知风险

- 全量 `bun test` 已运行，最新结果为 387 pass / 1 fail / 1 error；失败仍是 1 个既有失败 / 1 个对应 unhandled error：`apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts` 的 Electron named export 测试环境问题。该失败未指向 Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5 / Phase 6 / Phase 7 / Phase 8 或 Phase 3 后续 bugfix；后续仍需继续标注为既有风险，除非另行修复。

## 当前执行建议

Phase 8 已完成并作为本轮单独提交。后续建议优先修复既有全量测试环境问题，或在用户明确授权后进行真实远端写验证。仍不得执行 push / PR，除非用户之后明确要求真实远端写并通过 Phase 8 高风险 gate。

可选增强方向：

- 修复既有 `completion-signal.test.ts` Electron named export 测试环境问题，让全量 `bun test` 恢复绿色。
- 增加低风险“打开预填充 PR 页面”路径，避免直接创建远端 PR。
- 增强远端 preflight UI：展示 `gh auth`、remote、base/head branch、HEAD/commit hash、patch-work 防护检查结果。
- 如后续确实需要 GitHub API 创建 PR，再设计 token 管理、权限边界和独立安全评审。
- 增加已有 PR 的同步 / 更新流程，用于 review comments 后追加 commit 并更新 Draft PR。

## 后续启动提示词

```text
你正在 CodeInsights 仓库继续开发 Pipeline v2 六 Agent 开源贡献工作流。

请先阅读并遵守：
- AGENTS.md
- tasks/lessons.md
- tasks/todo.md
- improve/pipeline/2026-05-13-six-agent-pipeline-development-checklist.md
- improve/pipeline/2026-05-13-six-agent-contribution-pipeline-analysis.md 中“当前实现进度”

当前进度：
1. Phase 0-6 已完成并分别提交，Phase 6 commit 为 fab7f906f546e619157286ffb6fe40c869f1d3e2。
2. Phase 7 已完成并提交，commit 为 d6da8380dc69e179c24d542d4a73cd1be90216cc；已实现受控本地 Commit Gate，支持 local_commit 人工确认、受控 staging、默认排除 patch-work/**、operation id 幂等、commit hash 回填和 CommitterPanel 状态展示。
3. Phase 8 已完成并作为本轮单独提交，commit 为 906834a0；已实现独立 remote_write_confirmation 高风险 gate、受控 git push + gh draft PR、远端结果回填、operation id 幂等、push 成功/PR 失败可恢复、错误脱敏和 patch-work tree/range 远端防护。
4. 当前 @codeinsights/shared 版本为 0.1.33，@codeinsights/electron 版本为 0.0.58。
5. 当前分支 base/pipeline-v0 相对 origin/base/pipeline-v0 ahead 16 commits；未 push，未创建 PR。
6. 当前已知验证状态：Phase 8 核心聚焦测试 65 pass、周边兼容测试 147 pass、bun run typecheck、git diff --check、bun install --frozen-lockfile --dry-run 已通过；全量 bun test 最新结果为 387 pass / 1 fail / 1 error，失败仍为既有 completion-signal.test.ts Electron named export 测试环境问题。

开发纪律：
- 继续前先检查 git status，保护已有用户变更。
- 每个阶段必须先补测试或 BDD 场景，再实现功能。
- 每完成一个阶段并通过完成定义后，单独提交一次；重新启动 Codex 会话后也要主动延续这个纪律。
- 不得默认执行 git push 或创建 PR，除非用户明确要求真实远端写并完成 Phase 8 high-risk gate。
- 不得把 patch-work/** 默认加入 patch-set、commit、push 或 PR。
- 使用 Bun：bun test、bun run typecheck。
- 状态管理继续使用 Jotai。
- 本地存储继续使用 JSON / JSONL / manifest，不引入本地数据库。
- README 和 AGENTS.md 只有在用户明确允许后再修改。
- 完成功能代码变更时，递增受影响 package 的 patch 版本。

后续禁止事项：
- 未经用户明确确认和 gate，不执行真实 push 或创建 PR。
- 不得把 patch-work/** 默认加入 push 或 PR。
- 不得修改 README / AGENTS.md，除非用户明确允许。

建议下一步：
- 优先修复既有全量测试失败：apps/electron/src/main/lib/agent-orchestrator/completion-signal.test.ts 的 Electron named export 测试环境问题。
- 或者在用户明确授权后，按 Phase 8 high-risk gate 做真实远端写验证。
- 可选增强包括：低风险预填 PR 页面、远端 preflight UI、GitHub API PR 创建路径、已有 PR 同步 / 更新流程。
```
