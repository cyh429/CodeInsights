import type { AgentSessionMeta, Channel, CodingAgentRuntimeKind } from '@codeinsights/shared'

export const CODEX_NATIVE_AUTH_SELECT_VALUE = '__codex_native_auth__'

export interface AgentRuntimeFeatureFlags {
  codex: boolean
  opencode: boolean
}

export function isAgentCodexRuntimeFeatureEnabled(
  enabled: boolean = typeof __CODEINSIGHTS_AGENT_CODEX_RUNTIME_ENABLED__ !== 'undefined'
    ? __CODEINSIGHTS_AGENT_CODEX_RUNTIME_ENABLED__
    : false,
): boolean {
  return enabled === true
}

export function isAgentOpencodeRuntimeFeatureEnabled(
  enabled: boolean = typeof __CODEINSIGHTS_AGENT_OPENCODE_RUNTIME_ENABLED__ !== 'undefined'
    ? __CODEINSIGHTS_AGENT_OPENCODE_RUNTIME_ENABLED__
    : false,
): boolean {
  return enabled === true
}

export function isAgentRuntimeKindEnabled(
  kind: CodingAgentRuntimeKind,
  flags: AgentRuntimeFeatureFlags = {
    codex: isAgentCodexRuntimeFeatureEnabled(),
    opencode: isAgentOpencodeRuntimeFeatureEnabled(),
  },
): boolean {
  if (kind === 'codex') return flags.codex
  if (kind === 'opencode') return flags.opencode
  return true
}

export function resolveEnabledAgentRuntimeKind(
  kind: CodingAgentRuntimeKind | undefined,
  flags?: AgentRuntimeFeatureFlags,
): CodingAgentRuntimeKind {
  const candidate = kind ?? 'claude-code'
  return isAgentRuntimeKindEnabled(candidate, flags) ? candidate : 'claude-code'
}

export function isCodexCompatibleChannel(channel: Channel): boolean {
  return channel.enabled && (channel.provider === 'openai' || channel.provider === 'custom')
}

export function getCodexCompatibleChannels(channels: Channel[]): Channel[] {
  return channels.filter(isCodexCompatibleChannel)
}

export function cleanupAgentCodexChannelId(
  channelId: string | null | undefined,
  channels: Channel[],
): string | null | undefined {
  if (channelId == null) return channelId
  return channels.some((channel) => channel.id === channelId && isCodexCompatibleChannel(channel))
    ? channelId
    : undefined
}

export function resolveAgentSessionRuntimeKind(
  session: AgentSessionMeta | null | undefined,
  defaultRuntimeKind: CodingAgentRuntimeKind,
): CodingAgentRuntimeKind {
  if (session?.runtimeSession?.kind) return session.runtimeSession.kind
  if (session?.runtimeKind === 'codex' || session?.runtimeKind === 'opencode') return session.runtimeKind
  if (session?.sdkSessionId) return 'claude-code'
  return defaultRuntimeKind
}

export function shouldUseRuntimeTranscript(
  session: AgentSessionMeta | null | undefined,
  defaultRuntimeKind: CodingAgentRuntimeKind,
): boolean {
  return resolveAgentSessionRuntimeKind(session, defaultRuntimeKind) !== 'claude-code'
}
