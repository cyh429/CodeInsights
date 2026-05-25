# Agent 模式 Codex Runtime 开发进度清单

状态：待启动
日期：2026-05-25
主方案：[Agent 模式 Codex Runtime 接入开发方案](./2026-05-25-agent-codex-runtime-integration-plan.md)

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

## 1. 产品决策门禁

这些决策确认前，不应进入 UI 暴露和真实发布阶段。

| 状态 | 决策项 | 推荐值 | 影响 |
| --- | --- | --- | --- |
| [ ] | Codex 首版是否接受无逐工具权限 UI | 接受，仅提供 sandbox 级权限说明 | 影响 PermissionBanner、权限文案和安全边界 |
| [ ] | Codex 首版是否隐藏 rewind/fork/soft interrupt/queue message | 隐藏或禁用，并给出明确 tooltip | 影响 Agent header、会话操作菜单和输入区 |
| [ ] | Agent Codex 默认认证来源 | 本机 Codex auth / `CODEX_API_KEY`，不复用 Pipeline Codex channel | 影响 settings 默认值和迁移 |
| [ ] | `bypassPermissions` 是否默认允许 `danger-full-access` | 不允许，必须单独高级开关 | 影响 sandbox 策略和安全提示 |
| [ ] | Codex 历史是否以 runtime events 为主数据 | 是 | 影响 session manager、renderer history 和测试 |
| [ ] | 是否允许首版仅使用 Codex 自身 MCP 配置 | 允许，CodeInsights workspace MCP 映射后续单独验证 | 影响 materializer 和 MCP 设置页 |

门禁验收：

- [ ] 决策结果写回主方案或本清单。
- [ ] 相关 UI 文案和默认值与决策一致。
- [ ] 若用户选择与推荐值不同，补充风险说明和额外测试项。

## 2. Phase 0：基线冻结与实施准备

目标：确认当前 Claude Agent、Pipeline Codex、runtime events 基线，避免后续回归无法定位。

依赖：无。

任务：

- [ ] 复查当前工作树，记录已有未提交改动，避免误纳入实现阶段。
- [ ] 运行并记录基线验证：`bun run typecheck`。
- [ ] 运行并记录基线测试：`bun test --isolate`。
- [ ] 运行并记录 Electron 构建基线：`bun run electron:build`。
- [ ] 记录当前 `@openai/codex-sdk`、`@openai/codex`、`@anthropic-ai/claude-agent-sdk` 版本。
- [ ] 记录当前 `apps/electron/electron-builder.yml` 中 Codex / Claude binary 打包规则。
- [ ] 复查 `tasks/lessons.md` 中 Codex auth、Agent stop、runtime event、Git guard 相关教训。
- [ ] 建立阶段分支，建议命名 `codex/agent-codex-runtime-phase-0` 或按实际阶段命名。

验证：

- [ ] `bun run typecheck`
- [ ] `bun test --isolate`
- [ ] `bun run electron:build`
- [ ] `git diff --check`

退出标准：

- [ ] 基线验证结果记录到 `tasks/todo.md`。
- [ ] 未开始功能改动。
- [ ] 已确认后续阶段的提交边界。

回滚点：

- [ ] 当前阶段仅记录基线；如验证失败，先修复既有基线或明确标记为非本任务阻塞。

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

- [ ] 增加 `CodingAgentRuntimeKind = 'claude-code' | 'codex'`。
- [ ] 增加 `AgentRuntimeSessionRef`。
- [ ] 扩展 `AgentSessionMeta.runtimeKind`、`AgentSessionMeta.runtimeSession`。
- [ ] 保留 `sdkSessionId` 作为 Claude legacy 字段并标注迁移语义。
- [ ] 扩展 `AgentEventSource`，增加 `codex_sdk`、`codex_cli`。
- [ ] 扩展 `run_started.runtimeKind?: CodingAgentRuntimeKind`。
- [ ] 扩展 usage，可选支持 `reasoningOutputTokens`。
- [ ] 扩展 `AppSettings.agentRuntimeKind`。
- [ ] 增加 `agentCodexChannelId?: string | null`。
- [ ] 增加 `agentCodexModelId?: string`。
- [ ] 增加 `agentCodexReasoningEffort`、`agentCodexNetworkAccessEnabled`、`agentCodexWebSearchMode`。
- [ ] 实现旧 session lazy normalization：无 `runtimeKind` 且有 `sdkSessionId` 时视为 `claude-code`。
- [ ] 确保旧 settings 文件读取不需要一次性迁移。

