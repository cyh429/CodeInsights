# Pipeline v1 下一次 Codex 启动提示词

将下面整段复制给下一次启动的 Codex：

```text
你正在继续维护 CodeInsights 仓库的 Pipeline v1 优化计划。

工作目录：
/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前分支：
pipeline-improve

请先执行以下启动检查：
1. 读取 `tasks/lessons.md`，重点关注阶段完成即提交、状态文档同步、Pipeline patch-work 路径安全、stop 后副作用、Tester Git 防护、Codex secret 注入、Report Export 只读脱敏和真实远端写 gated 规则。
2. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`。
3. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
4. 读取 `docs/improve/pipeline/v1/next-session-prompt.md`，确认本提示词没有要求从 Phase 6、Phase 7 或 Phase 8 功能开发重新开始。
5. 运行 `git status --short --branch` 和 `git log -12 --oneline`，确认当前分支状态；最近历史应包含：
   - `b1163b1f docs(pipeline): 同步最新开发状态和下次启动提示词`
   - `e77139fd docs(pipeline): 校正 Phase 8 最新恢复入口`
   - `7d309cc0 docs(pipeline): 回填 Phase 8 最新恢复状态`
   - `c79f6b48 docs(pipeline): 同步 Phase 8 后续开发状态`
   - `fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`
   - `b4ed7b1e docs(pipeline): 回填 Phase 7 最新恢复状态`
   - `1cbe1de7 docs(pipeline): 同步 Phase 7 后续开发状态`
   - `70b30ea3 feat(pipeline): 完成 Pipeline v1 Phase 7 报告导出 MVP`
   - `d007eb84 docs(pipeline): 回填 Phase 6 最新恢复状态`
   - `d71e13af docs(pipeline): 同步 Phase 6 后续开发状态`
   - `07243a01 feat(pipeline): 完成 Pipeline v1 Phase 6 本地验收准备`
   - `a6c558b1 feat(pipeline): 完成 Pipeline v1 Phase 5 远端写确认与 GitHub 增强`
   - `9b4c8837 docs(pipeline): 同步 Phase 4 后续开发状态`
   - `1ff8416a feat(pipeline): 完成 Pipeline v1 Phase 4 Contribution Dashboard`
   - `4cdcc128 feat(pipeline): 完成 Pipeline v1 Phase 3 Patch-work Workbench`
6. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- 最新开发基线是 `fb864d6a feat(pipeline): 完成 Pipeline v1 Phase 8 报告 HTML 与 PDF 导出`；最新已确认恢复入口是 `b1163b1f docs(pipeline): 同步最新开发状态和下次启动提示词`。
- Phase 0 清理与对齐已完成。
- Phase 1 Preflight 主路径已完成。
- Phase 2 PipelineView 拆分已完成。
- Phase 3 Patch-work Document Workbench 已完成。
- Phase 4 Contribution Dashboard 与 Submission Plan 已完成。
- Phase 5 远端写确认与 GitHub 增强已完成：独立 `remote_write_confirmation` gate、GitHub API / existing PR / push 成功 PR 失败恢复、`skipPush` ref 复验、`remote_write_confirmed` event 和脱敏行为已落地。
- Phase 6 真实端到端验收与交付准备已完成：新增 deterministic fixture runner、`pipeline-smoke.test.ts`、`smoke:pipeline-fixture` packaged smoke；本地 fixture 覆盖 draft-only、local commit 和 mock remote confirmation。
- Phase 7 Report Export Markdown MVP 已完成：新增 `EXPORT_REPORT` IPC / preload / service / Renderer 面板；报告可生成、复制、保存 `.md`，并从持久化 ContributionTask、events、records、stage artifacts 和 patch-work manifest 组装。
- Phase 8 Report Export HTML / PDF 增强已完成：报告返回同源安全 HTML，Renderer 可保存 `.html`，PDF 由 main 端按 `sessionId` 重新生成报告后通过受控 IPC 保存。

Phase 8 验收边界：
- HTML 从 Phase 7 的只读 Markdown 报告派生，不触发 graph、不执行 Git precondition、不调用真实远端写、不读取 token / GitHub 凭证。
- Renderer 保存 PDF 时只传 `sessionId`；main 端重新生成报告，不信任 Renderer 任意 HTML 或任意本地路径。
- HTML 输出转义用户 / 模型内容并中和 `on*=` 片段。
- PDF 渲染窗口关闭 nodeIntegration / webview / JavaScript，阻断导航和 http / https / file / ftp / ws / wss 子资源。
- Markdown、HTML、顶层 `title`、`.md` / `.html` / `.pdf` 文件名均需脱敏 credentialed URL、token、Authorization、短 Bearer token 和 JWT-like token。
- 报告读取缺失 `patch-work/` 或缺失 manifest 时不能创建目录；只返回可解释的缺失 / 读取失败状态。

