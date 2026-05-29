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
4. 运行 `git status --short --branch` 和 `git log -5 --oneline`，确认当前分支状态；最近历史应包含：
   - `6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`
   - `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`
   - `0102ed09 docs(pipeline): 同步 Phase 1 后续开发状态`
   - `ff515a01 feat(pipeline): 完成 Pipeline v1 Phase 1 Preflight 主路径`
   - `30399335 docs(pipeline): 同步 Phase 0 后续开发状态`
   - `ca1bcf77 feat(pipeline): 完成 Pipeline v1 Phase 0 清理与对齐`
5. 如果发现已完成但未提交的阶段成果，先提交该阶段成果，再继续开发。

当前真实进度：
- Pipeline v1 优化方案文档已完成。
- Pipeline v1 开发跟踪清单已完成。
- Phase 0 清理与对齐已完成。
- Phase 1 Preflight 主路径已完成。
- Phase 2 PipelineView 拆分已提交为 `dbd980c2 feat(pipeline): 完成 Pipeline v1 Phase 2 PipelineView 拆分`：`PipelineView` 已拆出 records tail、session snapshot、patch-work 文档读取、explorer reports、gate actions、gate panel model 和 `PipelineGateSidePanel`；preflight result 超过 60 秒或 workspace 变化后会显式标记“需要刷新”，并阻止复用旧 acknowledgement 直接启动。
- Phase 2 后续开发状态已同步为 `6c54f71b docs(pipeline): 同步 Phase 2 后续开发状态`。
- Phase 3-6 尚未完成。

本次请从 Phase 3 开始：
Phase 3：Patch-work Document Workbench。

Phase 3 范围：
1. 先在 `tasks/todo.md` 写 Phase 3 计划，明确只做 Patch-work Document Workbench MVP。
2. 遵循 TDD / BDD，先补测试再实现。
3. 新增 patch-work document revision / read model 所需契约、IPC、preload 和 main service 时，Renderer 只能传 sessionId / relativePath 等白名单字段，main 端必须复用 patch-work realpath / lstat / symlink 安全检查。
4. 新增统一 Workbench：支持 markdown、patch/diff、json/text 展示，显示 revision selector、current / accepted badge、checksum mismatch / read error。
5. 将 ReviewDocumentBoard、TesterResultBoard、CommitterPanel 接入 Workbench，但本阶段 MVP 保持只读，不提供编辑保存。
6. 不修改 runner / Graph / Git submission，不新增真实 Git 写操作，不执行真实远端写。
7. 不修改根 `README.md` / 根 `AGENTS.md`，除非用户明确允许。

Phase 3 推荐测试：
- `apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`：list/read revision、checksum mismatch、unsafe relativePath 拒绝。
- Workbench renderer 测试：Markdown / patch / JSON / text 展示、revision selector、accepted badge、checksum mismatch、read error。
- 面板回归测试：`ReviewDocumentBoard.test.tsx`、`TesterResultBoard.test.tsx`、`CommitterPanel.test.tsx`。

Phase 3 推荐验证命令：
`bun test apps/electron/src/main/lib/pipeline-patch-work-service.test.ts`

`bun test apps/electron/src/renderer/components/pipeline/ReviewDocumentBoard.test.tsx apps/electron/src/renderer/components/pipeline/TesterResultBoard.test.tsx apps/electron/src/renderer/components/pipeline/CommitterPanel.test.tsx`

`bun run --filter='@codeinsights/electron' typecheck`

`bun install --frozen-lockfile --dry-run`

`git diff --check -- packages/shared apps/electron bun.lock tasks/todo.md docs/improve/pipeline/v1`

执行纪律：
- 只修改 Phase 3 相关文件。
- 如修改 shared 契约和 Electron 功能代码，递增受影响 package patch version 并同步 `bun.lock`。
- 不 push、不创建 PR、不执行真实远端写。
- Phase 3 完成后更新 `docs/improve/pipeline/v1/2026-05-28-pipeline-mode-development-checklist.md`。
- Phase 3 完成后更新 `docs/improve/pipeline/v1/next-session-prompt.md`，让下一次 Codex 能从最新状态继续。
- Phase 3 完成后在 `tasks/todo.md` 追加 Review。
- Phase 3 完成并验证通过后，立即单独提交该阶段成果，提交信息必须使用详细中文，说明主要变更、验证结果和未做事项。
```