测试：

- [ ] `runtime-events.test.ts` 覆盖新 source validator。
- [ ] `runtime-events.test.ts` 覆盖 `run_started.runtimeKind` 可选字段。
- [ ] `settings-service.test.ts` 覆盖新增 settings 字段读写。
- [ ] session manager 测试覆盖旧 `sdkSessionId` 会话归一化。
- [ ] 测试 Codex session 不写 `sdkSessionId` 的目标行为。

验证：

- [ ] `bun test packages/shared`
- [ ] `bun test apps/electron/src/main/lib/settings-service.test.ts`
- [ ] `bun run typecheck`
- [ ] `git diff --check -- packages/shared apps/electron/src/types apps/electron/src/main/lib tasks/todo.md`

退出标准：

- [ ] 旧 Claude Agent session 可以继续打开。
- [ ] 新字段不会改变默认 Agent runtime。
- [ ] Renderer 尚不暴露 Codex runtime UI。

回滚点：

- [ ] 可回滚 shared/settings 类型改动；无持久化破坏性迁移。

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

- [ ] 新增 `codex-runtime/` 目录。
- [ ] 抽出 `resolveCodexCliPath()` 与平台 target/package 映射。
- [ ] 抽出 `resolveCodexChannel()`，支持 `openai` / `custom`。
- [ ] 抽出 native auth 探测：`CODEX_HOME/auth.json`、`CODEX_API_KEY`、`HOME/.codex/auth.json`。
- [ ] 抽出 `buildCodexEnv()`，显式处理 env 替换语义。
- [ ] 抽出 `createCodexExecutionGuard()`，支持 purpose 区分 Agent / Pipeline 文案。
- [ ] 抽出 Git 环境清理和远端写保护。
- [ ] Pipeline runner 改为引用公共 core。
- [ ] 保持 Pipeline prompt、JSON Schema、节点结果解析不进入公共 core。
- [ ] 确认 API key 模式隔离 `CODEX_HOME`，native auth 模式只传明确 `CODEX_HOME`。

测试：

- [ ] `codex-binary.test.ts` 覆盖平台包映射和 `.asar.unpacked`。
- [ ] `codex-auth.test.ts` 覆盖 channel、native auth、env API key、无凭证失败。
- [ ] `codex-env.test.ts` 覆盖 PATH 保留、`ANTHROPIC_*` 清理、GitHub token 清理、proxy 注入。
- [ ] `codex-command-guard.test.ts` 覆盖 Pipeline 文案和 Agent 文案分离。
- [ ] `codex-pipeline-node-runner.test.ts` 继续通过。

验证：

- [ ] `bun test apps/electron/src/main/lib/codex-runtime`
- [ ] `bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts`
- [ ] `bun run --filter='@codeinsights/electron' typecheck`
- [ ] `git diff --check -- apps/electron/src/main/lib/codex-runtime apps/electron/src/main/lib/codex-pipeline-node-runner.ts tasks/todo.md`

退出标准：

- [ ] Pipeline Codex runner 行为不变。
- [ ] Agent 所需 Codex core 能力可直接复用。
- [ ] 无真实 Codex 调用进入默认测试。

回滚点：

- [ ] 可单独回滚到 Pipeline runner 内联实现；不影响 shared 类型。

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

- [ ] 定义 adapter 状态：thread id、started items、completed items、previous text/output、terminal flag。
- [ ] 实现 `thread.started -> sdk_session` 兼容映射。
- [ ] 实现 `agent_message` started/updated/completed 映射。
- [ ] 实现 `reasoning` 折叠式 task 映射。
- [ ] 实现 `command_execution -> Bash` 工具活动映射。
- [ ] 实现 `file_change -> PatchApply` 工具活动映射。
- [ ] 实现 `mcp_tool_call -> server.tool` 工具活动映射。
- [ ] 实现 `web_search -> WebSearch` 工具活动映射。
- [ ] 实现 `todo_list -> agent_task_*` 映射。
- [ ] 实现 `turn.completed -> usage_updated + run_completed`。
- [ ] 实现 `turn.failed` 和顶层 `error -> run_failed`。
- [ ] 实现 append-only delta 差分，非 append-only 时退化为完整覆盖。
- [ ] 实现 terminal 去重。

