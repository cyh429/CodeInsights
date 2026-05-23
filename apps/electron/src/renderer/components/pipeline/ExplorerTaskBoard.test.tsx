import { describe, expect, test } from 'bun:test'
import type { PipelineExplorerReportRef } from '@codeinsights/shared'
import {
  buildExplorerTaskBoardViewModel,
  resolveExplorerTaskSelection,
} from './ExplorerTaskBoard'

function makeReport(patch: Partial<PipelineExplorerReportRef> & { reportId: string; title: string }): PipelineExplorerReportRef {
  return {
    reportId: patch.reportId,
    title: patch.title,
    summary: patch.summary,
    displayName: patch.displayName ?? `${patch.title}.md`,
    relativePath: patch.relativePath ?? `explorer/${patch.reportId}.md`,
    checksum: patch.checksum ?? 'a'.repeat(64),
    revision: patch.revision ?? 1,
  }
}

describe('ExplorerTaskBoard', () => {
  test('构建报告选择看板模型并保留当前选择', () => {
    const reports = [
      makeReport({
        reportId: 'report-001',
        title: '任务选择闭环',
        summary: '用户必须选择报告后进入 planner。',
        revision: 2,
      }),
      makeReport({
        reportId: 'report-002',
        title: '方案文档审核',
        summary: '展示 plan.md 和 test-plan.md。',
      }),
    ]

    const viewModel = buildExplorerTaskBoardViewModel({
      reports,
      selectedReportId: 'report-002',
      submitting: false,
    })

    expect(viewModel.empty).toBe(false)
    expect(viewModel.confirmDisabled).toBe(false)
    expect(viewModel.confirmLabel).toBe('选择此任务并进入规划')
    expect(viewModel.items).toMatchObject([
      {
        reportId: 'report-001',
        selected: false,
        title: '任务选择闭环',
        revisionLabel: '第 2 版',
      },
      {
        reportId: 'report-002',
        selected: true,
        title: '方案文档审核',
        checksumLabel: 'sha256:aaaaaaaa',
      },
    ])
  })

  test('没有选择 report 时禁止确认', () => {
    const reports = [
      makeReport({ reportId: 'report-001', title: '任务选择闭环' }),
    ]

    const viewModel = buildExplorerTaskBoardViewModel({
      reports,
      selectedReportId: null,
      submitting: false,
    })

    expect(viewModel.confirmDisabled).toBe(true)
    expect(resolveExplorerTaskSelection(reports, null)).toBeNull()
    expect(resolveExplorerTaskSelection(reports, 'report-001')?.title).toBe('任务选择闭环')
  })
})
