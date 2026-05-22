import type {
  AgentRuntimeEvent,
  AgentRuntimeRunnerMode,
  AgentStreamEnvelope,
  RVInsightsPermissionMode,
  SDKMessage,
} from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from './adapters/claude-agent-adapter'
import type { CanUseToolOptions, PermissionResult } from './agent-permission-service'
import type { TeamsCoordinator, TeamsCoordinatorDeps } from './agent-orchestrator/teams-coordinator'

const RUNNER_V2_DISABLED_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled'])
const RUNNER_V2_ENABLED_VALUES = new Set(['1', 'true', 'on', 'yes', 'enabled'])

type AgentRuntimeRunnerV2EnvOverride = 'enabled' | 'disabled' | null

function resolveAgentRuntimeRunnerV2EnvOverride(
  value = process.env.RV_AGENT_RUNTIME_RUNNER_V2,
): AgentRuntimeRunnerV2EnvOverride {
  if (value === undefined) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === '') return null
  if (RUNNER_V2_DISABLED_VALUES.has(normalized)) return 'disabled'
  if (RUNNER_V2_ENABLED_VALUES.has(normalized)) return 'enabled'
  return null
}

export function resolveAgentRuntimeRunnerV2Enabled(
  value = process.env.RV_AGENT_RUNTIME_RUNNER_V2,
): boolean {
  return resolveAgentRuntimeRunnerV2EnvOverride(value) !== 'disabled'
}

export const agentRuntimeRunnerV2 = {
  enabled: resolveAgentRuntimeRunnerV2Enabled(),
}

export type AgentRuntimeRunnerModeResolutionSource = 'default' | 'request' | 'env-disabled' | 'env-enabled'

export interface AgentRuntimeRunnerModeResolution {
  mode: AgentRuntimeRunnerMode
  source: AgentRuntimeRunnerModeResolutionSource
}

export function resolveAgentRuntimeRunnerModeForRun(input: {
  requestedMode?: AgentRuntimeRunnerMode
  envValue?: string
} = {}): AgentRuntimeRunnerModeResolution {
  const envOverride = resolveAgentRuntimeRunnerV2EnvOverride(input.envValue)
  if (envOverride === 'disabled') {
    return { mode: 'legacy', source: 'env-disabled' }
  }
  if (envOverride === 'enabled') {
    return { mode: 'runner-v2', source: 'env-enabled' }
  }
  if (input.requestedMode === 'legacy' || input.requestedMode === 'runner-v2') {
    return { mode: input.requestedMode, source: 'request' }
  }
  return {
    mode: agentRuntimeRunnerV2.enabled ? 'runner-v2' : 'legacy',
    source: 'default',
  }
}

export interface AgentRuntimePipelineMetadata {
  pipelineSessionId: string
  nodeId: string
  nodeRunId?: string
  version?: number
  reviewIteration?: number
}

export type AgentRuntimeRunMetadata =
  | { origin: 'agent'; pipeline?: never }
  | { origin: 'pipeline'; pipeline: AgentRuntimePipelineMetadata }

export interface AgentRuntimeRunInput {
  sessionId: string
  prompt: string
  model: string
  cwd: string
  permissionMode: RVInsightsPermissionMode
  queryOptions: ClaudeAgentQueryOptions
  resumeFrom?: string
  runtimeHash?: string
  channelModelId?: string
  runnerMode?: AgentRuntimeRunnerMode
  metadata?: AgentRuntimeRunMetadata
  abortSignal?: AbortSignal
}

export interface AgentRuntimeRunResult {
  runId: string
  terminalEvent?: AgentRuntimeEvent
  sdkSessionId?: string
  resultSubtype?: string
}

export interface AgentRuntimeSdkMessageStore {
  appendMessages(sessionId: string, messages: SDKMessage[]): void | Promise<void>
}

export interface AgentRuntimePermissionDecision {
  result: PermissionResult
  scope?: string
}

export interface AgentRuntimeAskUserDecision {
  response: string
  result: PermissionResult
}

export interface AgentRuntimeInteractionCallbacks {
  requestPermission?: (
    input: AgentRuntimePermissionCallbackInput,
  ) => Promise<AgentRuntimePermissionDecision>
  askUser?: (
    input: AgentRuntimeAskUserCallbackInput,
  ) => Promise<AgentRuntimeAskUserDecision>
}

export interface AgentRuntimePermissionCallbackInput {
  sessionId: string
  requestId: string
  toolName: string
  toolInput: Record<string, unknown>
  options: CanUseToolOptions
}

export interface AgentRuntimeAskUserCallbackInput {
  sessionId: string
  requestId: string
  toolInput: Record<string, unknown>
  signal: AbortSignal
}

export type AgentRuntimeQuery = (options: ClaudeAgentQueryOptions) => AsyncIterable<SDKMessage>

export interface AgentRuntimeRunnerDeps {
  query: AgentRuntimeQuery
  store: AgentRuntimeSdkMessageStore
  interactions?: AgentRuntimeInteractionCallbacks
  createTeamsCoordinator?: (initialSdkSessionId?: string) => TeamsCoordinator
  teamsCoordinatorDeps?: TeamsCoordinatorDeps
  watchdogIntervalMs?: number
  onTeamsWaitingResume?: (sessionId: string, message: string) => void
  onTeamsResumeStart?: (sessionId: string, messageId: string) => void
  now?: () => string
  createRunId?: () => string
  retryDelayMs?: (attempt: number) => number
  onSdkMessage?: (sessionId: string, message: SDKMessage) => void
}

export interface AgentRuntimeRunner {
  run(input: AgentRuntimeRunInput): AsyncIterable<AgentStreamEnvelope>
}
