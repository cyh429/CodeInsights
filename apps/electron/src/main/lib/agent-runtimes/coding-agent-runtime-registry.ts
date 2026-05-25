import type {
  AgentSessionMeta,
  CodingAgentRuntimeKind,
} from '@codeinsights/shared'
import type {
  CodingAgentRuntime,
  CodingAgentRuntimeCapabilities,
} from './coding-agent-runtime-types'

export type AgentRuntimeSelectionSource =
  | 'session'
  | 'legacy-sdk-session'
  | 'settings'
  | 'default'

export interface AgentRuntimeSettingsLike {
  agentRuntimeKind?: CodingAgentRuntimeKind
  agentCodexChannelId?: string | null
  agentCodexModelId?: string
}

export interface AgentRuntimeSelection {
  kind: CodingAgentRuntimeKind
  source: AgentRuntimeSelectionSource
  externalSessionId?: string
  channelId?: string | null
  model?: string
}

export interface ResolveAgentRuntimeSelectionInput {
  sessionMeta?: AgentSessionMeta
  settings?: AgentRuntimeSettingsLike
  defaultKind?: CodingAgentRuntimeKind
}

export class CodingAgentRuntimeRegistry {
  private readonly runtimes = new Map<CodingAgentRuntimeKind, CodingAgentRuntime>()

  register(runtime: CodingAgentRuntime): void {
    this.runtimes.set(runtime.kind, runtime)
  }

  get(kind: CodingAgentRuntimeKind): CodingAgentRuntime | undefined {
    return this.runtimes.get(kind)
  }

  require(kind: CodingAgentRuntimeKind): CodingAgentRuntime {
    const runtime = this.get(kind)
    if (!runtime) {
      throw new Error(`未注册 Coding Agent Runtime: ${kind}`)
    }
    return runtime
  }

  listCapabilities(): CodingAgentRuntimeCapabilities[] {
    return [...this.runtimes.values()].map((runtime) => runtime.getCapabilities())
  }

  dispose(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.dispose()
    }
    this.runtimes.clear()
  }
}

export function resolveAgentRuntimeSelection(
  input: ResolveAgentRuntimeSelectionInput,
): AgentRuntimeSelection {
  const defaultKind = input.defaultKind ?? 'claude-code'
  const sessionMeta = input.sessionMeta
  const runtimeSession = sessionMeta?.runtimeSession

  if (runtimeSession) {
    return {
      kind: runtimeSession.kind,
      source: 'session',
      externalSessionId: runtimeSession.externalSessionId,
      ...('channelId' in runtimeSession ? { channelId: runtimeSession.channelId } : {}),
      ...(runtimeSession.model ? { model: runtimeSession.model } : {}),
    }
  }

  if (sessionMeta?.runtimeKind === 'codex') {
    return {
      kind: 'codex',
      source: 'session',
    }
  }

  if (sessionMeta?.sdkSessionId) {
    return {
      kind: 'claude-code',
      source: 'legacy-sdk-session',
      externalSessionId: sessionMeta.sdkSessionId,
    }
  }

  if (input.settings?.agentRuntimeKind) {
    return buildSettingsSelection(input.settings)
  }

  return {
    kind: defaultKind,
    source: 'default',
  }
}

function buildSettingsSelection(settings: AgentRuntimeSettingsLike): AgentRuntimeSelection {
  if (settings.agentRuntimeKind === 'codex') {
    return {
      kind: 'codex',
      source: 'settings',
      channelId: settings.agentCodexChannelId,
      model: settings.agentCodexModelId,
    }
  }

  return {
    kind: 'claude-code',
    source: 'settings',
  }
}
