# Agent 模式 Codex Runtime 开发进度清单

状态：Phase 0-8 主体实现、真实 smoke、文档发布和长期维护记录已完成并提交；Phase 7 channel API key smoke 暂缓，不再作为下次启动或 Phase 8 阻塞项；后续进入按需维护任务
日期：2026-05-26
主方案：[Agent 模式 Codex Runtime 接入开发方案](./2026-05-25-agent-codex-runtime-integration-plan.md)
下次启动提示词：[Agent Codex Runtime 下次启动提示词](./next-session-prompt.md)

## 0. 使用方式

本清单用于跟踪 Agent 模式新增 Codex runtime 的迭代开发进度。每个阶段完成后，应更新本文件对应 checkbox、补充验证证据，并在 `tasks/todo.md` 追加阶段 Review。若阶段产生代码改动，按项目规则完成该阶段验证后单独提交。

状态约定：

- `[ ]` 未开始
- `[~]` 进行中，提交前应改回 `[ ]` 或 `[x]`
- `[x]` 已完成并通过该阶段验收
- `[!]` 阻塞，需要用户决策或外部条件

执行原则：

- Claude Code 现有路径必须始终可回滚、可对照。
- Codex 首版只承诺完整 Codex runtime 接入，不承诺 Claude 权限、rewind、queue、fork 等能力完全等价。
- Agent Codex 设置与 Pipeline Codex 设置分离。
- Codex 会话历史以 runtime events 为主数据，不长期伪造成 Claude SDKMessage。
- 所有真实 Codex 集成验证必须和 mock 单测分离，默认 CI 不依赖本机登录或真实 API key。

## 0.1 最新开发状态快照

更新时间：2026-05-27 Phase 8 文档提交后

当前结论：

