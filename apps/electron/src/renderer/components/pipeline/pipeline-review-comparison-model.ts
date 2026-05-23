import type {
  PipelineGateAction,
  PipelineRecord,
} from '@codeinsights/shared'

export type PipelineReviewTone = 'success' | 'warning'

export interface PipelineReviewRoundViewModel {
  roundNumber: number
  roundLabel: string
  sourceRecordId: string
  modelApproved: boolean
  modelStatusLabel: string
  approved: boolean
  statusLabel: string
  tone: PipelineReviewTone
  summary: string
  issues: string[]
  issueCountLabel: string
  decisionLabel?: string
  feedback?: string
  createdAt: number
}

export interface PipelineReviewComparisonSummary {
  totalRounds: number
  approvedRounds: number
  rejectedRounds: number
  latestStatusLabel: string
  latestTone: PipelineReviewTone
}

export interface PipelineReviewComparisonViewModel {
  shouldShowPanel: boolean
  summary: PipelineReviewComparisonSummary
  rounds: PipelineReviewRoundViewModel[]
}

interface ReviewCandidate {
  id: string
  dedupeKey: string
  approved: boolean
  summary: string
  issues: string[]
  createdAt: number
  priority: number
}

interface ReviewDecision {
  action: PipelineGateAction
  feedback?: string
  createdAt: number
}

function buildDecisionLabel(action: PipelineGateAction): string {
  switch (action) {
    case 'approve':
      return '进入测试'
    case 'reject_with_feedback':
      return '要求修改'
    case 'rerun_node':
      return '重跑审查'
  }
}

function buildIssueCountLabel(count: number): string {
  return count === 0 ? '无问题' : `${count} 个问题`
}

function buildCandidateDedupeKey(record: PipelineRecord): string {
  return record.id.replace(/-(artifact|review)$/, '')
}

function buildReviewCandidate(record: PipelineRecord): ReviewCandidate | null {
  if (record.type === 'stage_artifact' && record.node === 'reviewer' && record.artifact.node === 'reviewer') {
    return {
      id: record.id,
      dedupeKey: buildCandidateDedupeKey(record),
      approved: record.artifact.approved,
      summary: record.artifact.summary,
      issues: record.artifact.issues,
      createdAt: record.createdAt,
      priority: 0,
    }
  }

  if (record.type === 'review_result') {
    return {
      id: record.id,
      dedupeKey: buildCandidateDedupeKey(record),
      approved: record.approved,
      summary: record.summary,
      issues: record.issues ?? [],
      createdAt: record.createdAt,
      priority: 1,
    }
  }

  return null
}

function collectReviewCandidates(records: PipelineRecord[]): ReviewCandidate[] {
  const byKey = new Map<string, ReviewCandidate>()

  for (const record of records) {
    const candidate = buildReviewCandidate(record)
    if (!candidate) continue

    const existing = byKey.get(candidate.dedupeKey)
    if (!existing || candidate.priority < existing.priority) {
      byKey.set(candidate.dedupeKey, candidate)
    }
  }

  return [...byKey.values()].sort((a, b) => a.createdAt - b.createdAt)
}

function collectReviewDecisions(records: PipelineRecord[]): ReviewDecision[] {
  return records
    .filter((record): record is Extract<PipelineRecord, { type: 'gate_decision' }> =>
      record.type === 'gate_decision' && record.node === 'reviewer')
    .map((record) => ({
      action: record.action,
      feedback: record.feedback,
      createdAt: record.createdAt,
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

function findDecisionForCandidate(
  candidate: ReviewCandidate,
  nextCandidate: ReviewCandidate | undefined,
  decisions: ReviewDecision[],
): ReviewDecision | undefined {
  return decisions.find((decision) =>
    decision.createdAt >= candidate.createdAt
      && (!nextCandidate || decision.createdAt < nextCandidate.createdAt),
  )
}

function buildEffectiveOutcome(
  candidate: ReviewCandidate,
  decision: ReviewDecision | undefined,
): {
  approved: boolean
  statusLabel: string
  tone: PipelineReviewTone
} {
  if (decision?.action === 'approve') {
    return {
      approved: true,
      statusLabel: '已进入下一阶段',
      tone: 'success',
    }
  }

  if (decision?.action === 'reject_with_feedback' || decision?.action === 'rerun_node') {
    return {
      approved: false,
      statusLabel: '需要继续修改',
      tone: 'warning',
    }
  }

  return {
    approved: candidate.approved,
    statusLabel: candidate.approved ? '审查通过' : '审查驳回',
    tone: candidate.approved ? 'success' : 'warning',
  }
}

export function buildPipelineReviewComparison(records: PipelineRecord[]): PipelineReviewComparisonViewModel | null {
  const candidates = collectReviewCandidates(records)
  if (candidates.length === 0) return null

  const decisions = collectReviewDecisions(records)
  const rounds = candidates.map((candidate, index): PipelineReviewRoundViewModel => {
    const decision = findDecisionForCandidate(candidate, candidates[index + 1], decisions)
    const outcome = buildEffectiveOutcome(candidate, decision)

    return {
      roundNumber: index + 1,
      roundLabel: `第 ${index + 1} 轮`,
      sourceRecordId: candidate.id,
      modelApproved: candidate.approved,
      modelStatusLabel: candidate.approved ? '模型通过' : '模型驳回',
      approved: outcome.approved,
      statusLabel: outcome.statusLabel,
      tone: outcome.tone,
      summary: candidate.summary,
      issues: candidate.issues,
      issueCountLabel: buildIssueCountLabel(candidate.issues.length),
      decisionLabel: decision ? buildDecisionLabel(decision.action) : undefined,
      feedback: decision?.feedback,
      createdAt: candidate.createdAt,
    }
  })
  const latest = rounds[rounds.length - 1]!
  const approvedRounds = rounds.filter((round) => round.approved).length
  const rejectedRounds = rounds.length - approvedRounds

  return {
    shouldShowPanel: rounds.length >= 2,
    summary: {
      totalRounds: rounds.length,
      approvedRounds,
      rejectedRounds,
      latestStatusLabel: latest.approved ? '最新通过' : '最新驳回',
      latestTone: latest.tone,
    },
    rounds,
  }
}
