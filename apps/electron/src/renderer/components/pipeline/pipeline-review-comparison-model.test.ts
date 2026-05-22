import { describe, expect, test } from 'bun:test'
import type { PipelineRecord } from '@codeinsights/shared'
import {
  buildPipelineReviewComparison,
} from './pipeline-review-comparison-model'

function reviewerArtifactRecord({
  approved,
  createdAt,
  id,
  issues,
  summary,
}: {
  approved: boolean
  createdAt: number
  id: string
  issues: string[]
  summary: string
}): PipelineRecord {
  return {
    id,
    sessionId: 'session-1',
    type: 'stage_artifact',
    node: 'reviewer',
    artifact: {
      node: 'reviewer',
      approved,
      summary,
      issues,
      content: `${summary}\n${issues.join('\n')}`,
    },
    createdAt,
  }
}

describe('buildPipelineReviewComparison', () => {
  test('会按 reviewer 产物顺序生成多轮对比并归属人工决策', () => {
    const comparison = buildPipelineReviewComparison([
      reviewerArtifactRecord({
        id: 'session-1-reviewer-10-artifact',
        createdAt: 10,
        approved: false,
        summary: '缺少测试',
        issues: ['没有测试', '没有说明风险'],
      }),
      {
        id: 'session-1-reviewer-10-review',
        sessionId: 'session-1',
        type: 'review_result',
        node: 'reviewer',
        approved: false,
        summary: '缺少测试',
        issues: ['没有测试', '没有说明风险'],
        createdAt: 10,
      },
      {
        id: 'decision-1',
        sessionId: 'session-1',
        type: 'gate_decision',
        node: 'reviewer',
        action: 'reject_with_feedback',
        feedback: '请补测试',
        createdAt: 12,
      },
      reviewerArtifactRecord({
        id: 'session-1-reviewer-20-artifact',
        createdAt: 20,
        approved: true,
        summary: '已通过',
        issues: [],
      }),
      {
        id: 'decision-2',
        sessionId: 'session-1',
        type: 'gate_decision',
        node: 'reviewer',
        action: 'approve',
        createdAt: 22,
      },
    ])

    expect(comparison).not.toBeNull()
    expect(comparison?.summary).toEqual({
      totalRounds: 2,
      approvedRounds: 1,
      rejectedRounds: 1,
      latestStatusLabel: '最新通过',
      latestTone: 'success',
    })
    expect(comparison?.rounds.map((round) => ({
      roundLabel: round.roundLabel,
      sourceRecordId: round.sourceRecordId,
      statusLabel: round.statusLabel,
      modelStatusLabel: round.modelStatusLabel,
      decisionLabel: round.decisionLabel,
      feedback: round.feedback,
      issueCountLabel: round.issueCountLabel,
    }))).toEqual([
      {
        roundLabel: '第 1 轮',
        sourceRecordId: 'session-1-reviewer-10-artifact',
        statusLabel: '需要继续修改',
        modelStatusLabel: '模型驳回',
        decisionLabel: '要求修改',
        feedback: '请补测试',
        issueCountLabel: '2 个问题',
      },
      {
        roundLabel: '第 2 轮',
        sourceRecordId: 'session-1-reviewer-20-artifact',
        statusLabel: '已进入下一阶段',
        modelStatusLabel: '模型通过',
        decisionLabel: '进入测试',
        feedback: undefined,
        issueCountLabel: '无问题',
      },
    ])
  })

  test('没有 stage artifact 时回退到 review_result', () => {
    const comparison = buildPipelineReviewComparison([
      {
        id: 'review-result-1',
        sessionId: 'session-1',
        type: 'review_result',
        node: 'reviewer',
        approved: false,
        summary: '仍有问题',
        issues: ['缺少边界测试'],
        createdAt: 10,
      },
    ])

    expect(comparison?.summary.totalRounds).toBe(1)
    expect(comparison?.rounds[0]?.sourceRecordId).toBe('review-result-1')
    expect(comparison?.rounds[0]?.issues).toEqual(['缺少边界测试'])
  })

  test('少于两轮审查时默认不需要显示对比面板', () => {
    const comparison = buildPipelineReviewComparison([
      reviewerArtifactRecord({
        id: 'review-artifact-1',
        createdAt: 10,
        approved: true,
        summary: '已通过',
        issues: [],
      }),
    ])

    expect(comparison?.shouldShowPanel).toBe(false)
  })

  test('人工决策会优先决定轮次最终状态', () => {
    const comparison = buildPipelineReviewComparison([
      reviewerArtifactRecord({
        id: 'review-artifact-1',
        createdAt: 10,
        approved: true,
        summary: '模型认为可通过',
        issues: [],
      }),
      {
        id: 'decision-1',
        sessionId: 'session-1',
        type: 'gate_decision',
        node: 'reviewer',
        action: 'reject_with_feedback',
        feedback: '仍需调整交互',
        createdAt: 12,
      },
      reviewerArtifactRecord({
        id: 'review-artifact-2',
        createdAt: 20,
        approved: false,
        summary: '模型仍提示问题',
        issues: ['存在风险'],
      }),
      {
        id: 'decision-2',
        sessionId: 'session-1',
        type: 'gate_decision',
        node: 'reviewer',
        action: 'approve',
        createdAt: 22,
      },
    ])

    expect(comparison?.summary).toEqual({
      totalRounds: 2,
      approvedRounds: 1,
      rejectedRounds: 1,
      latestStatusLabel: '最新通过',
      latestTone: 'success',
    })
    expect(comparison?.rounds.map((round) => ({
      modelStatusLabel: round.modelStatusLabel,
      statusLabel: round.statusLabel,
      approved: round.approved,
    }))).toEqual([
      {
        modelStatusLabel: '模型通过',
        statusLabel: '需要继续修改',
        approved: false,
      },
      {
        modelStatusLabel: '模型驳回',
        statusLabel: '已进入下一阶段',
        approved: true,
      },
    ])
  })

  test('同毫秒但不同记录身份的 reviewer 产物不会被误合并', () => {
    const comparison = buildPipelineReviewComparison([
      reviewerArtifactRecord({
        id: 'session-1-reviewer-a-artifact',
        createdAt: 10,
        approved: false,
        summary: '第一条同毫秒记录',
        issues: ['问题 A'],
      }),
      reviewerArtifactRecord({
        id: 'session-1-reviewer-b-artifact',
        createdAt: 10,
        approved: true,
        summary: '第二条同毫秒记录',
        issues: [],
      }),
    ])

    expect(comparison?.rounds.map((round) => round.sourceRecordId)).toEqual([
      'session-1-reviewer-a-artifact',
      'session-1-reviewer-b-artifact',
    ])
  })
})