- [x] 需求理解与方案调研已完成。
- [x] Agent Codex Runtime 主方案已完成并提交：`feb46548 docs: 规划 Agent Codex Runtime 接入`。
- [x] 开发进度跟踪清单已完成并提交：`feb46548 docs: 规划 Agent Codex Runtime 接入`。
- [x] Codex support 文档索引已建立。
- [x] 最新状态同步文档已建立：`c546bc4e docs: 同步 Agent Codex Runtime 开发状态`。
- [x] 阶段完成即提交的长期纪律已记录到 `tasks/lessons.md`。
- [x] 产品决策门禁已确认，见第 1 节；采用清单推荐值作为后续实现默认策略。
- [x] Phase 0 基线冻结与实施准备已完成并提交：`29e48a93 docs: 完成 Agent Codex Runtime Phase 0 基线冻结`。
- [x] Phase 1 共享类型与设置契约已完成、通过验证并提交：`6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约`。
- [x] Phase 2 Codex Runtime Core 抽取已完成、通过验证并提交：`f04d893c refactor(codex): 抽取 Codex Runtime Phase 2 core`。
- [x] Phase 3 Codex Event Adapter 已完成、通过验证并提交：`98914a42 feat(agent): 完成 Codex Runtime Phase 3 事件适配`。
- [x] Phase 4 CodexAgentRuntime Mock 接入已完成、通过验证并提交：`2c7ebb94 feat(agent): 完成 Codex Runtime Phase 4 mock runner`。
- [x] Phase 5 Orchestrator Runtime Routing 已完成、通过验证并提交：`40441fe8 feat(agent): 完成 Codex Runtime Phase 5 编排路由`。
- [x] Phase 6 Renderer 设置、历史与 UX 已完成、通过验证并提交：`58164e35 feat(agent): 完成 Codex Runtime Phase 6 渲染端接入`。
- [x] Phase 7 真实 Codex SDK / CLI 接入、打包验证和 smoke 记录已执行并提交：`1b94f9ad test(agent): 完成 Codex Runtime Phase 7 真实集成验证`。
- [x] Phase 7 smoke 补跑状态已同步并提交：`a02cbbf5 docs(agent): 同步 Codex Runtime Phase 7 smoke 补跑状态`。
- [x] 最新开发状态文档已固化：`4e210364 docs(agent): 固化 Codex Runtime 最新开发状态`。
- [x] Phase 7 native config 修正与成功路径补跑已完成并提交：`a439d541 test(agent): 修正 Codex native smoke 中转配置`。
- [x] Phase 7 native / read-only / workspace-write / resume / web-search 成功路径补跑通过：修正 smoke 隔离逻辑后会复制 `~/.codex/config.toml` 中的中转 API 配置，并尊重其中 `model_reasoning_effort = "xhigh"`；native thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932` 终态 `run_completed`，read-only / workspace-write / resume / web-search 均通过。
- [x] Phase 7 history reload fixture-based packaged UI reload smoke 已完成并提交：`79c7fc92 test(agent): 补齐 Codex history reload UI smoke`。
- [x] Phase 7 history reload fixture-based packaged UI reload smoke 通过：新增 packaged app UI smoke，使用隔离 `CODEINSIGHTS_CONFIG_DIR` 预置 Codex 会话与 active tab，启动 `out/mac-arm64/CodeInsights.app` 两次并通过 CDP 确认真实 UI 展示历史标题、用户消息和 Codex assistant 消息；会话 `history-reload-smoke-4f4c4be2`。该验证覆盖重开后的 main/preload/renderer 读取与渲染链路，不替代真实 Codex 写入链路验证。
- [x] Phase 7 CodeInsights workspace MCP 到 Codex 原生配置注入已完成并提交：`dae13cd7 feat(agent): 完成 Codex workspace MCP 注入`。Agent Codex runtime 会把工作区 enabled stdio/http MCP 映射到 SDK `config.mcp_servers`；stdio env 使用 `env_vars`、HTTP headers 使用 `env_http_headers`，真实 secret 通过 Codex 子进程 env 间接注入而不进入 SDK `--config` argv；workspace MCP env 不能覆盖 Git guard/base env，HTTP header name 暂限 SDK-safe bare key；`mcp.config-injection` smoke 通过，Codex CLI `mcp list --json` 可识别生成的 stdio/http 原生配置。
- [x] 最新状态同步已提交：`525327cd docs(agent): 同步 Codex Runtime 最新开发状态`。
- [x] Phase 7 API key 残余复核记录已完成并提交：`217ed1f0 docs(agent): 记录 Codex API key smoke 残余复核`。
- [x] 最新进度同步已提交：`7467ab24 docs(agent): 同步 Codex Runtime 最新进度`。
- [x] Phase 7 API key 最终残余复核已完成并提交：`b2d8bc5f docs(agent): 记录 Codex API key 最终残余复核`。
- [x] 最新状态同步已提交：`d989ae4f docs(agent): 同步 Codex Runtime 最新状态`。
- [x] Phase 7 channel API key smoke 暂缓提示词更新已提交：`2cd195b1 docs(agent): 暂缓 Codex API key smoke`。
- [!] Phase 7 channel API key smoke 暂缓：2026-05-27 用户明确要求暂时不做“若提供 `CODEX_SMOKE_API_KEY` 则补跑 / 若未提供则记录阻塞”两项；保留为已知未完成验证，不默认读取 ambient `OPENAI_API_KEY`，不再阻塞 Phase 8 启动。
- [x] Phase 8 文档发布和长期维护记录已完成并提交：`d04ffb95 docs(agent): 完成 Codex Runtime Phase 8 文档`。主方案、真实 smoke、SDK / CLI 升级兼容、已知限制、故障排查和发布说明草稿均已回填到 Codex support 文档。

当前仓库状态要求：

- 下次启动时先运行 `git status --short`，确认是否仍是干净工作树。
- 若发现未提交改动，先识别是否属于用户改动或上次阶段残留，不要自动回滚。
- 最新已记录阶段提交为 `d04ffb95 docs(agent): 完成 Codex Runtime Phase 8 文档`；下次启动时以 `git log -1 --oneline` 为准。
- 下次启动时若仍看到 `apps/electron/out/` 未跟踪，这是本地打包产物，不应默认 stage / commit。
- 下一步不再优先补跑 channel API key smoke；除非用户重新明确要求，否则把它作为已知暂缓项，后续维护优先处理真实模型 MCP tool-call smoke、多平台 packaged binary 验证、SDK / CLI 升级复核或公开文档同步确认。

下一步入口：

1. 暂缓 channel API key smoke：即使环境里出现 `CODEX_SMOKE_API_KEY`，也不要在下次启动时主动补跑，除非用户重新明确要求。
2. 继续保持安全边界：不得默认读取 ambient `OPENAI_API_KEY`，不得把 skipped 伪造成 passed。
3. Phase 8 已完成文档同步；下一步维护重点是按需补齐暂缓的 channel API key smoke、真实模型 MCP tool-call smoke、多平台 packaged binary 验证和公开 README/AGENTS 同步确认。

最新验证记录：

- [x] Markdown code fence 检查通过。
- [x] 文档相对链接检查通过。
- [x] 开发清单必备章节检查通过。
- [x] Phase 1 验证通过：`bun test packages/shared`。
- [x] Phase 1 验证通过：`bun test apps/electron/src/main/lib/settings-service.test.ts`。
- [x] Phase 1 验证通过：`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`。
- [x] Phase 1 完整测试通过：`bun test --isolate`，522 pass / 0 fail。
- [x] Phase 1 类型检查通过：`bun run typecheck`。
- [x] Phase 1 diff 空白检查通过：`git diff --check`。
- [x] Phase 2 验证通过：`bun test apps/electron/src/main/lib/codex-runtime`，18 pass / 0 fail。
- [x] Phase 2 验证通过：`bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`，30 pass / 0 fail。
- [x] Phase 2 类型检查通过：`bun run --filter='@codeinsights/electron' typecheck`。
- [x] Phase 2 diff 空白检查通过：`git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/package.json tasks/todo.md`。
- [x] Phase 2 代码审查复审通过：无 Critical / High / Medium findings。
- [x] Phase 2 补充验证：`bun test --isolate` 跑到 540 个用例时仅 `pipeline-git-submission-service` 一个 before/after hook 偶发超时；该文件单独重跑 `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts`，21 pass / 0 fail，未指向本阶段改动。
- [x] Phase 3 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`，13 pass / 0 fail。
- [x] Phase 3 验证通过：`bun test packages/shared/src/agent/runtime-events.test.ts`，14 pass / 0 fail。
- [x] Phase 3 类型检查通过：`bun run --filter='@codeinsights/electron' typecheck`。
- [x] Phase 3 diff 空白检查通过：`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md`。
- [x] Phase 4 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`，13 pass / 0 fail。
- [x] Phase 4 验证通过：`bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`，4 pass / 0 fail。
- [x] Phase 4 类型检查通过：`bun run --filter='@codeinsights/electron' typecheck`。
- [x] Phase 4 diff 空白检查通过：`git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime apps/electron/package.json tasks/todo.md tasks/lessons.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md`。
- [x] Phase 5 验证通过：`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`，6 pass / 0 fail。
- [x] Phase 5 验证通过：`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`，16 pass / 0 fail。
- [x] Phase 5 补充验证通过：`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts`、`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`、`bun test packages/shared`。
- [x] Phase 5 类型检查通过：`bun run --filter='@codeinsights/electron' typecheck`。
- [x] Phase 5 diff 空白检查通过：`git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc packages/shared tasks/todo.md tasks/lessons.md`。
- [x] Phase 6 验证通过：`bun test apps/electron/src/renderer`，127 pass / 0 fail。
- [x] Phase 6 主进程 gate 验证通过：`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`，7 pass / 0 fail。
- [x] Phase 6 shared 验证通过：`bun test packages/shared`，36 pass / 0 fail。
- [x] Phase 6 类型检查通过：`bun run --filter='@codeinsights/electron' typecheck`。
- [x] Phase 6 diff 空白检查通过：`git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/renderer tasks/todo.md`。
- [x] Phase 6 feature flag 构建 smoke 通过：`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer`；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`。
- [x] Phase 7 类型检查通过：`bun run typecheck`。
- [x] Phase 7 完整测试通过：`bun test --isolate`，600 pass / 0 fail。
- [x] Phase 7 Electron 构建通过：`bun run electron:build`。
- [x] Phase 7 打包通过：`CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`，生成 macOS arm64 DMG。
- [x] Phase 7 binary smoke 通过：`binary.darwin-arm64` 输出 `codex-cli 0.130.0`。
- [x] Phase 7 stop smoke 通过：`stop.long-run` 最终终态 `run_stopped`。
- [x] Phase 7 packaged app smoke 通过：app bundle 内 Codex native binary 和 CLI wrapper 均输出 `codex-cli 0.130.0`，packaged app 使用隔离配置目录启动 8 秒未退出。
- [x] Phase 7 native smoke 通过：`native-auth.readonly` 返回 `codeinsights-codex-native-ok`，thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932`，终态 `run_completed`。
- [x] Phase 7 read-only smoke 通过：`readonly-plan.no-write` 保持文件未修改，thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5`，终态 `run_completed`。
- [x] Phase 7 workspace-write smoke 通过：`workspace-write.file-edit` 只改目标文件为 `phase7 workspace write ok`，thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d`，终态 `run_completed`。
- [x] Phase 7 resume smoke 通过：`resume.context` 第二轮返回口令，thread `019e63a6-5806-7013-a8af-651efad3ffe5`，终态 `run_completed`。
- [x] Phase 7 web-search smoke 通过：`web-search.current-support` 返回 npm 最新版本 `0.133.0`，thread `019e63a7-0b84-7993-bf33-028d39b15593`，终态 `run_completed`。
- [x] Phase 7 history reload fixture-based packaged UI reload smoke 通过：`bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui` 启动 packaged app 两次，均通过 CDP 确认 `History Reload Smoke 4f4c4be2`、`codeinsights-history-user-4f4c4be2`、`codeinsights-history-assistant-4f4c4be2` 出现在真实 UI。
- [x] Phase 7 MCP config injection smoke 通过：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only mcp`，`mcp.config-injection` passed，Codex CLI `mcp list --json` 可识别 CodeInsights workspace MCP 映射出的 stdio/http `mcp_servers` 配置。
- [!] Phase 7 channel API key smoke 因未设置 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY` 仍 skipped；2026-05-26 本轮已复核同一命令路径，脚本按预期 skipped。

## 0.2 当前完成/未完成总览

| 类别 | 状态 | 说明 |
| --- | --- | --- |
| 需求理解 | [x] | 已确认 Codex 是 Coding Agent Runtime，不是普通 Provider |
| 主方案 | [x] | 已覆盖架构、契约、事件、auth/env、权限、UI、测试、回滚 |
| 开发清单 | [x] | 已拆 Phase 0-8，支持后续逐阶段打勾推进 |
| 下次启动提示词 | [x] | 已同步为 Phase 8 后续维护入口 |
| 产品决策 | [x] | 用户已确认采用第 1 节推荐值；后续无需再次询问同一门禁 |
| Phase 0 | [x] | 基线冻结和验证已完成，未开始功能改动 |
| Phase 1 | [x] | 已完成 shared/settings/session 契约并提交 `6127b46c` |
| Phase 2 | [x] | 已完成 Codex runtime core 抽取并提交 `f04d893c` |
| Phase 3 | [x] | 已完成 Codex event adapter 与 fixtures 并提交 `98914a42` |
| Phase 4 | [x] | 已完成 CodexAgentRuntime mock、SDK client factory 与 permission policy 并提交 `2c7ebb94` |
| Phase 5 | [x] | 已完成 Orchestrator runtime routing、runtime registry、Codex mock 路由与 stop/complete 竞态防护并提交 `40441fe8` |
| Phase 6 | [x] | 已完成 Renderer 设置、runtime transcript 回放、feature flag 与 Codex UX 禁用态 |
| Phase 7 实现与打包验证 | [x] | 已接入真实 Codex runtime、完成打包与 smoke 记录并提交 `1b94f9ad` |
| Phase 7 成功路径补跑 | [!] | native / workspace-write / read-only / resume / web-search 已通过；history reload fixture-based packaged UI reload smoke 已通过；workspace MCP injection 已提交 `dae13cd7` 且 config smoke 已通过；API key smoke 已复核为 skipped，2026-05-27 用户要求暂缓，不再作为 Phase 8 阻塞 |
| Phase 8 | [x] | 已提交 `d04ffb95`；Support 文档、故障排查、发布说明和长期维护记录已同步；根 README / AGENTS 仍需用户明确允许后再改 |

## 1. 产品决策门禁

这些决策确认前，不应进入 UI 暴露和真实发布阶段。

Phase 1 启动记录：用户已明确确认采用下表推荐值，并说明后续无需再就同一组推荐值询问。后续实现以这些决策作为默认策略。

| 状态 | 决策项 | 推荐值 | 影响 |
| --- | --- | --- | --- |
| [x] | Codex 首版是否接受无逐工具权限 UI | 接受，仅提供 sandbox 级权限说明 | 影响 PermissionBanner、权限文案和安全边界 |
| [x] | Codex 首版是否隐藏 rewind/fork/soft interrupt/queue message | 隐藏或禁用，并给出明确 tooltip | 影响 Agent header、会话操作菜单和输入区 |
| [x] | Agent Codex 默认认证来源 | 本机 Codex auth / `CODEX_API_KEY`，不复用 Pipeline Codex channel | 影响 settings 默认值和迁移 |
| [x] | `bypassPermissions` 是否默认允许 `danger-full-access` | 不允许，必须单独高级开关 | 影响 sandbox 策略和安全提示 |
| [x] | Codex 历史是否以 runtime events 为主数据 | 是 | 影响 session manager、renderer history 和测试 |
| [x] | 是否允许首版仅使用 Codex 自身 MCP 配置 | 允许，CodeInsights workspace MCP 映射后续单独验证 | 影响 materializer 和 MCP 设置页 |

门禁验收：

- [x] 决策结果写回主方案或本清单。
- [ ] 相关 UI 文案和默认值与决策一致。
- [ ] 若用户选择与推荐值不同，补充风险说明和额外测试项。

## 2. Phase 0：基线冻结与实施准备

目标：确认当前 Claude Agent、Pipeline Codex、runtime events 基线，避免后续回归无法定位。

依赖：无。

任务：

- [x] 复查当前工作树，记录已有未提交改动，避免误纳入实现阶段。
- [x] 运行并记录基线验证：`bun run typecheck`。
- [x] 运行并记录基线测试：`bun test --isolate`。
- [x] 运行并记录 Electron 构建基线：`bun run electron:build`。
- [x] 记录当前 `@openai/codex-sdk`、`@openai/codex`、`@anthropic-ai/claude-agent-sdk` 版本。
- [x] 记录当前 `apps/electron/electron-builder.yml` 中 Codex / Claude binary 打包规则。
- [x] 复查 `tasks/lessons.md` 中 Codex auth、Agent stop、runtime event、Git guard 相关教训。
- [x] 建立阶段分支，建议命名 `codex/agent-codex-runtime-phase-0` 或按实际阶段命名。

验证：

- [x] `bun run typecheck`
- [x] `bun test --isolate`
- [x] `bun run electron:build`
- [x] `git diff --check`

退出标准：

- [x] 基线验证结果记录到 `tasks/todo.md`。
- [x] 未开始功能改动。
- [x] 已确认后续阶段的提交边界。

回滚点：

- [x] 当前阶段仅记录基线；如验证失败，先修复既有基线或明确标记为非本任务阻塞。

Phase 0 执行记录：

- 分支：`codex/agent-codex-runtime-phase-0`。
- 启动基线：`git status --short` 为空；最新提交为 `c546bc4e docs: 同步 Agent Codex Runtime 开发状态`。
- 产品门禁：Phase 0 执行当时未收到明确确认，本轮只按第 1 节推荐值作为 Phase 0 验证假设，不进入 Phase 1；该门禁后续已在 Phase 1 启动前确认。
- 依赖版本：`@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、`@anthropic-ai/claude-agent-sdk@0.2.123`；`packages/core` peer 仍是 `@anthropic-ai/claude-agent-sdk >=0.2.123`。
- Claude Agent 基线：`agent-service.ts` 当前仍创建单例 `ClaudeAgentAdapter`；`stopAgent(sessionId)` 转发到 `orchestrator.stop(sessionId)`；`ClaudeAgentAdapter` 通过 `@anthropic-ai/claude-agent-sdk query()`、`AbortController` 和自定义 `spawnClaudeCodeProcess` 管理 SDK 子进程。
- Pipeline Codex 基线：`CodexSdkPipelineNodeRunner` 当前通过 `@openai/codex-sdk` 创建 `Codex` client，调用 `startThread()` + `thread.run()`，不是 Agent UI 需要的 `runStreamed()`；节点 sandbox 按节点映射，approval 为 `never`，network 为 `false`。
- Codex auth / Git guard 基线：Pipeline Codex runner 会构造隔离 `HOME` / `USERPROFILE` / `XDG_CONFIG_HOME` / `CODEX_HOME`，显式 API key 模式使用临时 Codex home；Git 写入防护包含 PATH shim、`GIT_DIR` 失效、`GIT_CONFIG_NOSYSTEM` 和 token/askpass 清理。
- runtime events 基线：`packages/shared/src/agent/runtime-events.ts` 定义 `AgentRuntimeEvent` / envelope / adapter / validator；`agent-runtime-event-log.ts` 写 JSONL runtime events，启动时写 `run_started`，同一 run 内对 `sdk_session` 去重，并阻止重复终态。
- 打包规则：`apps/electron/package.json` 的 main build external 化 `electron`、`@anthropic-ai/claude-agent-sdk`、`@openai/codex-sdk`、`@openai/codex`；`electron-builder.yml` 设置 `asar: false`，files 包含 Claude SDK 主包和 `darwin-arm64` / `darwin-x64` / `win32-x64` 子包，包含 Codex SDK/CLI 主包和 `darwin-arm64` / `darwin-x64` / `linux-arm64` / `linux-x64` / `win32-arm64` / `win32-x64` 子包。
- 验证结果：`bun run typecheck` 通过；`bun test --isolate` 通过，508 pass / 0 fail；`bun run electron:build` 通过，Vite 大 chunk 警告未阻塞；`git diff --check` 通过。
- 残余风险：产品决策门禁仍未确认；Phase 0 未运行真实 Codex Agent 集成或打包安装验证；未修改 README.md / AGENTS.md；未开始 Phase 1 功能代码。