Fixtures：

- [ ] `agent-message-stream.jsonl`
- [ ] `command-success.jsonl`
- [ ] `command-failed.jsonl`
- [ ] `file-change.jsonl`
- [ ] `mcp-tool-call-success.jsonl`
- [ ] `mcp-tool-call-failed.jsonl`
- [ ] `web-search.jsonl`
- [ ] `todo-list.jsonl`
- [ ] `turn-failed.jsonl`
- [ ] `abort-after-completed-race.jsonl`

测试：

- [ ] 每类 item 映射为预期 runtime event。
- [ ] `item.updated` 不重复输出累计文本。
- [ ] `turn.completed` 前不产生 `run_completed`。
- [ ] `turn.failed` 不被当作成功。
- [ ] Abort 优先级由 adapter 或上层测试覆盖。

验证：

- [ ] `bun test apps/electron/src/main/lib/agent-runtimes/codex-event-adapter.test.ts`
- [ ] `bun test packages/shared/src/agent/runtime-events.test.ts`
- [ ] `bun run --filter='@codeinsights/electron' typecheck`
- [ ] `git diff --check -- apps/electron/src/main/lib/agent-runtimes packages/shared tasks/todo.md`

退出标准：

- [ ] Codex SDK 当前所有公开 item 类型均有明确映射或明确忽略策略。
- [ ] 不需要真实 Codex 即可稳定测试。
- [ ] 不伪造 Claude SDKMessage。

回滚点：

- [ ] Adapter 尚未接入 runtime，失败可独立回滚。

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

- [ ] 定义 `CodingAgentRuntime` 主进程接口。
- [ ] 定义 `CodingAgentRuntimeCapabilities`。
- [ ] 实现 Codex SDK client factory，可注入 mock。
- [ ] 实现 `CodexAgentRuntime.run()`。
- [ ] 支持 `startThread()`。
- [ ] 支持 `resumeThread(externalSessionId)`。
- [ ] 支持 `runStreamed()` async generator。
- [ ] 支持 `AbortSignal`。
- [ ] 支持 `workingDirectory`、`additionalDirectories`、`model`。
- [ ] 支持 `modelReasoningEffort`、`networkAccessEnabled`、`webSearchMode`。
- [ ] 支持 `sandboxMode`、`approvalPolicy` 映射。
- [ ] 支持 `thread.started` 后暴露 external session id。
- [ ] `queueMessage()` 返回 structured unsupported。
- [ ] `setPermissionMode()` 返回 structured unsupported。
- [ ] 错误分类为 `codex_auth_missing`、`codex_binary_missing`、`codex_channel_invalid`、`codex_turn_failed` 等。

测试：

- [ ] mock startThread 成功。
- [ ] mock resumeThread 成功。
- [ ] mock stream throw 映射 `run_failed`。
- [ ] mock turn.failed 映射 `run_failed`。
- [ ] abort before stream 映射 `run_stopped`。
- [ ] abort during stream 映射 `run_stopped`。
- [ ] stream 正常结束但 signal 已 aborted 时优先 `run_stopped`。
- [ ] unsupported capability 返回结构化结果。
- [ ] permission policy 单测覆盖 `plan`、`auto`、`bypassPermissions`。

验证：

- [ ] `bun test apps/electron/src/main/lib/agent-runtimes/codex-runtime.test.ts`
- [ ] `bun test apps/electron/src/main/lib/agent-runtimes/codex-permission-policy.test.ts`
- [ ] `bun run --filter='@codeinsights/electron' typecheck`
- [ ] `git diff --check -- apps/electron/src/main/lib/agent-runtimes apps/electron/src/main/lib/codex-runtime tasks/todo.md`

退出标准：

- [ ] Codex runtime 可在 mock 环境完整产出 runtime envelopes。
- [ ] 无真实 API key 和 native auth 依赖。
- [ ] 不影响 Claude Agent 默认路径。

回滚点：

