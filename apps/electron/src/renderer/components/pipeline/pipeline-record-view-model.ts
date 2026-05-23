import type {
  PipelineArtifactFileRef,
  PipelineNodeKind,
  PipelineRecord,
  PipelineStageOutput,
} from '@codeinsights/shared'
import {
  PIPELINE_NODE_ORDER,
  getPipelineNodeLabel,
  getPipelineStatusDisplay,
} from './pipeline-display-model'

export interface PipelineRecordViewModel {
  badge: string
  title: string
  summary?: string
  details?: string
  bullets?: string[]
  artifactFiles?: PipelineArtifactFileRef[]
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
}

export interface PipelineRecordGroup {
  id: PipelineNodeKind | 'task'
  title: string
  records: PipelineRecord[]
}

type PipelineArtifactRecord = Extract<PipelineRecord, {
  type: 'user_input' | 'stage_artifact' | 'node_output' | 'review_result'
}>

function formatGateAction(action: string): string {
  switch (action) {
    case 'approve':
      return '通过'
    case 'reject_with_feedback':
      return '驳回并回退'
    case 'rerun_node':
      return '重跑当前节点'
    default:
      return action
  }
}

function prefixedItems(label: string, items: string[]): string[] {
  return items.map((item) => `${label}: ${item}`)
}

function buildStageArtifactBullets(artifact: PipelineStageOutput): string[] {
  switch (artifact.node) {
    case 'explorer':
      return [
        ...prefixedItems('发现', artifact.findings),
        ...prefixedItems('文件', artifact.keyFiles),
        ...prefixedItems('下一步', artifact.nextSteps),
      ]
    case 'planner':
      return [
        ...prefixedItems('步骤', artifact.steps),
        ...prefixedItems('风险', artifact.risks),
        ...prefixedItems('验证', artifact.verification),
      ]
    case 'developer':
      return [
        ...prefixedItems('改动', artifact.changes),
        ...prefixedItems('测试', artifact.tests),
        ...prefixedItems('风险', artifact.risks),
      ]
    case 'reviewer':
      return artifact.issues.map((item) => `问题: ${item}`)
    case 'tester':
      return [
        ...prefixedItems('命令', artifact.commands),
        ...prefixedItems('结果', artifact.results),
        ...prefixedItems('阻塞', artifact.blockers),
      ]
    case 'committer':
      return [
        `Commit: ${artifact.commitMessage}`,
        `PR: ${artifact.prTitle}`,
        `状态: ${artifact.submissionStatus}`,
        ...prefixedItems('风险', artifact.risks),
      ]
  }
}

export function buildPipelineRecordViewModel(record: PipelineRecord): PipelineRecordViewModel {
  switch (record.type) {
    case 'user_input':
      return {
        badge: '任务',
        title: '用户任务',
        summary: record.content,
        tone: 'accent',
      }
    case 'node_transition':
      return {
        badge: '流程',
        title: `进入${getPipelineNodeLabel(record.toNode)}节点`,
        summary: record.fromNode ? `从${getPipelineNodeLabel(record.fromNode)}切换` : '开始执行该阶段',
        tone: 'neutral',
      }
    case 'node_output':
      return {
        badge: getPipelineNodeLabel(record.node),
        title: `${getPipelineNodeLabel(record.node)}输出`,
        summary: record.summary ?? record.content,
        details: record.summary && record.summary !== record.content ? record.content : undefined,
        tone: 'neutral',
      }
    case 'stage_artifact':
      return {
        badge: `${getPipelineNodeLabel(record.node)}产物`,
        title: `${getPipelineNodeLabel(record.node)}阶段产物`,
        summary: record.artifact.summary,
        details: record.artifact.content,
        bullets: buildStageArtifactBullets(record.artifact),
        artifactFiles: record.artifactFiles,
        tone: record.node === 'reviewer' && record.artifact.node === 'reviewer'
          ? record.artifact.approved ? 'success' : 'warning'
          : 'accent',
      }
    case 'review_result':
      return {
        badge: '审查结论',
        title: record.approved ? '审查通过' : '审查需要修改',
        summary: record.summary,
        bullets: record.issues,
        tone: record.approved ? 'success' : 'warning',
      }
    case 'gate_requested':
      return {
        badge: '人工审核',
        title: `等待人工审核：${getPipelineNodeLabel(record.node)}`,
        summary: record.summary ?? '等待人工确认后继续',
        tone: 'warning',
      }
    case 'gate_decision':
      return {
        badge: '审核结果',
        title: `${getPipelineNodeLabel(record.node)}审核结果：${formatGateAction(record.action)}`,
        summary: record.feedback,
        tone: record.action === 'approve' ? 'success' : 'warning',
      }
    case 'status_change': {
      const statusDisplay = getPipelineStatusDisplay(record.status)
      return {
        badge: '状态',
        title: `状态切换为${statusDisplay.label}`,
        summary: record.reason,
        tone: record.status === 'completed' ? 'success' : record.status === 'terminated' || record.status === 'node_failed' ? 'warning' : 'neutral',
      }
    }
    case 'error':
      return {
        badge: '错误',
        title: record.node ? `${getPipelineNodeLabel(record.node)}执行失败` : 'Pipeline 执行失败',
        summary: record.error,
        tone: 'danger',
      }
  }
}

function findGroup(groups: PipelineRecordGroup[], id: PipelineRecordGroup['id']): PipelineRecordGroup | undefined {
  return groups.find((group) => group.id === id)
}

function ensureGroup(
  groups: PipelineRecordGroup[],
  id: PipelineRecordGroup['id'],
  title: string,
): PipelineRecordGroup {
  const existing = findGroup(groups, id)
  if (existing) return existing

  const next: PipelineRecordGroup = {
    id,
    title,
    records: [],
  }
  groups.push(next)
  return next
}

function isArtifactRecord(
  record: PipelineRecord,
  stageArtifactNodes: Set<PipelineNodeKind>,
): record is PipelineArtifactRecord {
  if (record.type === 'user_input' || record.type === 'stage_artifact') return true

  if (record.type === 'node_output' || record.type === 'review_result') {
    return !stageArtifactNodes.has(record.node)
  }

  return false
}

function sortGroups(groups: PipelineRecordGroup[]): PipelineRecordGroup[] {
  const order = new Map<PipelineRecordGroup['id'], number>([
    ['task', -1],
    ...PIPELINE_NODE_ORDER.map((node, index) => [node, index] as const),
  ])

  return [...groups].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
}

export function buildPipelineRecordGroups(records: PipelineRecord[]): {
  artifacts: PipelineRecordGroup[]
  logs: PipelineRecord[]
} {
  const artifactGroups: PipelineRecordGroup[] = []
  const logs: PipelineRecord[] = []
  const stageArtifactNodes = new Set(
    records
      .filter((record): record is Extract<PipelineRecord, { type: 'stage_artifact' }> => record.type === 'stage_artifact')
      .map((record) => record.node),
  )

  for (const record of records) {
    if (!isArtifactRecord(record, stageArtifactNodes)) {
      logs.push(record)
      continue
    }

    if (record.type === 'user_input') {
      ensureGroup(artifactGroups, 'task', '任务输入').records.push(record)
      continue
    }

    ensureGroup(artifactGroups, record.node, getPipelineNodeLabel(record.node)).records.push(record)
  }

  return {
    artifacts: sortGroups(artifactGroups),
    logs,
  }
}
