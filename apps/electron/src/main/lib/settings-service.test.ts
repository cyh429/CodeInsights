import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppSettings } from '../../types'
import { getSettings, updateSettings } from './settings-service'

describe('settings-service', () => {
  const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
  let tempConfigDir = ''

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.CODEINSIGHTS_CONFIG_DIR
    } else {
      process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
    }
    if (tempConfigDir) {
      rmSync(tempConfigDir, { recursive: true, force: true })
      tempConfigDir = ''
    }
  })

  function useTempConfig(): void {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-settings-'))
    process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
  }

  test('会持久化 Pipeline Codex 渠道选择', () => {
    useTempConfig()

    updateSettings({
      themeMode: 'dark',
      pipelineCodexChannelId: 'codex-channel-1',
    })

    expect(getSettings().pipelineCodexChannelId).toBe('codex-channel-1')
  })

  test('默认使用 Claude Code runtime 且不继承 Pipeline Codex 渠道', () => {
    useTempConfig()

    const settings = getSettings()

    expect(settings.agentRuntimeKind).toBe('claude-code')
    expect(settings.agentCodexChannelId).toBeUndefined()
    expect(settings.pipelineCodexChannelId).toBeUndefined()
  })

  test('读取旧 settings 文件时不会把 Pipeline Codex 渠道迁移给 Agent Codex', () => {
    useTempConfig()
    writeFileSync(
      join(tempConfigDir, 'settings.json'),
      JSON.stringify({
        themeMode: 'light',
        pipelineCodexChannelId: 'pipeline-channel-1',
      }),
      'utf-8',
    )

    const settings = getSettings()

    expect(settings.agentRuntimeKind).toBe('claude-code')
    expect(settings.pipelineCodexChannelId).toBe('pipeline-channel-1')
    expect(settings.agentCodexChannelId).toBeUndefined()
  })

  test('会持久化显式本机 Codex auth 选择', () => {
    useTempConfig()

    updateSettings({
      themeMode: 'dark',
      pipelineCodexChannelId: 'codex-channel-1',
    })
    updateSettings({
      pipelineCodexChannelId: null,
    })

    expect(getSettings().pipelineCodexChannelId).toBeNull()
  })

  test('会持久化 Agent Codex 独立设置', () => {
    useTempConfig()

    updateSettings({
      agentRuntimeKind: 'codex',
      agentCodexChannelId: null,
      agentCodexModelId: 'gpt-5.1-codex',
      agentCodexReasoningEffort: 'high',
      agentCodexNetworkAccessEnabled: true,
      agentCodexWebSearchMode: 'live',
      pipelineCodexChannelId: 'pipeline-channel-1',
    })

    const settings = getSettings()
    expect(settings.agentRuntimeKind).toBe('codex')
    expect(settings.agentCodexChannelId).toBeNull()
    expect(settings.agentCodexModelId).toBe('gpt-5.1-codex')
    expect(settings.agentCodexReasoningEffort).toBe('high')
    expect(settings.agentCodexNetworkAccessEnabled).toBe(true)
    expect(settings.agentCodexWebSearchMode).toBe('live')
    expect(settings.pipelineCodexChannelId).toBe('pipeline-channel-1')
  })

  test('会将损坏的 Agent Codex 枚举回退到安全默认值', () => {
    useTempConfig()
    writeFileSync(
      join(tempConfigDir, 'settings.json'),
      JSON.stringify({
        themeMode: 'light',
        agentRuntimeKind: 'invalid-runtime',
        agentCodexReasoningEffort: 'invalid-effort',
        agentCodexWebSearchMode: 'invalid-mode',
      }),
      'utf-8',
    )

    const settings = getSettings()

    expect(settings.agentRuntimeKind).toBe('claude-code')
    expect(settings.agentCodexReasoningEffort).toBeUndefined()
    expect(settings.agentCodexWebSearchMode).toBeUndefined()
  })

  test('更新设置时也会归一化损坏的 Agent Codex 枚举', () => {
    useTempConfig()

    const settings = updateSettings({
      agentRuntimeKind: 'invalid-runtime',
      agentCodexReasoningEffort: 'invalid-effort',
      agentCodexWebSearchMode: 'invalid-mode',
    } as unknown as Partial<AppSettings>)

    expect(settings.agentRuntimeKind).toBe('claude-code')
    expect(settings.agentCodexReasoningEffort).toBeUndefined()
    expect(settings.agentCodexWebSearchMode).toBeUndefined()
    expect(getSettings().agentRuntimeKind).toBe('claude-code')
  })
})