## 3. Phase 1：共享类型与设置契约

目标：建立 runtime-neutral 数据契约，保持旧 Claude session 兼容。

依赖：Phase 0。

推荐 PR：`feat(agent): add runtime-neutral session contracts`

涉及文件：

- `packages/shared/src/types/agent.ts`
- `packages/shared/src/agent/runtime-events.ts`
- `packages/shared/src/agent/runtime-events.test.ts`
- `apps/electron/src/types/settings.ts`
- `apps/electron/src/main/lib/settings-service.ts`
- `apps/electron/src/main/lib/settings-service.test.ts`
- `apps/electron/src/main/lib/agent-session-manager.ts`

任务：

- [x] 增加 `CodingAgentRuntimeKind = 'claude-code' | 'codex'`。
- [x] 增加 `AgentRuntimeSessionRef`。
- [x] 扩展 `AgentSessionMeta.runtimeKind`、`AgentSessionMeta.runtimeSession`。
- [x] 保留 `sdkSessionId` 作为 Claude legacy 字段并标注迁移语义。
- [x] 扩展 `AgentEventSource`，增加 `codex_sdk`、`codex_cli`。
- [x] 扩展 `run_started.runtimeKind?: CodingAgentRuntimeKind`。
- [x] 扩展 usage，契约预留 `reasoningOutputTokens`；Codex SDK 具体映射留到 Phase 3 event adapter。
- [x] 扩展 `AppSettings.agentRuntimeKind`。
- [x] 增加 `agentCodexChannelId?: string | null`。
- [x] 增加 `agentCodexModelId?: string`。
- [x] 增加 `agentCodexReasoningEffort`、`agentCodexNetworkAccessEnabled`、`agentCodexWebSearchMode`。
- [x] 实现旧 session lazy normalization：无 `runtimeKind` 且有 `sdkSessionId` 时视为 `claude-code`。
- [x] 确保旧 settings 文件读取不需要一次性迁移。

测试：

- [x] `runtime-events.test.ts` 覆盖新 source validator。
- [x] `runtime-events.test.ts` 覆盖 `run_started.runtimeKind` 可选字段。
- [x] `settings-service.test.ts` 覆盖新增 settings 字段读写。
- [x] session manager 测试覆盖旧 `sdkSessionId` 会话归一化。
- [x] 测试 Codex session 不写 `sdkSessionId` 的目标行为。

验证：

- [x] `bun test packages/shared`
- [x] `bun test apps/electron/src/main/lib/settings-service.test.ts`
- [x] `bun test apps/electron/src/main/lib/agent-session-manager.test.ts`
- [x] `bun test --isolate`
- [x] `bun run typecheck`
- [x] `git diff --check`

退出标准：

- [x] 旧 Claude Agent session 可以继续打开。
- [x] 新字段不会改变默认 Agent runtime。
- [x] Renderer 尚不暴露 Codex runtime UI。

回滚点：

- [x] 可回滚 shared/settings 类型改动；无持久化破坏性迁移。

Phase 1 执行记录：

