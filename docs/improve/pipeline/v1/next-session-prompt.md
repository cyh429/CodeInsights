# Pipeline v1 下一次 Codex 启动提示词

将下面整段复制给下一次启动的 Codex：

```text
你正在继续开发 CodeInsights 仓库的 Pipeline v1 优化计划。

工作目录：
/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前分支：
pipeline-improve

请先执行以下启动检查：
1. 读取 `tasks/lessons.md`，重点关注阶段完成即提交、Pipeline patch-work 路径安全、v2 前端可见性、结构化输出 fallback、stop 后副作用、Tester Git 防护、Codex secret 注入和状态文档同步习惯。
2. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-optimization-plan.md`。
3. 读取 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
4. 运行 `git status --short --branch` 和 `git log -5 --oneline`，确认当前分支状态；最近历史应包含：
   - `30399335 docs(pipeline): 同步 Phase 0 后续开发状态`
   - `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`
   - Phase 1 提交：`feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`（真实 hash 以 `git log -5 --oneline` 为准；也可以是其后的状态同步提交）
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- Phase 0 清理与对齐已提交为 `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`。
- Phase 0 后续状态同步已提交为 `30399335 docs(pipeline): 同步 Phase 0 后续开发状态`。
- Phase 1 Preflight 主路径已完成：新增 repository preflight IPC / preload API；Renderer 启动前展示 preflight panel，blocker 禁止启动但可重新检查，warning 需用户明确“记录风险继续”；`PipelineService.start()` 服务端复验 blocker / warning acknowledgement 并阻断 Graph invoke；warning acknowledgement 由服务端重写审计时间后写入 `preflight_completed` ContributionTask event；fingerprint 纳入 HEAD / dirty status digest；RUN_PREFLIGHT IPC 不接受 renderer 任意路径 / require override；remote URL query/hash / Authorization / diagnostic 已脱敏。
- Phase 2-6 尚未完成。

本次请从 Phase 2 开始：
Phase 2：PipelineView 拆分。

Phase 2 范围：
1. 在保持行为不变的前提下，把 `PipelineView.tsx` 从全能组件拆成布局层 + hooks + side panel。
2. 拆出 `usePipelineSessionState(sessionId)`、`usePipelineRecords(sessionId)`、`usePatchWorkDocuments(sessionId, refs)`、`usePipelineGateActions(sessionId, pendingGate)`、`usePipelinePreflight(sessionId, workspaceId)` 或等价 hook。
3. 拆出 `PipelineGateSidePanel.tsx` 或等价视图组件，按 gate kind 选择 Explorer / ReviewDocument / ReviewerIssue / Tester / Committer / 通用 Gate 面板。
4. 保持 Phase 1 preflight 行为：渠道 / 工作区错误仍跳设置，repository preflight 仍走 main IPC，blocker 可重新检查，warning acknowledgement 继续只对服务端最新 fingerprint 有效，preflight 早退不清空输入。
5. 不改 runner / Graph / Git submission，不新增真实 Git 写操作，不执行真实远端写。

Phase 2 推荐先写或更新测试：
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelineRecords.test.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePatchWorkDocuments.test.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelineGateActions.test.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelinePreflight.test.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineGateSidePanel.test.tsx`
- 保留并运行现有 Pipeline panel / Records / preflight 测试。

Phase 2 推荐触达文件：
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelineSessionState.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelineRecords.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePatchWorkDocuments.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelineGateActions.ts`
- `apps/electron/src/renderer/components/pipeline/hooks/usePipelinePreflight.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineGateSidePanel.tsx`
- 相关测试文件

Phase 2 验证命令：
`bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/ExplorerTaskBoard.test.tsx apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx apps/electron/src/renderer/components/pipeline/PipelineComposer.test.ts`

`bun run --filter='@codeinsights/electron' typecheck`

`git diff --check -- apps/electron tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 先在 `tasks/todo.md` 写 Phase 2 计划。
- 遵循 TDD / BDD，先补测试再实现。
- 只修改 Phase 2 相关文件。
- 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。
- 不安装依赖，除非用户明确要求并且先搜索确认版本。
- 不 push、不创建 PR、不执行真实远端写。
- 如修改功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- Phase 2 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 的状态。
- Phase 2 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 2 完成后在 `tasks/todo.md` 追加 Review。
- Phase 2 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
