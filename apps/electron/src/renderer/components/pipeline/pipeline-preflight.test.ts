import { describe, expect, test } from 'bun:test'
import type { AgentWorkspace, Channel } from '@codeinsights/shared'
import { resolvePipelineRunConfig } from './pipeline-preflight'

const channel: Channel = {
  id: 'channel-1',
  name: 'Anthropic',
  provider: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'encrypted',
  models: [],
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
}

const workspace: AgentWorkspace = {
  id: 'workspace-1',
  name: '默认工作区',
  slug: 'default-workspace',
  createdAt: 1,
  updatedAt: 1,
}

describe('resolvePipelineRunConfig', () => {
  test('未配置 Codex 渠道时允许使用本机 Codex auth', () => {
    const result = resolvePipelineRunConfig({
      fallbackChannelId: 'channel-1',
      fallbackWorkspaceId: 'workspace-1',
      channels: [channel],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: true,
      config: {
        channelId: 'channel-1',
        workspaceId: 'workspace-1',
      },
    })
  })

  test('优先使用 session 自带配置，并返回可执行 config', () => {
    const result = resolvePipelineRunConfig({
      sessionChannelId: 'channel-1',
      sessionWorkspaceId: 'workspace-1',
      fallbackChannelId: 'channel-2',
      fallbackWorkspaceId: 'workspace-2',
      channels: [channel],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: true,
      config: {
        channelId: 'channel-1',
        workspaceId: 'workspace-1',
      },
    })
  })

  test('缺少渠道时返回 agent 配置引导', () => {
    const result = resolvePipelineRunConfig({
      channels: [channel],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message: '请先在 Agent 配置中选择默认渠道，再启动 Pipeline。',
        settingsTab: 'agent',
      },
    })
  })

  test('非 Agent 兼容渠道会被阻止启动', () => {
    const result = resolvePipelineRunConfig({
      fallbackChannelId: 'channel-2',
      fallbackWorkspaceId: 'workspace-1',
      channels: [{
        ...channel,
        id: 'channel-2',
        name: 'OpenAI',
        provider: 'openai',
      }],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message: '渠道 OpenAI 不是 Agent 兼容供应商，无法用于 Pipeline。',
        settingsTab: 'channels',
      },
    })
  })

  test('Pipeline Codex 可使用 OpenAI 或 Custom 渠道', () => {
    const openAiChannel: Channel = {
      ...channel,
      id: 'codex-openai',
      name: 'OpenAI Codex',
      provider: 'openai',
    }
    const customChannel: Channel = {
      ...channel,
      id: 'codex-custom',
      name: 'Custom Codex',
      provider: 'custom',
    }

    expect(resolvePipelineRunConfig({
      fallbackChannelId: 'channel-1',
      fallbackWorkspaceId: 'workspace-1',
      pipelineCodexChannelId: 'codex-openai',
      channels: [channel, openAiChannel],
      workspaces: [workspace],
    }).ok).toBe(true)
    expect(resolvePipelineRunConfig({
      fallbackChannelId: 'channel-1',
      fallbackWorkspaceId: 'workspace-1',
      pipelineCodexChannelId: 'codex-custom',
      channels: [channel, customChannel],
      workspaces: [workspace],
    }).ok).toBe(true)
  })

  test('Pipeline Codex 非 OpenAI 兼容渠道会被阻止启动', () => {
    const result = resolvePipelineRunConfig({
      fallbackChannelId: 'channel-1',
      fallbackWorkspaceId: 'workspace-1',
      pipelineCodexChannelId: 'channel-1',
      channels: [channel],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message: 'Pipeline Codex 渠道 Anthropic 不是 OpenAI 兼容供应商。',
        settingsTab: 'channels',
      },
    })
  })

  test('缺少工作区时返回 agent 配置引导', () => {
    const result = resolvePipelineRunConfig({
      fallbackChannelId: 'channel-1',
      channels: [channel],
      workspaces: [workspace],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        message: '请先在 Agent 配置中选择默认工作区，再启动 Pipeline。',
        settingsTab: 'agent',
      },
    })
  })
})