- 提交：`6127b46c feat(agent): 完成 Codex Runtime Phase 1 共享契约`。
- 产品门禁：用户已确认采用第 1 节推荐值，并说明后续无需再就同一组推荐值询问。
- shared 契约：新增 `CodingAgentRuntimeKind`、`AgentRuntimeSessionRef`、`AgentSessionMeta.runtimeKind` / `runtimeSession`，保留 `sdkSessionId` 作为 Claude legacy 字段；runtime events 增加 `codex_sdk` / `codex_cli` source、`run_started.runtimeKind`，并预留 `reasoningOutputTokens`。
- settings 契约：新增 `agentRuntimeKind` 与 Agent Codex 独立设置字段；默认 runtime 仍为 `claude-code`，不会从 `pipelineCodexChannelId` 自动迁移到 `agentCodexChannelId`，损坏枚举读取时回落到安全默认值。
- session 契约：旧 Claude session 读取期惰性补齐 runtime 字段；更新旧 session 时写回 `runtimeSession`；清理 `sdkSessionId` 时同步清理 Claude `runtimeSession`；Codex session 仅写 `runtimeSession`，不写 `sdkSessionId`，并会清理 Claude legacy 字段。
- 版本：`@codeinsights/shared` patch 版本升至 `0.1.43`，`@codeinsights/electron` patch 版本升至 `0.0.104`。
- 验证结果：`bun test packages/shared` 通过；`bun test apps/electron/src/main/lib/settings-service.test.ts` 通过；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts` 通过；`bun test --isolate` 通过，522 pass / 0 fail；`bun run typecheck` 通过；`git diff --check` 通过。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Codex runtime core、event adapter、Renderer UI 或真实 Codex SDK 运行路径。

## 4. Phase 2：Codex Runtime Core 抽取

目标：从 Pipeline Codex runner 中抽出可复用的 Codex binary、auth、env、command guard、channel resolution 能力，并保持 Pipeline 行为不变。

依赖：Phase 1。

推荐 PR：`refactor(codex): extract shared runtime core`

涉及文件：

- `apps/electron/src/main/lib/codex-pipeline-node-runner.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-binary.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-auth.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-env.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-command-guard.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-channel.ts`
- `apps/electron/src/main/lib/codex-runtime/index.ts`
- `apps/electron/src/main/lib/codex-runtime/*.test.ts`

任务：

- [x] 新增 `codex-runtime/` 目录。
- [x] 抽出 `resolveCodexCliPath()` 与平台 target/package 映射。
- [x] 抽出 `resolveCodexRuntime()`，支持 `openai` / `custom`。
- [x] 抽出 native auth 探测：`CODEX_HOME/auth.json`、`CODEX_API_KEY`、`HOME/.codex/auth.json`。
- [x] 抽出 `buildCodexEnv()`，显式处理 env 替换语义。
- [x] 抽出 `createCodexExecutionGuard()`，支持 purpose 区分 Agent / Pipeline 文案。
- [x] 抽出 Git 环境清理和远端写保护。
- [x] Pipeline runner 改为引用公共 core。
- [x] 保持 Pipeline prompt、JSON Schema、节点结果解析不进入公共 core。
- [x] 确认 API key 模式隔离 `CODEX_HOME`，native auth 模式只传明确 `CODEX_HOME`。

测试：

- [x] `codex-binary.test.ts` 覆盖平台包映射和 `.asar.unpacked`。
- [x] `codex-auth.test.ts` 覆盖 channel API key、native auth、env API key、无凭证失败。
- [x] `codex-env.test.ts` 覆盖 PATH 保留、`ANTHROPIC_*` 清理、宿主 secret allowlist、GitHub token 清理；proxy 注入沿用 `getEffectiveProxyUrl()` 入口。
- [x] `codex-command-guard.test.ts` 覆盖 Pipeline 文案和 Agent 文案分离。
- [x] `codex-pipeline-node-runner.test.ts` 继续通过。

验证：

- [x] `bun test apps/electron/src/main/lib/codex-runtime`
- [x] `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [x] `bun run --filter='@codeinsights/electron' typecheck`
- [x] `git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/package.json tasks/todo.md`

退出标准：

- [x] Pipeline Codex runner 行为不变。
- [x] Agent 所需 Codex core 能力可直接复用。
- [x] 无真实 Codex 调用进入默认测试。

回滚点：

- [x] 可单独回滚到 Pipeline runner 内联实现；不影响 shared 类型。

Phase 2 执行记录：

- 提交：`f04d893c refactor(codex): 抽取 Codex Runtime Phase 2 core`。
- 公共 core：新增 `apps/electron/src/main/lib/codex-runtime/`，拆出 `codex-binary`、`codex-channel`、`codex-auth`、`codex-env`、`codex-command-guard` 和 `index.ts`。
- Pipeline runner：`codex-pipeline-node-runner.ts` 改为引用公共 core；Pipeline prompt、JSON Schema、节点结果解析、patch-work enrichment、stream event、v2 业务 Git guard snapshot / 事后校验仍保留在 runner 内，外部行为不变。
- Auth / env：API key 模式隔离 `CODEX_HOME`；native auth 模式只传明确 `CODEX_HOME` 并清理 ambient `CODEX_API_KEY`；`buildCodexEnv()` 改为基础 allowlist，避免透传 `OPENAI_API_KEY`、AWS、NPM、Anthropic 等宿主 secrets。
- Command guard：支持 `pipeline` / `agent` purpose 文案，保留 `git` / `gh` / `hub` shim、`GIT_DIR=/__codeinsights_git_disabled__`、remote `pushurl` 改写、`GIT_TERMINAL_PROMPT=0`、askpass / GCM 禁用和危险 Git env 清理。
- Git guard 边界：Phase 2 保持“前置 command/env guard + Pipeline v2 snapshot 事后检测/回滚”，不改 Pipeline cwd / patch-work 行为；gitless workspace 属于后续安全强化，不纳入本阶段。
- 测试：新增 `codex-runtime/*.test.ts` 覆盖 binary、channel、auth、env、command guard；既有 `codex-pipeline-node-runner.test.ts` 保持 30 pass，默认测试不触发真实 Codex。
- 版本：`@codeinsights/electron` patch 版本升至 `0.0.105`。
- 代码审查：首轮审查指出 env secret 透传风险，已改为 allowlist；复审无 Critical / High / Medium findings。
- 验证结果：`bun test apps/electron/src/main/lib/codex-runtime` 通过，18 pass / 0 fail；`bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts` 通过，30 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts apps/electron/package.json tasks/todo.md` 通过。
- 补充验证：`bun test --isolate` 跑到 540 个用例时仅 `pipeline-git-submission-service` 一个 before/after hook 偶发超时；该文件单独重跑 `bun test apps/electron/src/main/lib/pipeline-git-submission-service.test.ts` 21 pass / 0 fail，未指向 Phase 2 改动。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 3 event adapter、Phase 5 Orchestrator routing、Renderer UI 或真实 Codex 集成。

## 5. Phase 3：Codex Event Adapter

目标：用 fixtures 驱动实现 `ThreadEvent -> AgentStreamEnvelope` 映射，不接 Orchestrator。

依赖：Phase 1。

推荐 PR：`feat(agent): map codex stream events to runtime envelopes`

涉及文件：

- `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`
- `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`
- `apps/electron/src/main/lib/agent-runtimes/__fixtures__/codex-events/*.jsonl`
- `packages/shared/src/agent/runtime-events.ts`
- `packages/shared/src/agent/runtime-events.test.ts`

任务：

- [x] 定义 adapter 状态：thread id、started items、completed items、previous text/output、terminal flag。
- [x] 实现 `thread.started -> sdk_session` 兼容映射。
- [x] 实现 `agent_message` started/updated/completed 映射。
- [x] 实现 `reasoning` 折叠式 task 映射。
- [x] 实现 `command_execution -> Bash` 工具活动映射。
- [x] 实现 `file_change -> PatchApply` 工具活动映射。
- [x] 实现 `mcp_tool_call -> server.tool` 工具活动映射。
- [x] 实现 `web_search -> WebSearch` 工具活动映射。
- [x] 实现 `todo_list -> agent_task_*` 映射。
- [x] 实现 `turn.completed -> usage_updated + run_completed`。
- [x] 实现 `turn.failed` 和顶层 `error -> run_failed`。
- [x] 实现 append-only delta 差分，非 append-only 时退化为完整覆盖。
- [x] 实现 terminal 去重。

Fixtures：

- [x] `agent-message-stream.jsonl`
- [x] `command-success.jsonl`
- [x] `command-failed.jsonl`
- [x] `file-change.jsonl`
- [x] `mcp-tool-call-success.jsonl`
- [x] `mcp-tool-call-failed.jsonl`
- [x] `web-search.jsonl`
- [x] `todo-list.jsonl`
- [x] `turn-failed.jsonl`
- [x] `abort-after-completed-race.jsonl`

测试：

- [x] 每类 item 映射为预期 runtime event。
- [x] `item.updated` 不重复输出累计文本。
- [x] `turn.completed` 前不产生 `run_completed`。
- [x] `turn.failed` 不被当作成功。
- [x] Abort 优先级由 adapter 或上层测试覆盖。

验证：

- [x] `bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`
- [x] `bun test packages/shared/src/agent/runtime-events.test.ts`
- [x] `bun run --filter='@codeinsights/electron' typecheck`
- [x] `git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md`

退出标准：

- [x] Codex SDK 当前所有公开 item 类型均有明确映射或明确忽略策略。
- [x] 不需要真实 Codex 即可稳定测试。
- [x] 不伪造 Claude SDKMessage。

回滚点：

- [x] Adapter 尚未接入 runtime，失败可独立回滚。

Phase 3 执行记录：

- 新增 `apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.ts`，实现状态化 `ThreadEvent -> AgentStreamEnvelope` adapter，默认 source 为 `codex_sdk`。
- 新增 10 个 JSONL fixtures，覆盖 agent message、command success/failed、file change、MCP success/failed、web search、todo list + reasoning、turn failed、completed 后 abort/failure race。
- 映射覆盖 Codex SDK 0.130.0 当前公开 `ThreadItem` 类型：`agent_message`、`reasoning`、`command_execution`、`file_change`、`mcp_tool_call`、`web_search`、`todo_list`、`error`。
- 文本和命令输出使用 append-only delta 差分；非 append-only 文本更新退化为完整 `assistant_message` 覆盖；一次性 `item.completed agent_message` 只产出最终完整消息。
- `turn.completed` 映射 `usage_updated` + `run_completed`，并带上 `thread.started` 捕获的 thread id；`turn.failed` 和顶层 `error` 映射 `run_failed`；首个 terminal 事件后忽略后续 late abort/failure。
- `reasoning` 与 `todo_list` 映射为 `agent_task_*`，`command_execution` / `file_change` / `mcp_tool_call` / `web_search` 映射为工具活动。
- `packages/shared/src/agent/runtime-events.ts` 未改动，现有 runtime-neutral 契约足够承载 Phase 3；Claude 现有路径不变。
- 版本：`@codeinsights/electron` patch 版本升至 `0.0.106`。
- 代码审查：无 Critical / High findings；已删除未使用变量，并在提交前让新文件进入 diff 检查范围后重跑 `git diff --check`。
- 验证结果：`bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts` 通过，13 pass / 0 fail；`bun test packages/shared/src/agent/runtime-events.test.ts` 通过，14 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md` 通过。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 4 `CodexAgentRuntime` mock、Phase 5 Orchestrator routing、Renderer UI 或真实 Codex 集成。

## 6. Phase 4：CodexAgentRuntime Mock 接入

目标：实现主进程 Codex runtime runner，使用 mock Codex SDK 完成 start/resume/abort/failure 测试。

依赖：Phase 2、Phase 3。

推荐 PR：`feat(agent): add codex coding runtime runner`

涉及文件：

- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-types.ts`
- `apps/electron/src/main/lib/agent-runtimes/codex-runtime.ts`
- `apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`
- `apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.ts`
- `apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`
- `apps/electron/src/main/lib/codex-runtime/codex-sdk-client.ts`

任务：

- [x] 定义 `CodingAgentRuntime` 主进程接口。
- [x] 定义 `CodingAgentRuntimeCapabilities`。
- [x] 实现 Codex SDK client factory，可注入 mock。
- [x] 实现 `CodexAgentRuntime.run()`。
- [x] 支持 `startThread()`。
- [x] 支持 `resumeThread(externalSessionId)`。
- [x] 支持 `runStreamed()` async generator。
- [x] 支持 `AbortSignal`。
- [x] 支持 `workingDirectory`、`additionalDirectories`、`model`。
- [x] 支持 `modelReasoningEffort`、`networkAccessEnabled`、`webSearchMode`。
- [x] 支持 `sandboxMode`、`approvalPolicy` 映射。
- [x] 支持 `thread.started` 后暴露 external session id。
- [x] `queueMessage()` 返回 structured unsupported。
- [x] `setPermissionMode()` 返回 structured unsupported。
- [x] 错误分类为 `codex_auth_missing`、`codex_binary_missing`、`codex_channel_invalid`、`codex_turn_failed` 等。

测试：

- [x] mock startThread 成功。
- [x] mock resumeThread 成功。
- [x] mock stream throw 映射 `run_failed`。
- [x] mock turn.failed 映射 `run_failed`。
- [x] abort before stream 映射 `run_stopped`。
- [x] abort during stream 映射 `run_stopped`。
- [x] stream 正常结束但 signal 已 aborted 时优先 `run_stopped`。
- [x] unsupported capability 返回结构化结果。
- [x] permission policy 单测覆盖 `plan`、`auto`、`bypassPermissions`。

验证：

- [x] `bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`
- [x] `bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`
- [x] `bun run --filter='@codeinsights/electron' typecheck`
- [x] `git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime apps/electron/package.json tasks/todo.md tasks/lessons.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md`

退出标准：

- [x] Codex runtime 可在 mock 环境完整产出 runtime envelopes。
- [x] 无真实 API key 和 native auth 依赖。
- [x] 不影响 Claude Agent 默认路径。

回滚点：

- [x] Codex runtime 未被 Orchestrator 默认路由，失败可关闭 feature flag 或回滚 runner 文件。

Phase 4 执行记录：

- 新增 `coding-agent-runtime-types.ts`，定义主进程 runtime 接口、capabilities、Codex run input、structured unsupported capability 结果和 permission policy 结果类型。
- 新增 `codex-sdk-client.ts`，提供 `CodexSdkClientLike` / `CodexSdkThreadLike` / `CreateCodexSdkClient` 和默认动态 import factory；单测全部注入 mock client，不调用真实 SDK / CLI。
- 新增 `codex-permission-policy.ts`，实现 `plan` / `auto` / `bypassPermissions` 到 Codex sandbox、approval、network、webSearch 和 command guard 策略的映射；`bypassPermissions` 默认不启用 `danger-full-access`。
- 新增 `codex-runtime.ts`，复用 Phase 2 auth / env / command guard core 和 Phase 3 `CodexEventAdapter`，实现 mock 可测的 `CodexAgentRuntime.run()` start / resume / stream / abort / failure 流程。
- 更新 `next-session-prompt.md`，下次启动入口改为 Phase 5 Orchestrator Runtime Routing；未修改 README.md / AGENTS.md。
- Abort 加固：controller 在 `run_started` 前注册；`run_started` 后立即 stop 不会创建 client；等待下一条 SDK event 时可由 `runtime.abort()` 解除；同一 SDK 事件内 abort 不会让 `usage_updated` 后继续输出 `run_completed`；abort 后不会再启动下一次 SDK iterator 读取。
- Auth / env 加固：显式 channel API key 模式不会把 ambient `CODEX_API_KEY` 继续传入 Codex client env；API key / native auth 仍由 Phase 2 core 判定，测试不依赖本机登录或真实 key。
- `queueMessage()` 和 `setPermissionMode()` 返回 `runtime_capability_unsupported` 结构化结果，不伪造 Codex per-tool permission 或 queue 能力。
- 版本：`@codeinsights/electron` patch 版本升至 `0.0.107`。
- 代码审查：首轮审查发现 abort 注册、同事件终态、ambient key、测试证明力和 model 展示问题；均已修复。复审无 Critical / High，指出 lazy iterator 风险后已改为 lazy `raceWithAbort` 并补测。
- 验证结果：`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts` 通过，13 pass / 0 fail；`bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts` 通过，4 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck` 通过；`git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime apps/electron/package.json tasks/todo.md tasks/lessons.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md docs/codex-support/next-session-prompt.md` 通过。
- 阶段边界：未修改 README.md / AGENTS.md，未接入 Phase 5 Orchestrator routing、Phase 6 Renderer UI 或 Phase 7 真实 Codex 集成。

## 7. Phase 5：Orchestrator Runtime Routing

目标：让 Agent Orchestrator 基于 session/settings 选择 Claude Code 或 Codex runtime，保持 Claude 默认行为。

依赖：Phase 1、Phase 4。

推荐 PR：`feat(agent): route sessions through coding runtime registry`

涉及文件：

- `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts`
- `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`
- `apps/electron/src/main/lib/agent-service.ts`
- `apps/electron/src/main/lib/agent-orchestrator.ts`
- `apps/electron/src/main/lib/agent-runtime-event-log.ts`
- `apps/electron/src/main/lib/agent-session-manager.ts`
- `apps/electron/src/main/ipc/agent-handlers.ts`

任务：

- [x] 新增 `CodingAgentRuntimeRegistry`。
- [x] 包装现有 Claude runner 为 `ClaudeCodeRuntime`。
- [x] 解析 runtime 优先级：session `runtimeSession` > legacy `sdkSessionId` > settings > default。
- [x] 新 session 首次运行后持久化 `runtimeKind` 和 `runtimeSession`。
- [x] 运行中禁止切换 runtime。
- [x] Orchestrator 统一消费 `AgentStreamEnvelope`。
- [x] Orchestrator 不直接依赖 Codex `ThreadEvent`。
- [x] Codex run 写 runtime event log。
- [x] Claude run 行为保持不变。
- [x] stop 同时触发 active abort controller 和 runtime abort。
- [x] complete 前二次检查 active session / abort state。
- [x] runtime unsupported capability 透传到 UI 可处理的错误或状态。

测试：

- [x] mock Claude runtime 默认被选择。
- [x] legacy `sdkSessionId` 会话被选择为 `claude-code`。
- [x] settings 选择 Codex 时新会话使用 Codex。
- [x] 已绑定 Claude session 不被 settings 切到 Codex。
- [x] 已绑定 Codex session 不被 settings 切到 Claude。
- [x] stop 后不落 `run_completed`。
- [x] Codex `thread.started` 持久化 `runtimeSession.externalSessionId`。
- [x] runtime 抛错后 active run 清理。

验证：

- [x] `bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`
- [x] `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`
- [x] `bun run --filter='@codeinsights/electron' typecheck`
- [x] `git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc packages/shared tasks/todo.md tasks/lessons.md`

退出标准：

- [x] Claude Agent 默认路径无行为回归。
- [x] Codex runtime 可通过设置在主进程路径跑通 mock。
- [x] 运行中状态和终态去重稳定。

回滚点：

- [ ] 关闭 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` 后所有新会话回到 Claude Code。

Phase 5 执行记录：

- 新增 `apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.ts` 与 `coding-agent-runtime-registry.test.ts`，集中管理 runtime 注册、默认 runtime、运行中切换保护和 session/settings/default 路由解析。
- 新增 `apps/electron/src/main/lib/agent-runtimes/claude-code-runtime.ts`，作为现有 Claude Code runner 的 registry wrapper，保持 Claude 默认路径行为不变。
- 更新 `apps/electron/src/main/lib/agent-service.ts`，默认注册 `ClaudeCodeRuntime` 与 Phase 4 mock `CodexAgentRuntime`；Codex 路径仍不调用真实 Codex SDK / CLI / auth / API key。
- 更新 `apps/electron/src/main/lib/agent-orchestrator.ts`，在发送前选择 runtime；Codex 分支消费 `AgentStreamEnvelope`、写 runtime event log、持久化 `runtimeSession`，并在 stop / complete 竞态下二次检查 active session 与 abort state。
- 更新 `apps/electron/src/main/lib/agent-runtime-event-log.ts` / `agent-runtime-runner.ts`，记录 `runtimeKind` 并支持直接追加 runtime envelope；Claude runner 继续写 `claude-code`。
- 更新 `packages/shared/src/types/agent.ts`，`AgentRuntimeSessionRef` 可固化 Codex 绑定时使用的 `channelId` 与 `model`，避免 settings 后续变化污染既有 runtime session。
- 版本更新：`@codeinsights/electron` 升至 `0.0.108`，`@codeinsights/shared` 升至 `0.1.44`。
- 验证通过：`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`；`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`；`bun test apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts`；`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`；`bun test packages/shared`；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check`。
- 阶段边界：未接入 Phase 6 Renderer UI，未做 Phase 7 真实 Codex SDK / CLI 集成，未修改根 `README.md` 或 `AGENTS.md`。
- 阶段提交：`40441fe8 feat(agent): 完成 Codex Runtime Phase 5 编排路由`。

## 8. Phase 6：Renderer 设置、历史与 UX

目标：在 UI 中暴露 Codex runtime 配置，并让 Codex 会话历史基于 runtime events 回放。

依赖：Phase 5。

推荐 PR：`feat(agent-ui): add codex runtime settings and transcript replay`

涉及文件：

- `apps/electron/src/preload/index.ts`
- `apps/electron/src/main/ipc/agent-handlers.ts`
- `apps/electron/src/renderer/main.tsx`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`
- `apps/electron/src/renderer/components/settings/AgentSettings.tsx`
- `apps/electron/src/renderer/components/agent/AgentHeader.tsx`
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx`
- `apps/electron/src/renderer/components/agent/RuntimeTranscript.tsx`
- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts`

任务：

- [x] 新增 `getAgentSessionRuntimeEvents` IPC / preload API。
- [x] Renderer 加载 Codex session 时读取 runtime events。
- [x] 实现 runtime transcript selector。
- [x] 实现 `RuntimeTranscript` 组件。
- [x] Agent settings 增加 Runtime 选择：Claude Code / Codex。
- [x] Codex 认证来源 UI：native auth / OpenAI 或 Custom channel。
- [x] Codex channel 下拉只显示 enabled openai/custom。
- [x] Codex 模型设置独立于 Claude `agentModelId`。
- [x] Codex reasoning effort、network、web search 设置。
- [x] Agent header 显示当前 session runtime。
- [x] Codex session 禁用或隐藏 rewind/fork/soft interrupt/queue message。
- [x] Codex runtime 下不展示 Claude per-tool PermissionBanner。
- [x] 设置中无效 `agentCodexChannelId` 自动清理。
- [x] Feature flag 关闭时 UI 不显示 Codex runtime 入口。

测试：

- [x] runtime transcript selector 合并 user message 和 runtime assistant/tool events。
- [x] settings initializer 清理 deleted/disabled/unsupported channel。
- [x] Codex session header badge 正确。
- [x] unsupported capability UI 有明确文案。
- [x] runtime events 缺失时有降级提示。

验证：

- [x] `bun test apps/electron/src/renderer`
- [x] `bun run --filter='@codeinsights/electron' typecheck`
- [x] 手动 UI smoke：feature flag 开启后能看到 Codex runtime 设置。
- [x] 手动 UI smoke：feature flag 关闭后不显示 Codex runtime 设置。
- [x] `git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/renderer tasks/todo.md`

退出标准：

- [x] 用户能显式选择 Codex runtime。
- [x] Codex 会话重开后能从 runtime events 恢复主要 transcript。
- [x] 不支持能力不会静默失败。
- [x] Claude UI 行为不回归。

回滚点：

- [x] 关闭 feature flag 可隐藏 Codex UI，保留已写 runtime events。

Phase 6 执行记录：

- 新增 `AGENT_IPC_CHANNELS.GET_RUNTIME_EVENTS`、主进程 handler 与 preload API，Renderer 可按 session 读取 `AgentStreamEnvelope[]`。
- 新增 `apps/electron/src/renderer/lib/agent-runtime-ui.ts`，集中处理 Codex feature flag、OpenAI / Custom channel 过滤、无效 `agentCodexChannelId` 清理和 session runtime 解析。
- 新增 `runtime-transcript-model.ts` 与 `RuntimeTranscript.tsx`，Codex 会话基于 runtime events 回放用户消息、assistant 文本、工具调用、终态和 usage；缺失 runtime events 时显示降级提示。
- 更新 AgentView：Codex 使用 RuntimeTranscript，隐藏 Claude per-tool PermissionBanner、ModelSelector、PermissionModeSelector、runner toggle、thinking popover、fork / rewind 控制和运行中 queue message；feature flag 关闭时既有 Codex session 仅可查看历史。
- 更新 AgentOrchestrator：Codex feature flag 关闭时，主进程在持久化用户消息和抢占 active session 前返回 `codex_runtime_disabled` typed error，防止 Renderer 以外路径绕过 UI 限制继续执行 Codex session。
- 更新 AgentSettings：新增 feature-flag 保护的 Runtime 设置，支持 Claude Code / Codex、本机 Codex auth、enabled OpenAI / Custom channel、独立模型、reasoning effort、network 和 web search。
- 更新 renderer initializer：加载 Codex runtime 设置，清理 deleted / disabled / unsupported 的 `agentCodexChannelId`；feature flag 关闭时默认 runtime 恢复为 Claude Code。
- 代码审查发现新建未运行 session 会因默认 `runtimeKind: 'claude-code'` 被 Renderer 误判为 Claude；已修复为未运行会话跟随当前 default runtime，只有 `runtimeSession`、明确 `runtimeKind: 'codex'` 或 legacy `sdkSessionId` 形成绑定。
- runtime transcript selector 已改为保留 JSONL / live append 顺序，并补充多轮同时间戳测试，避免按 runId / createdAt 重排导致用户消息错配。
- 版本更新：`@codeinsights/electron` 升至 `0.0.109`，`@codeinsights/shared` 升至 `0.1.45`。
- 阶段提交：`58164e35 feat(agent): 完成 Codex Runtime Phase 6 渲染端接入`。
- 验证通过：`bun test apps/electron/src/renderer`，127 pass / 0 fail；`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`，7 pass / 0 fail；`bun test packages/shared`，36 pass / 0 fail；`bun run --filter='@codeinsights/electron' typecheck`；`git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/main/lib apps/electron/src/renderer packages/shared tasks/todo.md docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`。
- 补充验证：`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 bun run --filter='@codeinsights/electron' build:renderer`；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=0 bun run --filter='@codeinsights/electron' build:renderer`；现有 5173 dev server 未携带 feature flag 时，Agent 配置页未出现 `Agent Runtime`。
- 阶段边界：未接入 Phase 7 真实 Codex SDK / CLI，未做打包发布验证，未修改根 `README.md` 或 `AGENTS.md`。

## 9. Phase 7：真实 Codex 集成与打包验证

目标：在真实 Codex SDK / CLI 环境中验证 Agent Codex runtime 的关键路径和 packaged app 行为。

依赖：Phase 6。

推荐 PR：`test(agent): validate codex runtime integration`

涉及文件：

- `apps/electron/package.json`
- `apps/electron/electron-builder.yml`
- `apps/electron/scripts/*` 如需新增 smoke 脚本
- `docs/codex-support/*` 验证记录
- `tasks/todo.md`

任务：

- [x] 确认 `@openai/codex-sdk` / `@openai/codex` 版本。
- [x] 确认 esbuild external 包含 Codex SDK/CLI。
- [x] 确认 electron-builder files 包含 SDK、CLI 和平台 binary 包。
- [x] 确认 macOS arm64 binary 可解析。
- [x] 确认 macOS x64 binary 策略。
- [x] 确认 Windows x64 binary 策略。
- [x] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 做真实 smoke。
- [x] native auth 模式：修正 native smoke 隔离逻辑后会复制同源 `config.toml` 中转 API 配置，并尊重其中 `model_reasoning_effort`；`native-auth.readonly` 返回 `codeinsights-codex-native-ok`，thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932`，终态 `run_completed`。
- [!] channel API key 模式：2026-05-26 本轮复核当前环境未设置 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY`，执行 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 后 `channel-api-key.readonly` 仍 skipped；未读取 ambient `OPENAI_API_KEY`。
- [x] workspace-write 模式：`workspace-write.file-edit` 只改目标文件为 `phase7 workspace write ok`，thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d`，终态 `run_completed`。
- [x] read-only plan 模式：`readonly-plan.no-write` 保持文件内容 `before-readonly`，thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5`，终态 `run_completed`。
- [x] stop 长任务，最终状态为 stopped。
- [x] resume 同一 Codex thread：`resume.context` 第二轮返回首轮口令，thread `019e63a6-5806-7013-a8af-651efad3ffe5`，终态 `run_completed`。
- [x] 重启应用，确认 packaged app 使用隔离配置目录可启动并初始化；新增 history reload fixture-based packaged UI reload smoke 已启动 packaged app 两次并确认真实 UI 展示同一 Codex 历史会话。
- [x] web search / MCP 按当前支持情况记录真实结果：web-search 真实 runtime 通过；MCP config injection 通过 Codex CLI 原生配置识别 smoke。
- [x] 打包后运行 Agent Codex smoke。

验证：

- [x] `bun run typecheck`
- [x] `bun test --isolate`
- [x] `bun run electron:build`
- [x] `CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`
- [x] 手动 smoke 记录 native auth 结果。
- [x] 手动 smoke 记录 channel API key skipped / 暂缓结果。
- [x] 手动 smoke 记录 MCP config injection 结果。
- [x] 手动 smoke 记录 packaged app 结果。

退出标准：

- [x] Codex Agent 首版关键用户路径可真实运行：native / read-only / workspace-write / resume / web-search 已通过真实 smoke。
- [x] stop/resume/history reload 均已有对应验证：stop 和 resume 通过真实 runtime smoke；history reload 通过 fixture-based packaged UI reload smoke。
- [x] 打包后 binary 可解析。
- [x] 已记录不支持项和残余风险。

回滚点：

- [ ] 若真实 Codex 集成不稳定，保留代码但默认关闭 `CODEINSIGHTS_AGENT_CODEX_RUNTIME`。

Phase 7 执行记录：

- 真实 runtime 接入：`apps/electron/src/main/lib/agent-service.ts` 已注册 `new CodexAgentRuntime()`，不再使用 Phase 5/6 mock Codex runtime；feature flag 仍保护 Codex Agent 路径。
- 版本确认：本地 `@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`；npm latest 查询结果为 `0.133.0`。Phase 7 未升级依赖，保持当前锁定版本验证。
- SDK 契约确认：官方 TypeScript SDK 仍使用 `@openai/codex-sdk`、`Codex().startThread()`、`resumeThread()` 和 streaming API；实现继续动态 import SDK，避免主进程 bundle 吞掉外部包。
- 打包策略确认：`build:main` / `watch:main` external 已包含 `@openai/codex-sdk`、`@openai/codex`；`electron-builder.yml` files 已包含 SDK、CLI 和六个目标平台包 glob。
- 平台包策略：Bun optionalDependencies 在当前 darwin-arm64 runner 只安装 `@openai/codex-darwin-arm64`；macOS x64 和 Windows x64 需要分别在 x64 macOS / Windows runner 安装对应 optional platform package 后打包。
- macOS arm64 binary 验证：本地 binary path 为 `node_modules/.bun/@openai+codex@0.130.0-darwin-arm64/.../vendor/aarch64-apple-darwin/codex/codex`，输出 `codex-cli 0.130.0`。
- 新增 smoke 脚本：`apps/electron/scripts/agent-codex-smoke.ts`，支持 `--only binary|native|api-key|workspace-write|readonly|stop|resume|web-search|mcp`，默认使用隔离 `CODEINSIGHTS_CONFIG_DIR`、隔离 `CODEX_HOME` 和临时 workspace；默认清理临时 auth 副本，保留产物需要显式 `--keep-artifacts`。
- Orchestrator 加固：已绑定 Codex session resume 时只使用 session 绑定模型，不回退当前 settings；首次 `run_started` 会回填实际可持久化模型，`Codex default` 不伪造成模型 ID。
- MCP 注入：新增 `codex-mcp-config` 映射层，将 CodeInsights workspace `mcp.json` 中 enabled stdio/http MCP 转换为 Codex SDK `config.mcp_servers` 原生配置；Agent Codex runtime 启动时传入 `CodexOptions.config` 和 `codexConfigEnv`，不写用户真实 `~/.codex/config.toml`。stdio env 使用 `env_vars`，HTTP headers 使用 `env_http_headers`，真实 secret 只进入 Codex 子进程 env，不进入 SDK `--config` argv；runtime 合并时也禁止覆盖 Git guard/base env。legacy SSE 暂不映射，配置名含非 bare key 字符、缺少 command/url、保留 env 名称、无效 HTTP header 名称或 env 名称冲突的条目会跳过并只记录服务器名与原因。
- Stop 加固：Runner v2 abort 分支会先 flush 已累计 SDK assistant 消息，再输出 `run_stopped`，避免用户 stop 后完成信号缺少已处理消息。
- 安全加固：Agent Codex runtime 真实运行前会对 `repositoryRoot`、`workingDirectory` 和 `additionalDirectories` 内的 Git repo 建立快照，终态前校验并回滚真实 commit / refs / index / config 污染；安全复审确认原 High / Medium / Critical 已关闭。
- Smoke 结果：`binary.darwin-arm64` passed；`stop.long-run` passed，终态 `run_stopped`，thread id `019e622d-4b90-7ab3-a53d-b2c1de24db7f`；`channel-api-key.readonly` skipped，原因是未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key`。
- 真实请求阻塞：native auth、read-only、workspace-write、resume、web-search 均创建 Codex thread 并请求 `https://api.openai.com/v1/responses`，但本机 native auth key 返回 `401 invalid_api_key`，因此成功回答、文件写入、上下文延续和 WebSearch 成功路径未完成。
- 2026-05-26 补跑记录：`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only native` 使用隔离 `CODEINSIGHTS_CONFIG_DIR` / `CODEX_HOME` 创建 thread `019e6329-a3bc-73c1-9b30-095a8223360e`，120 秒内未完成成功回答，终态 `run_stopped`；`--only api-key` 因未设置 `CODEX_SMOKE_API_KEY` 且未 opt-in `OPENAI_API_KEY` 继续 skipped。
- 2026-05-26 CLI / 网络探针：隔离 `codex exec --skip-git-repo-check --ignore-user-config --ignore-rules -s read-only --json` 创建 thread `019e632e-5007-7b33-9789-bf5f8a0294b3`，随后出现 `Reconnecting...`、`stream disconnected` 和 Codex plugin sync timeout，90 秒超时；`curl -I --max-time 20 https://api.openai.com/v1/models`、`https://chatgpt.com/backend-api/plugins/featured?platform=codex`、`https://github.com/openai/plugins.git` 均超时；当前环境无 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`。
- 2026-05-26 再次补跑记录：`binary.darwin-arm64` 仍 passed，输出 `codex-cli 0.130.0`；当前环境 `CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置，`~/.codex/auth.json` 存在但只能作为隔离 native auth 复制源；`--only api-key` 继续 skipped。`--only native` 创建 thread `019e6365-c0e0-7911-a2e0-7b6ef311c091` 后 120 秒内未完成 token 响应，终态 `run_stopped`。隔离 CLI 探针创建 thread `019e6368-829b-75f3-9384-a8c22d5f61b7`，随后出现 `Reconnecting...`、`stream disconnected`、plugin sync warning、GitHub clone `early EOF`，100 秒外层超时。`curl -I --max-time 20 https://api.openai.com/v1/models`、`https://chatgpt.com/backend-api/plugins/featured?platform=codex`、`https://github.com/openai/plugins.git` 均超时；`git ls-remote https://github.com/openai/plugins.git` 30 秒超时。由于没有可用 native / API key 成功路径，workspace-write、read-only、resume、web-search 和 history reload 成功路径继续保持阻塞，未伪造通过。
- 2026-05-26 native config 修正记录：用户指出主机 Codex native auth 使用 `~/.codex/config.toml` 中的 `model_provider = "cch"` 和中转 `base_url`；已修正 `agent-codex-smoke.ts`，复制同源 `auth.json` 与可选 `config.toml` 到隔离 `CODEX_HOME` 并设置 `0600`。同时移除 smoke 默认强制 `modelReasoningEffort: "minimal"`，避免覆盖主机配置中的 `model_reasoning_effort = "xhigh"`；`CODEX_SMOKE_REASONING_EFFORT` 可显式覆盖。
- 2026-05-26 修正后成功路径：`native-auth.readonly` passed，thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932`；`readonly-plan.no-write` passed，thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5`；`workspace-write.file-edit` passed，thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d`；`resume.context` passed，thread `019e63a6-5806-7013-a8af-651efad3ffe5`；`web-search.current-support` passed，thread `019e63a7-0b84-7993-bf33-028d39b15593`，返回 `0.133.0`；`stop.long-run` 重跑 passed，终态 `run_stopped`。
- 2026-05-26 MCP 注入验证：`bun test apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts apps/electron/scripts/agent-codex-smoke.test.ts` 通过，54 pass / 0 fail；`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only mcp` 通过，`mcp.config-injection` passed，Codex CLI `mcp list --json` 可识别 CodeInsights workspace MCP 映射出的原生 stdio/http `mcp_servers` 配置，且 smoke 从真实 helper 输出派生 CLI override。
- 2026-05-26 history reload UI smoke：新增 `apps/electron/scripts/agent-history-reload-ui-smoke.ts` 和 `smoke:agent-history-reload-ui` 命令，并提交为 `79c7fc92 test(agent): 补齐 Codex history reload UI smoke`；脚本预置隔离 `agent-sessions.json`、SDKMessage JSONL、runtime events JSONL 和 `settings.tabState`，启动 packaged app 两次，通过 CDP 读取真实 `document.body.innerText`，确认 `History Reload Smoke 4f4c4be2`、`codeinsights-history-user-4f4c4be2`、`codeinsights-history-assistant-4f4c4be2` 均出现；两轮 `history-reload.first-open` / `history-reload.reopen` passed。该脚本是 fixture-based packaged UI reload smoke，验证重开读取/恢复/渲染链路，不声称覆盖真实 Codex 写入链路。
- 2026-05-26 API key 残余复核：当前环境 `CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置；执行 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 返回退出码 0，结果为 `channel-api-key.readonly` skipped，原因是未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key`。本轮未读取 ambient `OPENAI_API_KEY`，Phase 8 不启动。
- 2026-05-26 本轮最终残余复核：当前环境 `CODEX_SMOKE_API_KEY`、`OPENAI_API_KEY`、`CODEX_HOME`、`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 均未设置；执行 `bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only api-key` 返回退出码 0，脚本确认 `@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`、binary `codex-cli 0.130.0`，`channel-api-key.readonly` 仍 skipped，原因是未设置 `CODEX_SMOKE_API_KEY` 且未显式传 `--use-openai-api-key`。本轮未读取 ambient `OPENAI_API_KEY`，Phase 8 不启动。
- 2026-05-27 暂缓记录：用户明确要求暂时不做 channel API key smoke 的“有凭证则补跑 / 无凭证则记录阻塞”两项；后续启动不再把该 smoke 作为 Phase 8 前置阻塞，除非用户重新明确要求，否则不主动补跑，也不读取 ambient `OPENAI_API_KEY`。
- 打包验证：`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast` 成功生成 `out/CodeInsights-0.0.112-arm64.dmg`；packaged app 内 `@openai/codex-sdk`、`@openai/codex`、`@openai/codex-darwin-arm64` 存在，native binary 与 CLI wrapper 均输出 `codex-cli 0.130.0`。
- Packaged startup smoke：使用隔离 `CODEINSIGHTS_CONFIG_DIR` 启动 `out/mac-arm64/CodeInsights.app/Contents/MacOS/CodeInsights` 8 秒未退出，运行时初始化、默认 workspace 和 IPC 注册完成；存在非 Codex 阻断的 icon 路径 warning。
- 验证通过：`bun run typecheck`；`bun test --isolate`，600 pass / 0 fail；`bun run electron:build`；`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast`；`bun run --filter='@codeinsights/electron' smoke:agent-history-reload-ui`；`bun run --filter='@codeinsights/electron' smoke:agent-codex -- --only mcp`；packaged app startup smoke；`git diff --check`。
- 阶段边界：未修改根 `README.md` / `AGENTS.md`，未进入 Phase 8 发布文档或长期维护。

## 10. Phase 8：文档、发布与长期维护

目标：让实现状态、能力边界和后续维护策略与代码一致。

依赖：Phase 7。

推荐 PR：`docs(agent): document codex runtime support`

涉及文件：

- `docs/codex-support/2026-05-25-agent-codex-runtime-integration-plan.md`
- `docs/codex-support/2026-05-25-agent-codex-runtime-development-checklist.md`
- `docs/codex-support/README.md`
- `README.md` 仅在用户明确允许后修改
- `AGENTS.md` 仅在用户明确允许后修改
- `tasks/todo.md`

任务：

- [x] 回填主方案中与实际实现不同的地方。
- [x] 更新本清单每个阶段的完成状态。
- [x] 新增真实 smoke test 记录。
- [x] 新增 SDK / CLI 升级兼容记录。
- [x] 新增已知限制列表：permission parity、rewind、fork、queue、legacy SSE MCP、真实模型 MCP tool-call smoke。
- [x] 新增故障排查：auth missing、binary missing、channel invalid、history replay failed。
- [x] 如需改 README / AGENTS.md，先向用户确认。
- [x] 准备发布说明草稿。

验证：

- [x] Markdown code fence 检查。
- [x] docs 相对链接检查。
- [x] `git diff --check -- docs/codex-support tasks/todo.md`

退出标准：

- [x] 文档和实现一致。
- [x] 用户能理解 Codex runtime 的能力边界。
- [x] 后续 SDK 升级有明确验证入口。

回滚点：

- [x] 文档阶段不应改变运行时行为。

Phase 8 执行记录：

- 主方案状态已从“设计方案”同步为“Phase 8 文档同步”，并补充实现状态快照：`CodingAgentRuntimeRegistry`、`CodexAgentRuntime`、runtime events 历史、feature flag、workspace MCP 注入和 channel API key smoke 暂缓边界。
- 开发清单、support README 和 next-session prompt 均同步到 `2cd195b1 docs(agent): 暂缓 Codex API key smoke` 后状态；下次启动不再把 API key smoke 作为 Phase 8 前置阻塞。
- 根 `README.md` / `AGENTS.md` 本轮未修改；若公开文档需要同步，仍需用户明确允许。
- 文档验证通过：Markdown code fence 检查、docs 相对链接检查、`git diff --check -- docs/codex-support tasks/todo.md`。
- Phase 8 文档成果已提交为 `d04ffb95 docs(agent): 完成 Codex Runtime Phase 8 文档`。

真实 smoke test 记录：

| Smoke | 状态 | 记录 |
| --- | --- | --- |
| `binary.darwin-arm64` | passed | app bundle / 本地 binary 均输出 `codex-cli 0.130.0` |
| `native-auth.readonly` | passed | 返回 `codeinsights-codex-native-ok`，thread `019e63a4-3186-7f40-a97b-a0cd2a6a0932` |
| `readonly-plan.no-write` | passed | 文件保持 `before-readonly`，thread `019e63a5-0a1d-7571-a7f9-2ea212be46b5` |
| `workspace-write.file-edit` | passed | 只改目标文件为 `phase7 workspace write ok`，thread `019e63a5-7da1-7fb3-ace8-deec5f2dc74d` |
| `resume.context` | passed | 第二轮返回首轮口令，thread `019e63a6-5806-7013-a8af-651efad3ffe5` |
| `web-search.current-support` | passed | 返回 npm latest `@openai/codex` 版本 `0.133.0`，thread `019e63a7-0b84-7993-bf33-028d39b15593` |
| `stop.long-run` | passed | 最终终态 `run_stopped` |
| `smoke:agent-history-reload-ui` | passed | packaged app 启动两次，真实 UI 展示 fixture Codex 历史标题、用户消息和 assistant 消息 |
| `mcp.config-injection` | passed | 从真实 helper 输出派生 CLI override，`codex mcp list --json` 可识别 stdio/http `mcp_servers` |
| `channel-api-key.readonly` | skipped / 暂缓 | 未设置 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY`；用户要求暂缓，不再阻塞 Phase 8 |

SDK / CLI 升级兼容记录：

- 当前锁定版本：`@openai/codex-sdk@0.130.0`、`@openai/codex@0.130.0`；Phase 7 web-search 记录 npm latest 为 `0.133.0`，本阶段未升级。
- 升级前必须复核 SDK TypeScript 类型：`Codex`、`startThread()`、`resumeThread()`、`runStreamed()`、`ThreadEvent` item 类型、`CodexOptions.config` 和 `env` 替换语义。
- 升级后必须重跑：`bun test apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts apps/electron/src/main/lib/agent-orchestrator.test.ts apps/electron/scripts/agent-codex-smoke.test.ts`。
- 升级后必须重跑 gated smoke：binary、native、readonly、workspace-write、resume、web-search、stop、mcp config injection 和 packaged history reload UI。
- 打包升级要同步检查 `apps/electron/package.json` optional platform packages、`build:main` external、`electron-builder.yml` files glob，以及 macOS arm64 / macOS x64 / Windows x64 runner 上的实际 binary 包安装策略。

已知限制：

- Codex 首版没有 Claude `canUseTool` 等价的 per-tool permission UI，只提供 sandbox / approval / network / web-search 级策略。
- `queueMessage`、soft interrupt、rewind、fork 仍不与 Claude 等价；首版应禁用或明确展示 unsupported。
- `danger-full-access` 仍需要高级开关、二次确认文案和测试；默认 `bypassPermissions` 不直接升级到 danger。
- Workspace MCP 已支持 stdio/http 原生配置注入；legacy SSE、复杂 HTTP header key 的无泄漏保真映射、真实模型强制调用本地 MCP 的 smoke 仍待后续评估。
- `CODEX_SMOKE_API_KEY` channel API key smoke 暂缓，不代表 OpenAI / Custom channel 成功路径已真实通过。
- Linux packaged binary 是否进入首版支持矩阵仍未定。

故障排查：

- `codex_auth_missing`：确认 Agent Codex auth 来源；native 模式检查隔离 `CODEX_HOME/auth.json` 是否复制成功，且同源 `config.toml` 是否保留中转 `model_provider` / `base_url`。
- `codex_binary_missing`：检查 `@openai/codex` 和当前平台 optional package 是否安装，打包产物是否包含 `node_modules/@openai/codex*`，以及 `.asar.unpacked` 路径解析是否命中。
- `channel invalid`：检查 `agentCodexChannelId` 指向的渠道是否仍存在、provider 是否为 OpenAI / Custom 兼容、safeStorage 是否能解密 API key；Renderer 初始化会清理无效 channel。
- `history replay failed`：检查 `agent-sessions.json`、对应 JSONL 和 runtime event log 是否存在且 validator 通过；Codex 会话优先从 runtime events 回放，不依赖伪造 Claude SDKMessage。
- `MCP config missing`：检查 workspace `mcp.json` 中 server 是否 enabled、类型是否 stdio/http、env/header 名称是否被安全策略跳过，确认 secret 没有进入 SDK `--config` argv。

发布说明草稿：

- 新增 Agent 模式 Codex Runtime 实验性支持，可在 feature flag 下选择 Codex 作为 coding-agent runtime。
- 新增 Codex runtime 设置：auth 来源、模型、reasoning effort、network access 和 web search。
- 新增 Codex runtime transcript 历史回放，重开应用后可恢复 Codex 会话主要消息与工具活动。
- 新增 Codex workspace MCP stdio/http 原生配置注入，secret 通过环境变量间接传递，避免出现在 CLI argv。
- 新增 Codex smoke 工具：`smoke:agent-codex` 和 `smoke:agent-history-reload-ui`，用于真实 runtime 与 packaged UI 验证。
- 已知限制：channel API key smoke 暂缓；per-tool permission、queue、rewind、fork、legacy SSE MCP、Linux packaged binary 支持矩阵仍需后续补齐。

## 11. 横向质量门禁

每个代码阶段都需要复核这些横向要求。

兼容性：

- [ ] 旧 Claude Agent 会话可打开。
- [ ] 旧 `sdkSessionId` 会话可继续发送。
- [ ] 旧 settings 文件可读取。
- [ ] Pipeline Codex 节点行为不回归。
- [ ] feature flag 关闭时用户看不到半成品 Codex UI。

安全：

- [ ] API key 不写入日志。
- [ ] `CODEX_API_KEY` 只进入子进程 env。
- [ ] API key 模式不读取用户全局 `CODEX_HOME`。
- [ ] native auth 模式不继承真实 `HOME` 到子进程。
- [ ] 危险 Git env 被清理。
- [ ] 默认阻断远端 Git 写和交互凭证。
- [ ] 附件路径来自已校验 attachment service。

事件与状态：

- [ ] 每个 run 只有一个 terminal event。
- [ ] stop 后不会落 completed。
- [ ] `thread.started` / `sdk_session` 去重。
- [ ] runtime events 可通过 validator。
- [ ] history replay 缺失或损坏时 UI 有降级提示。

测试：

- [ ] 新增逻辑有单测。
- [ ] 真实 Codex 测试不进入默认 CI。
- [ ] mock SDK 不依赖本机登录。
- [ ] stop 竞态有测试。
- [ ] settings 无效 channel cleanup 有测试。

UI：

- [ ] Codex runtime badge 可见。
- [ ] 权限语义与 Claude 区分清楚。
- [ ] 不支持能力有禁用态或隐藏态。
- [ ] 错误提示给出恢复动作。
- [ ] 设置页不混淆 Agent Codex 和 Pipeline Codex。

## 12. 阶段提交记录

后续每完成一个阶段，在这里记录提交和验证摘要。

| Phase | 状态 | 分支 / PR | 提交 | 验证摘要 | 残余风险 |
| --- | --- | --- | --- | --- | --- |
| 文档准备 | [x] | `agent-mode-codex` | `feb46548` + `c546bc4e` | 文档结构、相对链接、章节检查、diff 空白检查通过 | 当时未运行代码验证 |
| Phase 0 | [x] | `codex/agent-codex-runtime-phase-0` | `29e48a93` | `bun run typecheck`、`bun test --isolate`、`bun run electron:build`、`git diff --check` 通过 | 当时产品门禁未确认，后续已在 Phase 1 前确认；未做真实 Codex Agent 集成 |
| Phase 1 | [x] | `codex/agent-codex-runtime-phase-0` | `6127b46c` | `bun test packages/shared`、`bun test apps/electron/src/main/lib/settings-service.test.ts`、`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`、`bun test --isolate`、`bun run typecheck`、`git diff --check` 通过 | 尚未接入 runtime core / UI / 真实 Codex |
| Phase 2 | [x] | `codex/agent-codex-runtime-phase-0` | `f04d893c` | `bun test apps/electron/src/main/lib/codex-runtime`、`bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check` 通过；代码审查复审无 Critical / High / Medium findings | `bun test --isolate` 曾遇到 `pipeline-git-submission-service` hook 偶发超时，单文件重跑通过；gitless workspace 未纳入 Phase 2 |
| Phase 3 | [x] | `codex/agent-codex-runtime-phase-0` | `98914a42` | `bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`、`bun test packages/shared/src/agent/runtime-events.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check` 通过；代码审查无 Critical / High findings | Adapter 尚未接入 runtime，失败可独立回滚；未做真实 Codex SDK 调用 |
| Phase 4 | [x] | `codex/agent-codex-runtime-phase-0` | `2c7ebb94` | `bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check` 通过；代码审查问题已修复并复审无 Critical / High | 尚未接入 Orchestrator 默认路由、Renderer UI 或真实 Codex SDK 调用 |
| Phase 5 | [x] | `codex/agent-codex-runtime-phase-0` | `40441fe8` | `bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`、`bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`、`bun test apps/electron/src/main/lib/agent-runtime-event-log.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`、`bun test apps/electron/src/main/lib/agent-runtimes/coding-agent-runtime-registry.test.ts`、`bun test apps/electron/src/main/lib/agent-session-manager.test.ts`、`bun test packages/shared`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check` 通过；代码审查问题已修复并复审无 Critical / High / Medium | Codex 仍为 mock runtime；尚未接 Renderer UI、runtime transcript 回放或真实 Codex SDK / CLI 调用 |
| Phase 6 | [x] | `codex/agent-codex-runtime-phase-0` | `58164e35` | `bun test apps/electron/src/renderer`、`bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`、`bun test packages/shared`、`bun run --filter='@codeinsights/electron' typecheck`、`git diff --check` 通过；代码审查复审无 Critical / High / Medium | Codex 仍为 mock runtime；尚未接 Phase 7 真实 Codex SDK / CLI 或打包发布验证 |
| Phase 7 | [x] | `codex/agent-codex-runtime-phase-0` | `1b94f9ad` + `a439d541` + `79c7fc92` + `dae13cd7` | `bun run typecheck`、`bun test --isolate`、`bun run electron:build`、`CODEINSIGHTS_AGENT_CODEX_RUNTIME=1 CSC_IDENTITY_AUTO_DISCOVERY=false bun run --filter='@codeinsights/electron' dist:fast`、binary smoke、stop smoke、packaged startup smoke 通过；修正 native config 后 native / read-only / workspace-write / resume / web-search 成功路径通过；fixture-based packaged history reload UI smoke 通过；MCP config injection smoke 通过；安全复审无 Critical / High / Medium | channel API key smoke 因缺少 `CODEX_SMOKE_API_KEY` 且未显式 opt-in `OPENAI_API_KEY` 跳过 |
| Phase 8 | [x] | `codex/agent-codex-runtime-phase-0` | `d04ffb95` | 主方案、开发清单、support README、next-session prompt 与 `tasks/todo.md` 已同步；Markdown code fence、docs 相对链接和 `git diff --check -- docs/codex-support tasks/todo.md` 通过 | channel API key smoke 暂缓；公开根 README/AGENTS 尚未同步，需用户明确允许 |

## 13. 当前未解决问题

- [ ] Codex TypeScript SDK 是否会暴露 approval request/response 通道。
- [ ] Codex CLI fork/resume 能力是否可稳定从 SDK 调用。
- [ ] `CODEX_SMOKE_API_KEY` channel API key smoke 暂缓；除非用户重新明确要求，否则不再作为启动优先级或 Phase 8 阻塞项，不得默认读取 ambient `OPENAI_API_KEY`。
- [ ] Codex workspace MCP 已支持 stdio/http 原生配置安全注入；legacy SSE 映射、含复杂 header key 的无泄漏保真映射和真实模型强制调用本地 MCP 的 smoke 仍需后续评估。
- [ ] Codex skills/plugin 与 CodeInsights skills/plugin 的长期关系。
- [x] Phase 8 文档、发布说明、故障排查和长期维护记录已完成 support 文档同步；根 README / AGENTS 是否公开同步需用户明确允许。
- [ ] `danger-full-access` 高级开关的具体 UI 入口、二次确认文案和测试仍未设计实现。
- [ ] Linux packaged binary 是否进入首版支持矩阵。
