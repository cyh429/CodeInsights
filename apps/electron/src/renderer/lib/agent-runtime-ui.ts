import type { AgentSessionMeta, Channel, CodingAgentRuntimeKind } from '@codeinsights/shared'

export const CODEX_NATIVE_AUTH_SELECT_VALUE = '__codex_native_auth__'
export const OPENCODE_NATIVE_AUTH_SELECT_VALUE = '__opencode_native_auth__'

export interface AgentRuntimeFeatureFlags {
  codex: boolean
  opencode: boolean
}

export function isAgentCodexRuntimeFeatureEnabled(
  _enabled?: boolean,
): boolean {
  // Codex Runtime 默认开放给用户在设置页自行切换。
  return true
}

export function isAgentOpencodeRuntimeFeatureEnabled(
  _enabled?: boolean,
): boolean {
  // opencode Runtime 已完成 Phase 8 基础验收，设置页默认开放给用户自行切换。
  return true
}

export function isAgentRuntimeKindEnabled(
  kind: CodingAgentRuntimeKind,
  flags: AgentRuntimeFeatureFlags = {
    codex: isAgentCodexRuntimeFeatureEnabled(),
    opencode: isAgentOpencodeRuntimeFeatureEnabled(),
  },
): boolean {
  if (kind === 'codex') return true
  if (kind === 'opencode') return true
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

export function isOpencodeCompatibleChannel(channel: Channel): boolean {
  return channel.enabled && (channel.provider === 'openai' || channel.provider === 'custom')
}

export function getOpencodeCompatibleChannels(channels: Channel[]): Channel[] {
  return channels.filter(isOpencodeCompatibleChannel)
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

export function cleanupAgentOpencodeChannelId(
  channelId: string | null | undefined,
  channels: Channel[],
): string | null | undefined {
  if (channelId == null) return channelId
  return channels.some((channel) => channel.id === channelId && isOpencodeCompatibleChannel(channel))
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

export function formatRuntimeHeaderLabel(kind: CodingAgentRuntimeKind): string {
  if (kind === 'codex') return 'Codex'
  if (kind === 'opencode') return 'opencode'
  return 'Claude Code'
}
