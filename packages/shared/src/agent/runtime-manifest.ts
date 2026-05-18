export const agentRuntimeManifestV1 = {
  enabled: typeof process !== 'undefined' && process.env?.RV_AGENT_RUNTIME_MANIFEST_V1 === '1',
} as const

export interface AgentRuntimeManifestMcpServer {
  id: string
  scope: 'workspace'
  hash: string
  enabled: boolean
  type?: string
}

export interface AgentRuntimeManifestSkill {
  id: string
  sourcePath: string
  snapshotPath: string
  materializeMode: 'readonly-source' | 'copy'
  hash: string
  enabled: boolean
}

export interface AgentRuntimeManifestPlugin {
  id: string
  sourcePath: string
  snapshotPath: string
  hash: string
}

export interface AgentRuntimeManifestAdditionalDirectory {
  path: string
  mode: 'read'
}

export interface AgentRuntimeManifestHostBridge {
  enabled: boolean
  tools: string[]
}

export interface AgentRuntimeManifest {
  manifestVersion: 1
  materializerVersion: string
  workspaceId: string
  workspaceSlug: string
  sessionId?: string
  workspaceRoot: string
  runtimeRoot: string
  claudeConfigDir: string
  defaultCwd: string
  sessionCwd?: string
  mcpConfigPath: string
  settingsPath: string
  claudeMdPath: string
  skillsDir: string
  pluginsDir: string
  sessionRuntimeManifestPath?: string
  settingsHash: string
  mcpHash: string
  skillsSnapshotHash: string
  pluginsSnapshotHash: string
  runtimeHash: string
  enabledMcpServers: AgentRuntimeManifestMcpServer[]
  enabledSkills: AgentRuntimeManifestSkill[]
  enabledPlugins: AgentRuntimeManifestPlugin[]
  additionalDirectories: AgentRuntimeManifestAdditionalDirectory[]
  hostBridge: AgentRuntimeManifestHostBridge
  createdAt: string
  updatedAt: string
  generatedAt: string
  sourceConfigHash: string
}
