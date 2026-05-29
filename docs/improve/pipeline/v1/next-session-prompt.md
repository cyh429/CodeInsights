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
   - `172eaf3c docs(pipeline): 同步 Pipeline v1 最新开发状态`
   - `ae5c85ba docs(pipeline): 完善 Pipeline v1 优化方案`
   - `3c754ac6 docs(pipeline): 新增 Pipeline v1 开发跟踪清单`
   - `3ce1402e docs(tasks): 同步阶段提交长期习惯`
   - Phase 0 阶段提交，或其后的状态同步提交
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- 阶段提交习惯已写入 `tasks/lessons.md`。
- Phase 0 清理与对齐已完成：v2 Records `committer` filter 可见，v1 旧会话不显示 committer filter；artifact group 显式使用 version-aware 顺序；Tester / Committer 面板已能通过受控 IPC 打开 repo 内 `patch-work/`。
- Phase 1-6 尚未完成。

本次请从 Phase 1 开始：
Phase 1：Preflight 主路径。

Phase 1 范围：
1. 新增 repository preflight IPC / preload API，复用已有 `PipelinePreflightInput` / `PipelinePreflightResult` 和主进程 `runPipelinePreflight()` 能力。
2. Renderer 启动前展示 PreflightPanel 或等价视图，blocker 禁止启动，warning 需要用户明确接受风险后继续。
3. `PipelineService.start()` 服务端再次执行 preflight，blocker 必须阻断 Graph invoke，不能只依赖 Renderer。
4. warning acknowledgement 要可审计，至少写入 records 或 ContributionTask event。
5. 保持渠道 / 工作区错误仍能跳转设置页。
6. 不改 runner 执行逻辑，不新增真实 Git 写操作，不执行真实远端写。

Phase 1 推荐先写或更新测试：
- `apps/electron/src/main/lib/pipeline-preflight-service.test.ts`
- `apps/electron/src/main/lib/pipeline-service.test.ts`
- `apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts`
- `apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx`
- 如新增 read model / atoms，补对应聚焦测试。

Phase 1 推荐触达文件：
- `packages/shared/src/types/pipeline.ts`
- `apps/electron/src/main/ipc/pipeline-handlers.ts`
- `apps/electron/src/preload/index.ts`
- `apps/electron/src/main/lib/pipeline-preflight-service.ts`
- `apps/electron/src/main/lib/pipeline-service.ts`
- `apps/electron/src/renderer/atoms/pipeline-atoms.ts`
- `apps/electron/src/renderer/components/pipeline/PipelineView.tsx`
- `apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.tsx`
- `apps/electron/src/renderer/components/pipeline/pipeline-preflight.ts`

Phase 1 验证命令：
`bun test apps/electron/src/main/lib/pipeline-preflight-service.test.ts apps/electron/src/main/lib/pipeline-service.test.ts`

`bun test apps/electron/src/renderer/components/pipeline/pipeline-preflight.test.ts apps/electron/src/renderer/components/pipeline/PipelinePreflightPanel.test.tsx`

`bun run --filter='@codeinsights/electron' typecheck`

`git diff --check -- packages/shared apps/electron tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 先在 `tasks/todo.md` 写 Phase 1 计划。
- 遵循 TDD / BDD，先补测试再实现。
- 只修改 Phase 1 相关文件。
- 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。
- 不安装依赖，除非用户明确要求并且先搜索确认版本。
- 不 push、不创建 PR、不执行真实远端写。
- 如修改功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- Phase 1 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md` 的状态。
- Phase 1 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 1 完成后在 `tasks/todo.md` 追加 Review。
- Phase 1 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
