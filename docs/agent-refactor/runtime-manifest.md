# Runtime Manifest 与目录模型

本文件定义 Workspace Runtime Registry / Runtime Materializer 的落盘目标。

## 目录模型

```text
~/.codeinsights/
  agent-workspaces/
    {workspace-slug}/
      workspace.json
      workspace-files/
      runtime/
        CLAUDE.md
        mcp.json
        .claude/
          settings.json
          skills/
          plugins/
      sessions/
        {session-id}/
          cwd/
          attachments/
          .context/
          session.json
          runtime-manifest.json
```

兼容规则：

- 旧 session cwd 继续使用旧路径，不强制移动。
- 新 session 默认使用 `sessions/{session-id}/cwd`。
- 旧 `mcp.json`、`skills/`、`.claude-plugin/plugin.json` 可被读取并转换为 manifest source。
- `workspace-files/` 不移动，避免破坏用户文件路径。

## Manifest 示例

```json
{
  "manifestVersion": 1,
  "materializerVersion": "2026-05-17.1",
  "workspaceId": "default",
  "workspaceSlug": "default",
  "sessionId": "agent-session-123",
  "workspaceRoot": "/Users/zq/.codeinsights/agent-workspaces/default",
  "runtimeRoot": "/Users/zq/.codeinsights/agent-workspaces/default/runtime",
  "claudeConfigDir": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude",
  "defaultCwd": "/Users/zq/.codeinsights/agent-workspaces/default/workspace-files",
  "sessionCwd": "/Users/zq/.codeinsights/agent-workspaces/default/sessions/agent-session-123/cwd",
  "mcpConfigPath": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/mcp.json",
  "settingsPath": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude/settings.json",
  "claudeMdPath": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/CLAUDE.md",
  "skillsDir": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude/skills",
  "pluginsDir": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude/plugins",
  "settingsHash": "sha256:...",
  "mcpHash": "sha256:...",
  "skillsSnapshotHash": "sha256:...",
  "pluginsSnapshotHash": "sha256:...",
  "enabledMcpServers": [
    {
      "id": "filesystem",
      "scope": "workspace",
      "hash": "sha256:..."
    }
  ],
  "enabledSkills": [
    {
      "id": "review-skill",
      "sourcePath": "/Users/zq/.codeinsights/agent-workspaces/default/skills/review-skill",
      "snapshotPath": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude/skills/review-skill",
      "materializeMode": "symlink",
      "hash": "sha256:..."
    }
  ],
  "enabledPlugins": [
    {
      "id": "local-plugin",
      "sourcePath": "/Users/zq/plugins/local-plugin",
      "snapshotPath": "/Users/zq/.codeinsights/agent-workspaces/default/runtime/.claude/plugins/local-plugin",
      "hash": "sha256:..."
    }
  ],
  "additionalDirectories": [
    {
      "path": "/Users/zq/Desktop/reference",
      "mode": "read"
    }
  ],
  "hostBridge": {
    "enabled": true,
    "tools": ["codeinsights_workspace_search", "codeinsights_memory_search", "codeinsights_open_file"]
  },
  "createdAt": "2026-05-17T10:00:00.000Z",
  "updatedAt": "2026-05-17T10:00:00.000Z",
  "generatedAt": "2026-05-17T10:00:00.000Z",
  "sourceConfigHash": "sha256:..."
}
```

## Settings 合并策略

CodeInsights 只管理白名单 key：

- `permissions`
- `mcpServers`
- `enabledPlugins`
- `plansDirectory`
- `skipWebFetchPreflight`
- 必要的 env 引用

规则：

- 用户手写 key 不覆盖。
- 白名单 key 冲突时写 `.codeinsights-conflicts.json`，并阻断 run。
- `plansDirectory` 指向 session cwd 内目录。
- 飞书等 channel-scoped MCP 不写 workspace manifest，只作为 run overlay 传入 Runner。

## 路径安全

- 对已存在路径段执行 `lstat`，拒绝 symlink 穿越。
- 使用 `realpath` 验证目标仍在 workspace root 内。
- 删除 snapshot 时只删除 manifest 记录的路径。
- additional directory 不复制进 runtime，只保存引用和权限。
- MCP command/env 不允许从 manifest 外部静默注入。
