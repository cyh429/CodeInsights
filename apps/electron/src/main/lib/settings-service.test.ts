import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
})
