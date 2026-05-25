import type { AgentSessionMeta, Channel, CodingAgentRuntimeKind } from '@codeinsights/shared'

export const CODEX_NATIVE_AUTH_SELECT_VALUE = '__codex_native_auth__'

export function isAgentCodexRuntimeFeatureEnabled(
  enabled: boolean = typeof __CODEINSIGHTS_AGENT_CODEX_RUNTIME_ENABLED__ !== 'undefined'
    ? __CODEINSIGHTS_AGENT_CODEX_RUNTIME_ENABLED__
    : false,
): boolean {
  return enabled === true
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
  if (session?.runtimeKind === 'codex') return 'codex'
  if (session?.sdkSessionId) return 'claude-code'
  return defaultRuntimeKind
}

export function shouldUseRuntimeTranscript(
  session: AgentSessionMeta | null | undefined,
  defaultRuntimeKind: CodingAgentRuntimeKind,
): boolean {
  return resolveAgentSessionRuntimeKind(session, defaultRuntimeKind) === 'codex'
}
