import { describe, expect, test } from 'bun:test'
import type { AgentWorkspace, Channel } from '@codeinsights/shared'
import type { PipelinePreflightResult } from '@codeinsights/shared'
import {
  createPipelinePreflightAcknowledgement,
  isPipelinePreflightAcknowledged,
  resolvePipelineRunConfig,
  shouldBlockPipelineStartForPreflight,
} from './pipeline-preflight'

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

function makeRepositoryPreflightResult(
  overrides: Partial<PipelinePreflightResult> = {},
): PipelinePreflightResult {
  return {
    ok: true,
    repository: {
      root: '/repo',
      currentBranch: 'main',
      hasUncommittedChanges: false,
      hasConflicts: false,
    },
    runtimes: [{ kind: 'git', available: true, version: 'git version 2.0.0' }],
    packageManager: 'bun',
    warnings: [],
    blockers: [],
    checkedAt: 1,
    fingerprint: 'fingerprint-ok',
    ...overrides,
  }
}

describe('repository preflight acknowledgement', () => {
  test('blocker 会阻止启动且不能通过 warning acknowledgement 放行', () => {
    const result = makeRepositoryPreflightResult({
      ok: false,
      blockers: [{ code: 'git_conflicts', message: '工作区存在 Git 冲突' }],
      fingerprint: 'fingerprint-blocked',
    })
    const acknowledgement = createPipelinePreflightAcknowledgement(result, 10)

    expect(shouldBlockPipelineStartForPreflight(result, acknowledgement)).toBe(true)
    expect(isPipelinePreflightAcknowledged(result, acknowledgement)).toBe(true)
  })

  test('warning 未确认时阻止启动，确认后允许继续', () => {
    const result = makeRepositoryPreflightResult({
      warnings: [{ code: 'git_uncommitted_changes', message: '工作区存在未提交变更' }],
      fingerprint: 'fingerprint-warning',
    })
    const acknowledgement = createPipelinePreflightAcknowledgement(result, 10)

    expect(shouldBlockPipelineStartForPreflight(result, null)).toBe(true)
    expect(acknowledgement).toEqual({
      fingerprint: 'fingerprint-warning',
      acceptedWarningCodes: ['git_uncommitted_changes'],
      acknowledgedAt: 10,
    })
    expect(shouldBlockPipelineStartForPreflight(result, acknowledgement)).toBe(false)
  })

  test('过期 fingerprint 或缺少 warning code 时视为未确认', () => {
    const result = makeRepositoryPreflightResult({
      warnings: [
        { code: 'git_uncommitted_changes', message: '工作区存在未提交变更' },
        { code: 'git_remote_missing', message: '未配置 remote' },
      ],
      fingerprint: 'fingerprint-current',
    })

    expect(isPipelinePreflightAcknowledged(result, {
      fingerprint: 'fingerprint-old',
      acceptedWarningCodes: ['git_uncommitted_changes', 'git_remote_missing'],
      acknowledgedAt: 10,
    })).toBe(false)
    expect(isPipelinePreflightAcknowledged(result, {
      fingerprint: 'fingerprint-current',
      acceptedWarningCodes: ['git_uncommitted_changes'],
      acknowledgedAt: 10,
    })).toBe(false)
  })
})
