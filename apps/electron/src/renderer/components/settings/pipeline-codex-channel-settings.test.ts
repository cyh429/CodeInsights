import { describe, expect, test } from 'bun:test'
import type { Channel } from '@codeinsights/shared'
import {
  CODEX_LOCAL_AUTH_VALUE,
  isPipelineCodexCompatibleChannel,
  resolvePipelineCodexSelection,
  shouldClearPipelineCodexChannel,
} from './pipeline-codex-channel-settings'

function channel(overrides: Partial<Channel>): Channel {
  return {
    id: 'channel-1',
    name: '渠道',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'encrypted',
    models: [],
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('pipeline-codex-channel-settings', () => {
  test('只有启用的 OpenAI/custom 渠道可用于 Pipeline Codex', () => {
    expect(isPipelineCodexCompatibleChannel(channel({ provider: 'openai' }))).toBe(true)
    expect(isPipelineCodexCompatibleChannel(channel({ provider: 'custom' }))).toBe(true)
    expect(isPipelineCodexCompatibleChannel(channel({ provider: 'anthropic' }))).toBe(false)
    expect(isPipelineCodexCompatibleChannel(channel({ provider: 'openai', enabled: false }))).toBe(false)
  })

  test('已选渠道不在兼容列表中时 UI 回到本机 auth 选项', () => {
    expect(resolvePipelineCodexSelection('channel-1', [channel({})])).toBe('channel-1')
    expect(resolvePipelineCodexSelection('channel-1', [])).toBe(CODEX_LOCAL_AUTH_VALUE)
    expect(resolvePipelineCodexSelection(null, [channel({})])).toBe(CODEX_LOCAL_AUTH_VALUE)
  })

  test('编辑后不再兼容的已选渠道需要清理 settings', () => {
    expect(shouldClearPipelineCodexChannel('channel-1', [channel({})])).toBe(false)
    expect(shouldClearPipelineCodexChannel('channel-1', [channel({ provider: 'anthropic' })])).toBe(true)
    expect(shouldClearPipelineCodexChannel('channel-1', [channel({ enabled: false })])).toBe(true)
    expect(shouldClearPipelineCodexChannel(null, [channel({})])).toBe(false)
  })
})
