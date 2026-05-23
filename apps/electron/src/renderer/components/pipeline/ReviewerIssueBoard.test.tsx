import { describe, expect, test } from 'bun:test'
import type { PipelineReviewerStageOutput } from '@codeinsights/shared'
import { buildReviewerIssueBoardViewModel } from './ReviewerIssueBoard'

describe('ReviewerIssueBoard', () => {
  test('按 severity 和 status 构建 reviewer issue 展示模型', () => {
    const output: PipelineReviewerStageOutput = {
      node: 'reviewer',
      summary: '仍需返工',
      approved: false,
      issues: ['缺少 UI 状态测试', '风险说明不完整'],
      structuredIssues: [
        {
          id: 'CI-REV-001',
          severity: 'major',
          category: 'test_gap',
          title: '缺少 UI 状态测试',
          detail: '需要覆盖 Developer 文档审核状态。',
          status: 'open',
        },
        {
          id: 'CI-REV-002',
          severity: 'minor',
          category: 'maintainability',
          title: '风险说明不完整',
          detail: 'dev.md 需要补充风险。',
          status: 'fixed',
        },
      ],
      reviewDoc: {
        displayName: '审查报告.md',
        relativePath: 'review.md',
        checksum: 'a'.repeat(64),
        revision: 2,
      },
      content: '{}',
    }

    const viewModel = buildReviewerIssueBoardViewModel(output, {
      iteration: 2,
      maxIterations: 3,
      reviewContent: '# 审查报告\n\n不通过。',
    })

    expect(viewModel.approved).toBe(false)
    expect(viewModel.summary).toBe('仍需返工')
    expect(viewModel.iterationLabel).toBe('第 2 / 3 轮审查')
    expect(viewModel.openIssueCount).toBe(1)
    expect(viewModel.reviewDocument).toMatchObject({
      relativePath: 'review.md',
      checksumLabel: 'sha256:aaaaaaaa',
      revisionLabel: '第 2 版',
    })
    expect(viewModel.groups.map((group) => group.severity)).toEqual(['major', 'minor'])
    expect(viewModel.groups[0]?.issues[0]).toMatchObject({
      id: 'CI-REV-001',
      statusLabel: '待修复',
    })
    expect(viewModel.reviewContent).toContain('不通过')
  })

  test('只有旧 issues 字符串时生成兼容展示项', () => {
    const output: PipelineReviewerStageOutput = {
      node: 'reviewer',
      summary: '缺少验证',
      approved: false,
      issues: ['缺少验证命令'],
      content: '{}',
    }

    const viewModel = buildReviewerIssueBoardViewModel(output, {
      iteration: 1,
      maxIterations: 3,
    })

    expect(viewModel.groups).toHaveLength(1)
    expect(viewModel.groups[0]?.severity).toBe('major')
    expect(viewModel.groups[0]?.issues[0]).toMatchObject({
      id: 'CI-REV-001',
      title: '缺少验证命令',
      statusLabel: '待修复',
    })
  })
})
