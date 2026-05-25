# Agent Codex Runtime 下次启动提示词

把下面这段提示词直接发给下次启动的 Codex，会从当前进度继续。

```text
你正在继续开发 CodeInsights 的 Agent 模式 Codex Runtime 接入。

项目路径：/Users/zq/Desktop/ai-projs/posp/RV-Insights
当前分支：codex/agent-codex-runtime-phase-0

当前状态：
- 已完成需求调研、主方案、开发进度清单、文档索引、下次启动提示词、Phase 0 基线冻结和 Phase 1 共享类型与设置契约。
- 主方案与开发清单提交：feb46548 docs: 规划 Agent Codex Runtime 接入。
- Phase 0 提交：29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结。
- Phase 0 后状态同步提交：ecb84a81 docs: 同步 Agent Codex Runtime Phase 0 后续状态。
- Phase 1 提交：6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约。
- 最新文档状态同步提交请以 git log -1 --oneline 为准。
- 当前开发状态以 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 为准。
- 主方案在 docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md。
- 文档索引在 docs/codex-support/README.md。
- 产品决策门禁已确认，采用清单推荐值；以后无需再就同一组推荐值询问。
- Phase 2-8 尚未开始；下一步从 Phase 2：Codex Runtime Core 抽取开始。

已确认产品决策：
- Codex 首版接受无逐工具权限 UI，仅提供 sandbox 级权限说明。
- Codex 首版隐藏或禁用 rewind / fork / soft interrupt / queue message，并给出明确 tooltip。
- Agent Codex 默认认证来源使用本机 Codex auth / CODEX_API_KEY，不复用 Pipeline Codex channel。
- bypassPermissions 默认不允许 danger-full-access，必须单独高级开关。
- Codex 历史以 runtime events 为主数据。
- 首版允许仅使用 Codex 自身 MCP 配置，CodeInsights workspace MCP 映射后续单独验证。

请先执行：
1. 读取 AGENTS.md / 项目指令，并复习 tasks/lessons.md 中阶段完成即提交、Codex auth 隔离、Agent stop、runtime events、Git guard 相关教训。
2. 运行 git status --short 和 git log -1 --oneline，确认工作树状态和最新提交；不要回滚用户改动。
3. 读取 docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md 的“最新开发状态快照”、第 3 节 Phase 1 执行记录和第 4 节 Phase 2。
4. 在 tasks/todo.md 写入本轮 Phase 2 计划。
5. 启动 Phase 2 前，确认本轮只做 Codex Runtime Core 抽取，不混入 Phase 3 event adapter、Phase 5 Orchestrator runtime routing、Renderer UI 或真实 Codex 集成。

Phase 2 目标：
- 从 Pipeline Codex runner 中抽出可复用的 Codex binary、auth、env、command guard、channel resolution 能力。
- 新增 apps/electron/src/main/lib/codex-runtime/ 目录和对应测试。
- Pipeline runner 改为引用公共 core，但保持 Pipeline prompt、JSON Schema、节点结果解析和外部行为不变。
- 确认 API key 模式隔离 CODEX_HOME，native auth 模式只传明确 CODEX_HOME。
- 复用并加固 Git guard：不能只靠 PATH，也要清理 GIT_DIR / GIT_WORK_TREE / GIT_INDEX_FILE、阻断远端写和交互凭证。

Phase 2 推荐验证：
- bun test apps/electron/src/main/lib/codex-runtime
- bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts
- bun run --filter='@codeinsights/electron' typecheck
- git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts tasks/todo.md
- 若改动影响共享契约或更广行为，再补跑 bun test --isolate 或 bun run typecheck。

重要纪律：
- 每完成一个阶段并通过该阶段验证后，立即提交该阶段相关文件。
- 只 stage 本阶段相关文件，提交信息用详细中文，说明完成内容、验证结果和未包含的无关改动。
- 不修改 README.md 或 AGENTS.md，除非用户明确允许。
- Phase 2 只抽 Codex runtime core；不要实现 Codex event adapter、CodexAgentRuntime、Agent UI、真实 SDK runStreamed 接入或打包发布验证。
- 不把 Codex 当作普通 OpenAI Provider；目标是接入完整 Codex Coding Agent Runtime。
```
