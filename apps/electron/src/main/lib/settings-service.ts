/**
 * 应用设置服务
 *
 * 管理应用设置（主题模式等）的读写。
 * 存储在 ~/.codeinsights/settings.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { getSettingsPath } from './config-paths'
import { DEFAULT_AGENT_RUNTIME_KIND, DEFAULT_THEME_MODE } from '../../types'
import type { AppSettings } from '../../types'

const AGENT_RUNTIME_KINDS = ['claude-code', 'codex', 'opencode'] as const
const AGENT_CODEX_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const
const AGENT_CODEX_WEB_SEARCH_MODES = ['disabled', 'cached', 'live'] as const

function normalizeSettings(data: Partial<AppSettings>): AppSettings {
  return {
    ...data,
    themeMode: data.themeMode || DEFAULT_THEME_MODE,
    onboardingCompleted: data.onboardingCompleted ?? false,
    environmentCheckSkipped: data.environmentCheckSkipped ?? false,
    notificationsEnabled: data.notificationsEnabled ?? true,
    agentRuntimeKind: normalizeEnum(data.agentRuntimeKind, AGENT_RUNTIME_KINDS, DEFAULT_AGENT_RUNTIME_KIND),
    agentCodexReasoningEffort: normalizeOptionalEnum(data.agentCodexReasoningEffort, AGENT_CODEX_REASONING_EFFORTS),
    agentCodexWebSearchMode: normalizeOptionalEnum(data.agentCodexWebSearchMode, AGENT_CODEX_WEB_SEARCH_MODES),
    agentOpencodeChannelId: normalizeOptionalNullableString(data.agentOpencodeChannelId),
    agentOpencodeModelId: normalizeOptionalString(data.agentOpencodeModelId),
    agentOpencodeAgentName: normalizeOptionalString(data.agentOpencodeAgentName),
    agentOpencodeUseNativeAuth: normalizeOptionalBoolean(data.agentOpencodeUseNativeAuth),
    agentOpencodeAutoupdate: normalizeOptionalBoolean(data.agentOpencodeAutoupdate),
    agentOpencodeSnapshotEnabled: normalizeOptionalBoolean(data.agentOpencodeSnapshotEnabled),
  }
}

function normalizeEnum<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fallback: T[number],
): T[number] {
  return isAllowedValue(value, allowedValues) ? value : fallback
}

function normalizeOptionalEnum<const T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
): T[number] | undefined {
  return isAllowedValue(value, allowedValues) ? value : undefined
}

function isAllowedValue<const T extends readonly string[]>(value: unknown, allowedValues: T): value is T[number] {
  return typeof value === 'string' && (allowedValues as readonly string[]).includes(value)
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeOptionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return normalizeOptionalString(value)
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * 获取应用设置
 *
 * 如果文件不存在，返回默认设置。
 */
export function getSettings(): AppSettings {
  const filePath = getSettingsPath()

  if (!existsSync(filePath)) {
    return normalizeSettings({})
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw) as Partial<AppSettings>
    return normalizeSettings(data)
  } catch (error) {
    console.error('[设置] 读取失败:', error)
    return normalizeSettings({})
  }
}

/**
 * 更新应用设置
 *
 * 合并更新字段并写入文件。
 */
export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = normalizeSettings({
    ...current,
    ...updates,
  })

  const filePath = getSettingsPath()

  try {
    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
    console.log('[设置] 已更新 keys:', Object.keys(updates).join(', '))
  } catch (error) {
    console.error('[设置] 写入失败:', error)
    throw new Error('写入应用设置失败')
  }

  return updated
}
