import type {
  AgentRuntimeEvent,
  AgentStreamEnvelope,
  RVInsightsPermissionMode,
  SDKMessage,
} from '@rv-insights/shared'
import type { ClaudeAgentQueryOptions } from './adapters/claude-agent-adapter'
import type { CanUseToolOptions, PermissionResult } from './agent-permission-service'
import type { TeamsCoordinator, TeamsCoordinatorDeps } from './agent-orchestrator/teams-coordinator'

export const agentRuntimeRunnerV2 = {
  enabled: process.env.RV_AGENT_RUNTIME_RUNNER_V2 === '1',
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
