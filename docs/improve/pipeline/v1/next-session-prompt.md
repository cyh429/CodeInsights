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
4. 运行 `git status --short --branch` 和 `git log -5 --oneline`，确认当前分支状态；最近历史应包含或晚于：
   - `ae5c85ba docs(pipeline): 完善 Pipeline v1 优化方案`
   - `3c754ac6 docs(pipeline): 新增 Pipeline v1 开发跟踪清单`
   - `3ce1402e docs(tasks): 同步阶段提交长期习惯`
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- 阶段提交习惯已写入 `tasks/lessons.md`。
- 业务代码实现尚未开始。
- Phase 0-6 均未完成。

本次请从 Phase 0 开始：
Phase 0：清理与对齐。

Phase 0 范围：
1. 修复 `PipelineRecords` v2 阶段过滤，让 `committer` 可见。
2. 修复 `pipeline-record-view-model` 的 artifact group 排序，让 v2 `committer` 排在 `tester` 后。
3. 保持 v1 旧会话五节点兼容，不显示 `committer` filter。
4. 新增 `openPipelinePatchWorkDir` IPC / preload / UI 入口，让 Tester / Committer 面板能打开 repo 内 `patch-work/`。
5. 检查 shared Pipeline 类型中的明显过期注释，只做必要清理。
6. 不改 Graph、不改 runner、不改 Git submission、不接入完整 Preflight Center。

Phase 0 推荐先写或更新测试：
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts`
- 如新增 service / IPC 行为，补 main 层聚焦测试。

Phase 0 推荐触达文件：
- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/main/ipc/pipeline-handlers.ts`
- `apps/electron/src/preload/index.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelineRecords.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.ts`
- `apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.ts`
- `apps/electron/src/renderer/components/pipeline/TesterResultBoard.tsx`
- `apps/electron/src/renderer/components/pipeline/CommitterPanel.tsx`

Phase 0 验证命令：
`bun test apps/electron/src/renderer/components/pipeline/PipelineRecords.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-view-model.test.ts apps/electron/src/renderer/components/pipeline/pipeline-record-experience-model.test.ts`

`bun run --filter='@codeinsights/electron' typecheck`

`git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 先在 `tasks/todo.md` 写 Phase 0 计划。
- 遵循 TDD / BDD，先补测试再实现。
- 只修改 Phase 0 相关文件。
- 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。
- 不安装依赖，除非用户明确要求并且先搜索确认版本。
- 不 push、不创建 PR、不执行真实远端写。
- 如修改功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- Phase 0 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 的状态。
- Phase 0 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 0 完成后在 `tasks/todo.md` 追加 Review。
- Phase 0 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
