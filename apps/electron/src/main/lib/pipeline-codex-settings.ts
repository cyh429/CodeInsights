import type { AppSettings } from '../../types'

interface PipelineCodexChannelSource {
  pipelineCodexChannelId?: string | null
}

export function normalizePipelineCodexChannelId(channelId?: string | null): string | undefined {
  const trimmed = channelId?.trim()
  return trimmed ? trimmed : undefined
}

export function resolvePipelineCodexChannelId(
  settings: Pick<AppSettings, 'pipelineCodexChannelId'> | PipelineCodexChannelSource,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(settings, 'pipelineCodexChannelId')) {
    return normalizePipelineCodexChannelId(settings.pipelineCodexChannelId)
  }

  return normalizePipelineCodexChannelId(settings.pipelineCodexChannelId)
    ?? normalizePipelineCodexChannelId(env.CODEINSIGHTS_PIPELINE_CODEX_CHANNEL_ID)
}
