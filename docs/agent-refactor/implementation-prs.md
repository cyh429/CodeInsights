# 第一批实现 PR 拆分

本文件把迁移路线前半段拆成可独立评审的 PR。每个 PR 都应保持小范围、可回滚、可验证。

## 全局 UI 约束

第一批 PR 默认不允许客户端 UI 可见变化：

- 不改 `AgentView`、`AgentHeader`、`AgentMessages`、输入区、权限横幅、AskUser 横幅、右侧文件面板的布局和样式。
- 不新增可见设置项、按钮、标签页、提示文案或调试面板。
- 不改变发送、停止、权限审批、AskUser、文件面板、session 切换的操作路径。
- Renderer 相关 PR 只能替换内部数据来源，验收标准是最终 view model 与旧路径一致。
- 如需任何可见 UI 变化，必须拆成单独 PR 并先征求用户确认。

## PR 1：Shared Event Contract

目标：新增 `AgentStreamEnvelope` / `AgentRuntimeEvent`，不改变现有运行行为。

包含：

- `packages/shared/src/agent/` 新增 runtime event 类型。
- 新增 SDKMessage fixture 和 event fixture。
- 新增 reducer 测试骨架。
- 新增旧 payload 到新 envelope 的 adapter。

不包含：

- 不改 SDK query。
- 不删 `AgentEvent`。
- 不改 workspace 目录。

验证：

- `bun run typecheck`
- `bun test` 对 event fixture/reducer 测试。
- `git diff --check`
- 客户端 UI diff 为零。

回滚：

- 关闭 `agentRuntimeEventsV2`。

## PR 2：Event Log 双写

目标：Runtime Service 或 Orchestrator 双写新 event log，同时 UI 仍走旧路径。

包含：

- `{session-id}.events.jsonl` 写入。
- `runId`、`sequence`、终态去重。
- 新旧 reducer shadow compare 日志。

不包含：

- 不切 UI 主 reducer。
- 不抽 Runner。

验证：

- 发送、停止、权限、AskUser 的 event log 可重放。
- 重复终态不会写入。
- 客户端 UI diff 为零。

回滚：

- 停止写 events JSONL，旧 SDKMessage JSONL 不受影响。

## PR 3：In-process AgentRuntimeRunner

目标：抽出 Runner，但仍在主进程内执行。

包含：

- `agent-runtime-runner.ts`
- `agent-sdk-env.ts`
- `agent-sdk-message-converter.ts`
- Runner mock SDK stream 测试。

不包含：

- 不改 workspace runtime materialization。
- 不让 Pipeline 复用 Runner。
- 不改外部渠道。

验证：

- Agent 发送、停止、resume、权限 approve/deny。
- SDKMessage JSONL 与 event JSONL 都正常。
- 客户端 UI diff 为零。

回滚：

- 关闭 `agentRuntimeRunnerV2`，回到旧 Orchestrator 路径。

## PR 4：Runtime Manifest 只读解析

目标：新增 Registry/Manifest，但先只读旧 workspace 配置并生成 manifest，不改变 cwd。

包含：

- `agent-runtime-registry.ts`
- `runtime-manifest.ts`
- 旧 `mcp.json` / `skills/` 转 manifest source。
- 路径安全 fixture。

不包含：

- 不移动旧 session。
- 不写新 settings。
- 不启用 plugin snapshot。

验证：

- 旧工作区都能生成 manifest。
- symlink/path traversal fixture 被拒绝。
- 客户端 UI diff 为零。

回滚：

- Runner 不读取 manifest，继续旧 workspace manager。

## PR 5：Runtime Materializer for New Sessions

目标：新 session 使用新 runtime 目录；旧 session 兼容。

包含：

- `.claude/settings.json` 白名单写入。
- `.claude/skills` 物化。
- `runtime/mcp.json` 写入。
- `runtime-manifest.json` 写入 session 目录。

不包含：

- 不启用外部 channel 迁移。
- 不复用 Pipeline Runner。

验证：

- 新 session 目录符合 `runtime-manifest.md`。
- 旧 session resume 不变。
- MCP/Skill 变更后 manifest hash 变化。
- 客户端 UI diff 为零。

回滚：

- 关闭 `agentRuntimeMaterializerV2`，新 session 回到旧目录策略。

## PR 6：Renderer 切新 Reducer

目标：UI 主路径消费 `AgentStreamEnvelope`。

包含：

- `useGlobalAgentListeners` 消费新 envelope。
- `agent-atoms` 切到新 reducer。
- `SDKMessageRenderer` 降级为 transcript/debug。
- 删除 `payloadToLegacyEvents()`。

不包含：

- 不改 Runner。
- 不改外部渠道。

验证：

- fixture replay 通过。
- 发送、停止、权限、AskUser、MCP、Skill、文件上传人工基线通过。
- 客户端 UI diff 为零，所有可见 view model 与旧 reducer 一致。

回滚：

- 重新启用旧 reducer flag。

## PR 7：External Channel Adapter

目标：飞书迁移为 AgentChannel adapter。

包含：

- `agent-channel.ts`
- `agent-electron-channel.ts`
- `feishu-agent-channel.ts`
- channel session binding 存储。
- 飞书权限策略默认 `queue_to_desktop`。

不包含：

- 不迁移钉钉/微信，除非接口稳定。
- 不默认 bypassPermissions。

验证：

- 飞书输入绑定到同一 runtime session。
- assistant_delta 节流卡片更新。
- permission_requested 进入桌面 pending 或飞书卡片审批。
- Electron 客户端 UI diff 为零。

回滚：

- `agentRuntimeChannelsV2` 关闭，旧 feishu bridge 保留。
