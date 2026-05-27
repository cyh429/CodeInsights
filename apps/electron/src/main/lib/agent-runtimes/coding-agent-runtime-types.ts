import type {
  AgentQueueMessageInput,
  AgentRuntimeAuthSource,
  AgentRuntimeEvent,
  AgentRuntimeRunnerMode,
  AgentStreamEnvelope,
  CodeInsightsPermissionMode,
  CodingAgentRuntimeKind,
} from '@codeinsights/shared'
import type {
  Input as CodexInput,
  CodexOptions,
  ModelReasoningEffort,
  SandboxMode,
  WebSearchMode,
} from '@openai/codex-sdk'

export type CodingAgentRuntimeCapability =
  | 'streamEvents'
  | 'resumeThread'
  | 'abort'
  | 'queueMessage'
  | 'setPermissionMode'
  | 'perToolPermission'
  | 'serverStatus'
  | 'modelRefresh'

export interface CodingAgentRuntimeCapabilities {
  runtimeKind: CodingAgentRuntimeKind
  displayName?: string
  supportsStreamEvents: boolean
  supportsResumeThread: boolean
  supportsAbort: boolean
  supportsQueueMessage: boolean
  supportsSetPermissionMode: boolean
  supportsPerToolPermission: boolean
  supportsServerStatus?: boolean
  supportsModelRefresh?: boolean
  authSources?: AgentRuntimeAuthSource[]
}

export interface CodingAgentRuntimeRunInput {
  sessionId: string
  prompt: CodexInput
  model?: string
  workingDirectory: string
  additionalDirectories?: string[]
  permissionMode: CodeInsightsPermissionMode
  externalSessionId?: string
  channelId?: string | null
  runtimeHash?: string
  runId?: string
  runnerMode?: AgentRuntimeRunnerMode
  repositoryRoot?: string
  abortSignal?: AbortSignal
}

export interface CodexCodingAgentRuntimeRunInput extends CodingAgentRuntimeRunInput {
  modelReasoningEffort?: ModelReasoningEffort
  networkAccessEnabled?: boolean
  webSearchMode?: WebSearchMode
  allowDangerFullAccess?: boolean
  codexConfig?: CodexOptions['config']
  codexConfigEnv?: Record<string, string>
}

export interface OpencodeCodingAgentRuntimeRunInput extends CodingAgentRuntimeRunInput {
  agent?: string
  authSource?: AgentRuntimeAuthSource
  runtimeConfigHash?: string
  authSourceHash?: string
  permissionPolicyHash?: string
}

export interface CodingAgentRuntimeRunResult {
  runId: string
  terminalEvent?: AgentRuntimeEvent
  externalSessionId?: string
}

export type UnsupportedRuntimeCapability =
  | 'queueMessage'
  | 'setPermissionMode'

export interface UnsupportedRuntimeCapabilityResult {
  ok: false
  code: 'runtime_capability_unsupported'
  runtimeKind: CodingAgentRuntimeKind
  capability: UnsupportedRuntimeCapability
  message: string
}

export interface CodingAgentRuntime {
  readonly kind: CodingAgentRuntimeKind
  getCapabilities(): CodingAgentRuntimeCapabilities
  run(input: CodingAgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope>
  abort(sessionId: string): void
  queueMessage(input: AgentQueueMessageInput): Promise<UnsupportedRuntimeCapabilityResult>
  setPermissionMode(sessionId: string, mode: CodeInsightsPermissionMode): Promise<UnsupportedRuntimeCapabilityResult>
  dispose(): void
}

export interface CodexCommandGuardPolicy {
  blockGitBinary: boolean
}

export interface ResolvedCodexPermissionPolicy {
  sandboxMode: SandboxMode
  approvalPolicy: 'never'
  networkAccessEnabled: boolean
  webSearchMode: WebSearchMode
  commandGuardPolicy: CodexCommandGuardPolicy
  warning?: string
}
