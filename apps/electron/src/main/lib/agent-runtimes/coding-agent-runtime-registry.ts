import type {
  AgentRuntimeAuthSource,
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
  agentOpencodeChannelId?: string | null
  agentOpencodeModelId?: string
  agentOpencodeAgentName?: string
  agentOpencodeUseNativeAuth?: boolean
}

export interface AgentRuntimeSelection {
  kind: CodingAgentRuntimeKind
  source: AgentRuntimeSelectionSource
  externalSessionId?: string
  channelId?: string | null
  model?: string
  agent?: string
  authSource?: AgentRuntimeAuthSource
  runtimeConfigHash?: string
  authSourceHash?: string
}

export interface ResolveAgentRuntimeSelectionInput {
  sessionMeta?: AgentSessionMeta
  settings?: AgentRuntimeSettingsLike
  defaultKind?: CodingAgentRuntimeKind
  enabledRuntimeKinds?: readonly CodingAgentRuntimeKind[]
}

const DEFAULT_ENABLED_RUNTIME_KINDS: readonly CodingAgentRuntimeKind[] = ['claude-code', 'codex']

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
  const enabledRuntimeKinds = input.enabledRuntimeKinds ?? DEFAULT_ENABLED_RUNTIME_KINDS
  const sessionMeta = input.sessionMeta
  const runtimeSession = sessionMeta?.runtimeSession

  if (runtimeSession) {
    return {
      kind: runtimeSession.kind,
      source: 'session',
      externalSessionId: runtimeSession.externalSessionId,
      ...('channelId' in runtimeSession ? { channelId: runtimeSession.channelId } : {}),
      ...(runtimeSession.model ? { model: runtimeSession.model } : {}),
      ...(runtimeSession.agent ? { agent: runtimeSession.agent } : {}),
      ...(runtimeSession.authSource ? { authSource: runtimeSession.authSource } : {}),
      ...(runtimeSession.runtimeConfigHash ? { runtimeConfigHash: runtimeSession.runtimeConfigHash } : {}),
      ...(runtimeSession.authSourceHash ? { authSourceHash: runtimeSession.authSourceHash } : {}),
    }
  }

  if (sessionMeta?.runtimeKind === 'codex' || sessionMeta?.runtimeKind === 'opencode') {
    return {
      kind: sessionMeta.runtimeKind,
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
    return buildSettingsSelection(input.settings, defaultKind, enabledRuntimeKinds)
  }

  return {
    kind: defaultKind,
    source: 'default',
  }
}

function buildSettingsSelection(
  settings: AgentRuntimeSettingsLike,
  defaultKind: CodingAgentRuntimeKind,
  enabledRuntimeKinds: readonly CodingAgentRuntimeKind[],
): AgentRuntimeSelection {
  if (!enabledRuntimeKinds.includes(settings.agentRuntimeKind ?? defaultKind)) {
    return {
      kind: enabledRuntimeKinds.includes(defaultKind) ? defaultKind : 'claude-code',
      source: 'default',
    }
  }

  if (settings.agentRuntimeKind === 'codex') {
    return {
      kind: 'codex',
      source: 'settings',
      channelId: settings.agentCodexChannelId,
      model: settings.agentCodexModelId,
    }
  }

  if (settings.agentRuntimeKind === 'opencode') {
    const authSource = resolveOpencodeAuthSource(settings)
    return {
      kind: 'opencode',
      source: 'settings',
      channelId: authSource === 'native' ? null : settings.agentOpencodeChannelId,
      model: settings.agentOpencodeModelId,
      agent: settings.agentOpencodeAgentName,
      ...(authSource ? { authSource } : {}),
    }
  }

  return {
    kind: 'claude-code',
    source: 'settings',
  }
}

function resolveOpencodeAuthSource(settings: AgentRuntimeSettingsLike): AgentRuntimeAuthSource | undefined {
  if (settings.agentOpencodeUseNativeAuth === true) return 'native'
  if (settings.agentOpencodeChannelId === null) return 'native'
  if (typeof settings.agentOpencodeChannelId === 'string') return 'channel'
  return undefined
}
