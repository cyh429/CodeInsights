import type { Channel } from '@codeinsights/shared'

export const CODEX_LOCAL_AUTH_VALUE = '__local_codex_auth__'

export function isPipelineCodexCompatibleChannel(channel: Channel): boolean {
  return channel.enabled && (channel.provider === 'openai' || channel.provider === 'custom')
}

export function resolvePipelineCodexSelection(
  channelId: string | null | undefined,
  channels: Channel[],
): string {
  return channelId && channels.some((channel) => channel.id === channelId)
    ? channelId
    : CODEX_LOCAL_AUTH_VALUE
}

export function shouldClearPipelineCodexChannel(
  channelId: string | null | undefined,
  channels: Channel[],
): boolean {
  if (!channelId) return false
  return !channels.some((channel) => channel.id === channelId && isPipelineCodexCompatibleChannel(channel))
}
