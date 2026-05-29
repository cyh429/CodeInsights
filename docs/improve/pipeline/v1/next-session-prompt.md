# Pipeline v1 下一次 Codex 启动提示词

将下面整段复制给下一次启动的 Codex：

```text
你正在继续开发 CodeInsights 仓库的 Pipeline v1 优化计划。

工作目录：
/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前分支：
pipeline-improve

请先执行以下启动检查：
1. 读取 `tasks/lessons.md`，重点关注阶段完成即提交、状态文档同步、Pipeline patch-work 路径安全、stop 后副作用、Tester Git 防护和 Codex secret 注入。
2. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`。
3. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
4. 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支状态；最近历史应包含：
   - `feat(pipeline): 完成 Pipeline v1 Phase 5 远端写确认与 GitHub 增强`
   - `9b4c8837 docs(pipeline): 同步 Phase 4 后续开发状态`
   - `1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`
   - `420da2b2 docs(pipeline): 补齐 Phase 3 状态同步入口`
   - `009ba970 docs(pipeline): 同步 Phase 3 后续开发状态`
   - `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`
   - `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`
   - `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- Phase 0 清理与对齐已完成。
- Phase 1 Preflight 主路径已完成。
- Phase 2 PipelineView 拆分已完成。
- Phase 3 Patch-work Document Workbench 已完成。
- Phase 4 Contribution Dashboard 与 Submission Plan 已完成：新增 ContributionTaskSummary / PipelineSubmissionPlan shared 契约、summary / submission plan IPC 与 preload API、`pipeline-read-model-service.ts`、`ContributionTaskDashboard`、summary / submission plan hooks，并将 `CommitterPanel` 改成“保存提交材料 / 本地 commit / Draft PR”三段式展示。
- Phase 4 read model 保持只读：Renderer 只传 `sessionId`；summary 读取缺失 `patch-work/` 时不会创建目录；SubmissionPlan 只运行本地 Git 读操作，不调用远端 preflight，不执行 `git commit` / `git push` / `gh`；`patch-work/**` 始终进入 excluded files；URL、error、blocker、warning 已脱敏。
- Phase 5 远端写确认与 GitHub 增强已完成：独立 `remote_write_confirmation` gate 已接入，提交面板 Draft PR 只进入确认态，`draft_only` 远端 PR 路径会先执行受控本地 commit，再进入远端确认；GitHub API / existing PR / push 成功 PR 失败恢复已落地，`skipPush` 会复验远端 head ref SHA，token / credentialed URL / Authorization 全链路脱敏。
- Phase 5 审计边界已完成：远端副作用前写入 `remote_write_confirmed` event；existing PR CLI fallback 使用 `gh pr list --repo ... --head ... --base ...`；GitHub API push 成功但 PR 创建失败会保留 `pushed` 状态；远端 PR 已创建但 graph resume 失败时保留 `remote_pr_created` 完成状态。
- Phase 6 尚未完成。

本次请从 Phase 6 开始：
Phase 6：真实端到端验收与交付准备。

Phase 6 范围：
1. 先在 `tasks/todo.md` 写 Phase 6 计划，明确 fixture repo、smoke、packaged smoke 和公开文档准备的测试边界。
2. 遵循 TDD / BDD，先补 smoke / fixture 测试，再实现。
3. 设计不依赖真实模型的 fixture repo 路径，覆盖 preflight、draft-only、local commit 和 remote mocked path。
4. 对需要真实 GitHub token 或真实远端写的 smoke，必须先得到用户明确授权。
5. 保持 Phase 5 的远端写确认、existing PR、`skipPush` ref 复验、`remote_write_confirmed` event 和脱敏行为在端到端路径中可审计，不绕过 `remote_write_confirmation`。
6. 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。

Phase 6 推荐测试：
- `pipeline-preflight` / fixture repo smoke：无需真实模型也能验证 preflight、draft-only 和 local commit 关键路径。
- `pipeline-service.test.ts`：端到端恢复、stop / resume / pending gate replay、phase 5 远端确认在完整链路中保持可审计。
- `RemoteWriteConfirmationPanel` 与 `CommitterPanel` 端到端交互：确认态、恢复态、existing PR 提示。
- 脱敏测试：token、credentialed URL、Authorization header 不出现在 records、events、diagnostics 或 UI read model。

Phase 6 推荐验证命令：
`bun test apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`

`bun test apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx`

`bun run --filter='@codeinsights/electron' typecheck`

`bun install --frozen-lockfile --dry-run`

`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 只修改 Phase 6 相关文件。
- Phase 6 如需要真实 remote smoke，必须先得到用户明确授权和凭证条件。
- 如修改 shared 契约和 Electron 功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- 不 push、不创建真实 PR。
- Phase 6 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
- Phase 6 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 6 完成后在 `tasks/todo.md` 追加 Review。
- Phase 6 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