- [ ] Codex runtime 未被 Orchestrator 默认路由，失败可关闭 feature flag 或回滚 runner 文件。

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

- [ ] 新增 `CodingAgentRuntimeRegistry`。
- [ ] 包装现有 Claude runner 为 `ClaudeCodeRuntime`。
- [ ] 解析 runtime 优先级：session `runtimeKind` > legacy `sdkSessionId` > settings > default。
- [ ] 新 session 首次运行后持久化 `runtimeKind` 和 `runtimeSession`。
- [ ] 运行中禁止切换 runtime。
- [ ] Orchestrator 统一消费 `AgentStreamEnvelope`。
- [ ] Orchestrator 不直接依赖 Codex `ThreadEvent`。
- [ ] Codex run 写 runtime event log。
- [ ] Claude run 行为保持不变。
- [ ] stop 同时触发 active abort controller 和 runtime abort。
- [ ] complete 前二次检查 active session / abort state。
- [ ] runtime unsupported capability 透传到 UI 可处理的错误或状态。

测试：

- [ ] mock Claude runtime 默认被选择。
- [ ] legacy `sdkSessionId` 会话被选择为 `claude-code`。
- [ ] settings 选择 Codex 时新会话使用 Codex。
- [ ] 已绑定 Claude session 不被 settings 切到 Codex。
- [ ] 已绑定 Codex session 不被 settings 切到 Claude。
- [ ] stop 后不落 `run_completed`。
- [ ] Codex `thread.started` 持久化 `runtimeSession.externalSessionId`。
- [ ] runtime 抛错后 active run 清理。

验证：

- [ ] `bun test apps/electron/src/main/lib/agent-orchestrator.test.ts`
- [ ] `bun test apps/electron/src/main/lib/agent-runtime-runner.test.ts`
- [ ] `bun run --filter='@codeinsights/electron' typecheck`
- [ ] `git diff --check -- apps/electron/src/main/lib apps/electron/src/main/ipc tasks/todo.md`

退出标准：

- [ ] Claude Agent 默认路径无行为回归。
- [ ] Codex runtime 可通过 feature flag 或设置在主进程路径跑通 mock。
- [ ] 运行中状态和终态去重稳定。

回滚点：

- [ ] 关闭 `CODEINSIGHTS_AGENT_CODEX_RUNTIME` 后所有新会话回到 Claude Code。

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

- [ ] 新增 `getAgentSessionRuntimeEvents` IPC / preload API。
- [ ] Renderer 加载 Codex session 时读取 runtime events。
- [ ] 实现 runtime transcript selector。
- [ ] 实现 `RuntimeTranscript` 组件。
- [ ] Agent settings 增加 Runtime 选择：Claude Code / Codex。
- [ ] Codex 认证来源 UI：native auth / OpenAI 或 Custom channel。
- [ ] Codex channel 下拉只显示 enabled openai/custom。
- [ ] Codex 模型设置独立于 Claude `agentModelId`。
- [ ] Codex reasoning effort、network、web search 设置。
- [ ] Agent header 显示当前 session runtime。
- [ ] Codex session 禁用或隐藏 rewind/fork/soft interrupt/queue message。
- [ ] Codex runtime 下不展示 Claude per-tool PermissionBanner。
- [ ] 设置中无效 `agentCodexChannelId` 自动清理。
- [ ] Feature flag 关闭时 UI 不显示 Codex runtime 入口。

测试：

- [ ] runtime transcript selector 合并 user message 和 runtime assistant/tool events。
- [ ] settings initializer 清理 deleted/disabled/unsupported channel。
- [ ] Codex session header badge 正确。
- [ ] unsupported capability UI 有明确文案。
- [ ] runtime events 缺失时有降级提示。

验证：

- [ ] `bun test apps/electron/src/renderer`
- [ ] `bun run --filter='@codeinsights/electron' typecheck`
- [ ] 手动 UI smoke：feature flag 开启后能看到 Codex runtime 设置。
- [ ] 手动 UI smoke：feature flag 关闭后不显示 Codex runtime 设置。
- [ ] `git diff --check -- apps/electron/src/preload apps/electron/src/main/ipc apps/electron/src/renderer tasks/todo.md`

退出标准：

