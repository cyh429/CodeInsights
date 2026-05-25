# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights

当前状态：
- 已完成需求调研、主方案和开发进度清单。
- 主方案与开发清单已提交：feb46548 docs: 规划 Agent Codex Runtime 接入。
- 最新状态同步提交请以 git log -1 --oneline 为准。
- 当前开发状态应以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 主方案在 docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md。
- 文档索引在 docs/codex-support/README.md。
- 代码实现尚未开始：Phase 0-8 都未完成。
- 下一步必须从 Phase 0：基线冻结与实施准备 开始，不要直接进入 Phase 1 代码实现。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关教训。
2. 运行 git status --short，确认工作树状态；不要回滚用户改动。
3. 读取 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 的“最新开发状态快照”和 Phase 0。
4. 在 tasks/todo.md 写入本轮 Phase 0 计划。
5. 先处理产品决策门禁：如果用户未明确确认，就按清单推荐值执行 Phase 0 的基线验证，但不要开始 Phase 1 代码改动。

Phase 0 目标：
- 确认当前 Claude Agent、Pipeline Codex、runtime events 基线。
- 运行并记录：
  - bun run typecheck
  - bun test --isolate
  - bun run electron:build
  - git diff --check
- 记录当前 @openai/codex-sdk、@openai/codex、@anthropic-ai/claude-agent-sdk 版本。
- 记录 electron-builder 中 Codex / Claude binary 打包规则。
- 更新 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 和 tasks/todo.md。

重要纪律：
- 每完成一个阶段并通过该阶段验证后，立即提交该阶段相关文件。
- 提交前确认 git status，只 stage 本阶段相关文件。
- 提交信息使用详细中文，说明完成内容、验证结果和未包含的无关改动。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
