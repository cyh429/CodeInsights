# Pipeline v1 下一次 Codex 启动提示词

将下面整段复制给下一次启动的 Codex：

```text
你正在继续开发 CodeInsights 仓库的 Pipeline v1 优化计划。

工作目录：
/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前分支：
pipeline-improve

请先执行以下启动检查：
1. 读取 `tasks/lessons.md`，重点关注阶段完成即提交、Pipeline patch-work 路径安全、stop 后副作用、Tester Git 防护、Codex secret 注入和状态文档同步习惯。
2. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`。
3. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
4. 运行 `git status --short --branch` 和 `git log -7 --oneline`，确认当前分支状态；最近历史应包含：
   - `009ba970 docs(pipeline): 同步 Phase 3 后续开发状态`
   - `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`
   - `24562792 docs(pipeline): 补齐 Phase 2 最新恢复状态`
   - `6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`
   - `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`
   - `0102ed09 docs(pipeline): 同步 Phase 1 后续开发状态`
   - `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- Phase 0 清理与对齐已完成。
- Phase 1 Preflight 主路径已完成。
- Phase 2 PipelineView 拆分已提交为 `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`：`PipelineView` 已拆出 records tail、session snapshot、patch-work 文档读取、explorer reports、gate actions、gate panel model 和 `PipelineGateSidePanel`；preflight result 超过 60 秒或 workspace 变化后会显式标记“需要刷新”，并阻止复用旧 acknowledgement 直接启动。
- Phase 3 Patch-work Document Workbench 已提交为 `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`：新增 patch-work revision read model、LIST/READ revision IPC、受控打开文件入口、统一只读 Workbench，支持 markdown、diff、json/text、revision selector、current / accepted badge、checksum mismatch / read error，并已接入 ReviewDocumentBoard、TesterResultBoard、CommitterPanel。
- Phase 3 后续开发状态已同步为 `009ba970 docs(pipeline): 同步 Phase 3 后续开发状态`：development checklist、next-session prompt 和 `tasks/todo.md` Review 已标清 Phase 0-3 完成、Phase 4-6 未完成。
- Phase 4-6 尚未完成。

本次请从 Phase 4 开始：
Phase 4：Contribution Dashboard 与 Submission Plan。

Phase 4 范围：
1. 先在 `tasks/todo.md` 写 Phase 4 计划，明确只做 Contribution Dashboard 与 Submission Plan。
2. 遵循 TDD / BDD，先补测试再实现。
3. 新增 ContributionTaskSummary / PipelineSubmissionPlan read model 所需契约、IPC、preload 和 main service，Renderer 只能传 sessionId，main 端从 ContributionTask / patch-work / Git 状态重建只读模型。
4. 新增 ContributionTaskDashboard，展示 repo、branch、selected task、contribution mode、patch-work 状态、commit / PR 历史和最近事件。
5. 新增 SubmissionPlan 读取与 CommitterPanel 三段式提交计划展示；不改变真实 local commit / remote PR 执行服务。
6. 不修改 runner / Graph / Git submission，不新增真实 Git 写操作，不执行真实远端写。
7. 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。

Phase 4 推荐测试：
- main read model 测试：ContributionTaskSummary 包含 task、repo、branch、mode、patch-work、commit / PR 和最近事件。
- SubmissionPlan 测试：commit message、PR title/body、candidate files、excluded files、blockers、warnings、local / remote result。
- Renderer 测试：Dashboard 展示关键字段；CommitterPanel 三段式计划不改变本地 commit / remote PR 的现有 gate action。

Phase 4 推荐验证命令：
`bun test apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts`

`bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`

`bun run --filter='@codeinsights/electron' typecheck`

`bun install --frozen-lockfile --dry-run`

`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 只修改 Phase 4 相关文件。
- 如修改 shared 契约和 Electron 功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- 不 push、不创建 PR、不执行真实远端写。
- Phase 4 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
- Phase 4 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 4 完成后在 `tasks/todo.md` 追加 Review。
- Phase 4 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