- [ ] 用户能显式选择 Codex runtime。
- [ ] Codex 会话重开后能从 runtime events 恢复主要 transcript。
- [ ] 不支持能力不会静默失败。
- [ ] Claude UI 行为不回归。

回滚点：

- [ ] 关闭 feature flag 可隐藏 Codex UI，保留已写 runtime events。

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

- [ ] 确认 `@openai/codex-sdk` / `@openai/codex` 版本。
- [ ] 确认 esbuild external 包含 Codex SDK/CLI。
- [ ] 确认 electron-builder files 包含 SDK、CLI 和平台 binary 包。
- [ ] 确认 macOS arm64 binary 可解析。
- [ ] 确认 macOS x64 binary 策略。
- [ ] 确认 Windows x64 binary 策略。
- [ ] 使用隔离 `CODEINSIGHTS_CONFIG_DIR` 做真实 smoke。
- [ ] native auth 模式：新建 Codex 会话并发送只读请求。
- [ ] channel API key 模式：新建 Codex 会话并发送只读请求。
- [ ] workspace-write 模式：让 Codex 修改一个隔离测试文件。
- [ ] read-only plan 模式：确认不能写文件。
- [ ] stop 长任务，最终状态为 stopped。
- [ ] resume 同一 Codex thread，确认上下文延续。
- [ ] 重启应用，确认 history reload。
- [ ] web search / MCP 按当前支持情况记录真实结果。
- [ ] 打包后运行 Agent Codex smoke。

验证：

- [ ] `bun run typecheck`
- [ ] `bun test --isolate`
- [ ] `bun run electron:build`
- [ ] `CSC_IDENTITY_AUTO_DISCOVERY=false bun run dist:fast`
- [ ] 手动 smoke 记录 native auth 结果。
- [ ] 手动 smoke 记录 channel API key 结果。
- [ ] 手动 smoke 记录 packaged app 结果。

退出标准：

- [ ] Codex Agent 首版关键用户路径可真实运行。
- [ ] stop/resume/history reload 均通过真实验证。
- [ ] 打包后 binary 可解析。
- [ ] 已记录不支持项和残余风险。

回滚点：

- [ ] 若真实 Codex 集成不稳定，保留代码但默认关闭 `CODEINSIGHTS_AGENT_CODEX_RUNTIME`。

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

- [ ] 回填主方案中与实际实现不同的地方。
- [ ] 更新本清单每个阶段的完成状态。
- [ ] 新增真实 smoke test 记录。
- [ ] 新增 SDK / CLI 升级兼容记录。
- [ ] 新增已知限制列表：permission parity、rewind、fork、queue、MCP 注入。
- [ ] 新增故障排查：auth missing、binary missing、channel invalid、history replay failed。
- [ ] 如需改 README / AGENTS.md，先向用户确认。
- [ ] 准备发布说明草稿。

验证：

- [ ] Markdown code fence 检查。
- [ ] docs 相对链接检查。
- [ ] `git diff --check -- docs/codex-support tasks/todo.md`

退出标准：

- [ ] 文档和实现一致。
- [ ] 用户能理解 Codex runtime 的能力边界。
- [ ] 后续 SDK 升级有明确验证入口。

回滚点：

- [ ] 文档阶段不应改变运行时行为。

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
| Phase 0 | [ ] | - | - | - | - |
| Phase 1 | [ ] | - | - | - | - |
| Phase 2 | [ ] | - | - | - | - |
| Phase 3 | [ ] | - | - | - | - |
| Phase 4 | [ ] | - | - | - | - |
| Phase 5 | [ ] | - | - | - | - |
| Phase 6 | [ ] | - | - | - | - |
| Phase 7 | [ ] | - | - | - | - |
| Phase 8 | [ ] | - | - | - | - |

## 13. 当前未解决问题

- [ ] Codex TypeScript SDK 是否会暴露 approval request/response 通道。
- [ ] Codex CLI fork/resume 能力是否可稳定从 SDK 调用。
- [ ] CodeInsights workspace MCP 配置如何映射到 Codex 原生 MCP。
- [ ] Codex skills/plugin 与 CodeInsights skills/plugin 的长期关系。
- [ ] `danger-full-access` 是否允许进入普通设置 UI。
- [ ] Linux packaged binary 是否进入首版支持矩阵。
