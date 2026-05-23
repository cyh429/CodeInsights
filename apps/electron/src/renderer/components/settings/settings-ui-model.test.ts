import { describe, expect, test } from 'bun:test'
import {
  getSettingsDeleteDialogCopy,
  resolveSettingsNavStatus,
} from './settings-ui-model'

describe('settings-ui-model', () => {
  test('about tab prefers environment issue over update status', () => {
    expect(resolveSettingsNavStatus({
      tabId: 'about',
      hasUpdate: true,
      hasEnvironmentIssues: true,
    })).toEqual({ kind: 'issue', label: '环境存在问题' })
  })

  test('non-about tabs do not show nav status badges', () => {
    expect(resolveSettingsNavStatus({
      tabId: 'channels',
      hasUpdate: true,
      hasEnvironmentIssues: true,
    })).toEqual({ kind: 'none' })
  })

  test('danger copy states MCP delete scope', () => {
    const copy = getSettingsDeleteDialogCopy({ kind: 'mcp', name: 'github' })
    expect(copy.title).toBe('删除 MCP 服务器？')
    expect(copy.description).toContain('当前工作区')
    expect(copy.description).toContain('新的 Agent 会话')
  })

  test('danger copy states Skill delete scope', () => {
    const copy = getSettingsDeleteDialogCopy({ kind: 'skill', name: 'source-command-tdd' })
    expect(copy.title).toBe('删除 Skill？')
    expect(copy.description).toContain('源工作区不受影响')
  })
})
