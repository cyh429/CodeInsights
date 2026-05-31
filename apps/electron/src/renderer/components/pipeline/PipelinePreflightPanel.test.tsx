import { describe, expect, test } from 'bun:test'
import type {
  PipelinePreflightAcknowledgement,
  PipelinePreflightResult,
} from '@codeinsights/shared'
import { buildPipelinePreflightPanelViewModel } from './PipelinePreflightPanel'

function makeResult(overrides: Partial<PipelinePreflightResult> = {}): PipelinePreflightResult {
  return {
    ok: true,
    repository: {
      root: '/repo',
      currentBranch: 'main',
      baseBranch: 'origin/main',
      remoteUrl: 'https://github.com/example/repo.git',
      hasUncommittedChanges: false,
      hasConflicts: false,
    },
    runtimes: [
      { kind: 'git', available: true, version: 'git version 2.0.0' },
      { kind: 'claude-cli', available: true, version: '1.0.0', path: '/mock/bin/claude' },
      { kind: 'codex-cli', available: true, version: '1.0.0', path: '/mock/bin/codex' },
    ],
    packageManager: 'bun',
    warnings: [],
    blockers: [],
    checkedAt: 1,
    fingerprint: 'fingerprint-ok',
    ...overrides,
  }
}

describe('PipelinePreflightPanel', () => {
  test('blocker 状态阻止启动并展示阻断项', () => {
    const viewModel = buildPipelinePreflightPanelViewModel({
      result: makeResult({
        ok: false,
        blockers: [{ code: 'git_conflicts', message: '工作区存在 Git 冲突' }],
        fingerprint: 'fingerprint-blocked',
      }),
      acknowledgement: null,
      loading: false,
      error: null,
    })

    expect(viewModel.title).toBe('启动前检查未通过')
    expect(viewModel.tone).toBe('danger')
    expect(viewModel.startBlocked).toBe(true)
    expect(viewModel.blockers).toEqual(['工作区存在 Git 冲突'])
    expect(viewModel.showAcknowledgeButton).toBe(false)
    expect(viewModel.showRefreshButton).toBe(true)
  })

  test('warning 未确认时要求用户记录风险继续', () => {
    const result = makeResult({
      warnings: [{ code: 'git_uncommitted_changes', message: '工作区存在未提交变更' }],
      fingerprint: 'fingerprint-warning',
    })
    const viewModel = buildPipelinePreflightPanelViewModel({
      result,
      acknowledgement: null,
      loading: false,
      error: null,
    })

    expect(viewModel.title).toBe('启动前检查存在风险')
    expect(viewModel.tone).toBe('warning')
    expect(viewModel.startBlocked).toBe(true)
    expect(viewModel.warnings).toEqual(['工作区存在未提交变更'])
    expect(viewModel.showAcknowledgeButton).toBe(true)
    expect(viewModel.showRefreshButton).toBe(true)
  })

  test('warning 已按 fingerprint 确认后允许启动', () => {
    const result = makeResult({
      warnings: [{ code: 'git_uncommitted_changes', message: '工作区存在未提交变更' }],
      fingerprint: 'fingerprint-warning',
    })
    const acknowledgement: PipelinePreflightAcknowledgement = {
      fingerprint: 'fingerprint-warning',
      acceptedWarningCodes: ['git_uncommitted_changes'],
      acknowledgedAt: 2,
    }

    const viewModel = buildPipelinePreflightPanelViewModel({
      result,
      acknowledgement,
      loading: false,
      error: null,
    })

    expect(viewModel.title).toBe('启动前检查风险已记录')
    expect(viewModel.tone).toBe('success')
    expect(viewModel.startBlocked).toBe(false)
    expect(viewModel.showAcknowledgeButton).toBe(false)
    expect(viewModel.repositorySummary).toContain('main')
    expect(viewModel.runtimeItems.map((item) => item.label)).toEqual([
      'Git',
      'Claude CLI',
      'Codex CLI',
    ])
    expect(viewModel.showRefreshButton).toBe(true)
  })

  test('需要刷新时阻止启动并隐藏风险确认入口', () => {
    const viewModel = buildPipelinePreflightPanelViewModel({
      result: makeResult(),
      acknowledgement: null,
      loading: false,
      error: null,
      refreshState: {
        refreshRequired: true,
        reason: 'stale',
        acknowledgement: null,
        message: '启动前检查已超过 60 秒，请重新检查。',
      },
    })

    expect(viewModel.title).toBe('启动前检查需要刷新')
    expect(viewModel.subtitle).toBe('启动前检查已超过 60 秒，请重新检查。')
    expect(viewModel.tone).toBe('warning')
    expect(viewModel.startBlocked).toBe(true)
    expect(viewModel.warnings).toEqual(['启动前检查已超过 60 秒，请重新检查。'])
    expect(viewModel.showAcknowledgeButton).toBe(false)
    expect(viewModel.showRefreshButton).toBe(true)
  })
})