Phase 7 验收边界：
- 报告导出不触发 graph、不执行 Git precondition、不调用真实远端写、不读取 token / GitHub 凭证。
- draft-only 报告明确不会创建本地 commit 或真实 PR。
- local commit 报告从已持久化 events / committer output 汇总 commit hash、候选文件和 `patch-work/**` 排除项。
- mock remote confirmation 报告从已持久化 events 汇总 `remote_write_confirmed` / `remote_submission_created` 审计信息，不把 mock runner smoke 说成真实模型或真实 GitHub remote 验收。
- Markdown、顶层 `title` 和 `fileName` 均需脱敏 credentialed URL、token、Authorization / Bearer 片段。

Phase 6 验收边界：
- draft-only 不产生 Git commit。
- local commit 只提交候选源码文件，`patch-work/**` 保持 excluded / untracked。
- mock remote path 必须经过独立 `remote_write_confirmation`，并记录 `remote_write_confirmed` / `remote_submission_created` 审计事件。
- 当前平台 unpacked packaged smoke 已通过 draft-only 和 local-commit 主路径。
- `[!]` 真实 GitHub remote PR smoke 未执行，因为没有用户明确授权。
- `[!]` DMG / installer、macOS x64、Windows x64、Linux packaged smoke 未在本机验证。
- 根 `README.md` / 根 `AGENTS.md` 尚未修改；只有用户明确允许公开文档同步后才能改。

Phase 6 已跑过的验证：
- `bun test apps/electron/src/main/lib/pipeline-graph.test.ts apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/src/main/lib/pipeline-git-submission-service.test.ts apps/electron/src/main/lib/pipeline-patch-work-service.test.ts apps/electron/src/main/lib/contribution-task-service.test.ts apps/electron/src/main/lib/pipeline-smoke.test.ts`，162 pass。
- `bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/RemoteWriteConfirmationPanel.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx`，32 pass。
- `bun run --filter='@codeinsights/electron' typecheck`。
- `bun install --frozen-lockfile --dry-run`。
- `bun run --filter='@codeinsights/electron' build`。
- `bun run --filter='@codeinsights/electron' pack`。
- `bun run --filter='@codeinsights/electron' smoke:pipeline-fixture`。

Phase 7 已跑过的验证：
- `bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`，61 pass。
- `bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx`，6 pass。
- `bun run --filter='@codeinsights/electron' typecheck`。
- `bun install --frozen-lockfile --dry-run`。
- `git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。
- `bun run --filter='@codeinsights/electron' build:renderer`。

Phase 8 已跑过的验证：
- `bun test apps/electron/src/main/lib/pipeline-read-model-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`，64 pass。
- `bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`，25 pass。
- `bun test apps/electron/src/renderer/components/pipeline/PipelineReportExportPanel.test.tsx apps/electron/src/renderer/components/pipeline/ContributionTaskDashboard.test.tsx`，6 pass。
- `bun run --filter='@codeinsights/electron' typecheck`。
- `bun install --frozen-lockfile --dry-run`。
- `bun run --filter='@codeinsights/electron' build:main`。
- `bun run --filter='@codeinsights/electron' build:preload`。
- `bun run --filter='@codeinsights/electron' build:renderer`。
- `git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`。

下一轮不要从 Phase 6、Phase 7 或 Phase 8 功能开发开始。根据用户目标选择入口：
1. 如果用户明确授权真实 GitHub remote smoke，先确认授权范围、测试仓库、token / `gh` / API 条件和允许的远端副作用；授权前不读取 token、不 push、不创建真实 PR。
2. 如果用户明确允许公开文档同步，再修改根 `README.md` / 根 `AGENTS.md`，建议同步 deterministic fixture smoke、真实 remote smoke gated、unpacked app smoke 不等于 DMG / installer / 多平台验收。
3. 如果用户要求继续产品能力开发，从 development checklist 的“后续积压池”单独开新阶段；先在 `tasks/todo.md` 写计划，遵循 TDD / BDD，再实现。不要重复实现 Markdown、HTML 或 PDF 报告导出。

执行纪律：
- 不 push。
- 不创建真实 PR。
- 不检查、读取或输出 token，除非用户明确授权相关 smoke。
- 不把 fake runner smoke 说成真实模型验收。
- 不把 unpacked app smoke 说成 DMG / installer 或多平台验收。
- 根 `README.md` 和根 `AGENTS.md` 只有在用户明确允许后才修改。
- 每次阶段性工作完成后，同步 development checklist、next-session prompt、`tasks/todo.md` Review 和 `tasks/lessons.md`，并单独提交状态更新。
```
