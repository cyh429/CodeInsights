import type { ProviderType } from '@codeinsights/shared'
import { decryptApiKey, getChannelById } from '../channel-manager'

export interface CodexRuntimeOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
}

export function providerSupportsCodexChannel(provider: ProviderType): boolean {
  return provider === 'openai' || provider === 'custom'
}

export function resolveCodexRuntime(channelId?: string): CodexRuntimeOptions {
  if (!channelId) return {}

  const channel = getChannelById(channelId)
  if (!channel) {
    throw new Error(`未找到 Codex 渠道: ${channelId}`)
  }

  if (!providerSupportsCodexChannel(channel.provider)) {
    throw new Error(`Codex 节点需要 OpenAI 或 Custom 渠道，当前为 ${channel.provider}`)
  }

  if (!channel.enabled) {
    throw new Error(`Codex 渠道已禁用: ${channel.name}`)
  }

  const enabledModel = channel.models.find((model) => model.enabled)
  return {
    apiKey: decryptApiKey(channelId),
    baseUrl: channel.baseUrl || undefined,
    model: enabledModel?.id ?? channel.models[0]?.id,
  }
}
