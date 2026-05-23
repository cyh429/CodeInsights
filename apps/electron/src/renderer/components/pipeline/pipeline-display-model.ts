import type {
  PipelineGateRequest,
  PipelineNodeKind,
  PipelineVersion,
  PipelineSessionMeta,
  PipelineSessionStatus,
  PipelineStateSnapshot,
} from '@codeinsights/shared'

export type PipelineDisplayTone =
  | 'neutral'
  | 'running'
  | 'waiting'
  | 'failed'
  | 'success'

export interface PipelineStatusDisplay {
  label: string
  tone: PipelineDisplayTone
}

export interface PipelineHeaderViewModel {
  title: string
  eyebrow: string
  statusLabel: string
  statusTone: PipelineDisplayTone
  nodeLabel: string
  summary: string
  metaItems: string[]
}

export type PipelineStageVisualStatus =
  | 'done'
  | 'active'
  | 'waiting'
  | 'failed'
  | 'stopped'
  | 'todo'

export interface PipelineStageViewModel {
  node: PipelineNodeKind
  label: string
  index: number
  status: PipelineStageVisualStatus
  statusLabel: string
  ariaLabel: string
}

export interface PipelineGateViewModel {
  title: string
  nodeLabel: string
  iterationLabel: string
  priorityLabel: string
  primaryActionHint: string
  summary?: string
  feedbackPlaceholder: string
  approveLabel: string
  rejectLabel: string
  rerunLabel: string
  rejectRequiresFeedback: boolean
}

export interface PipelineFailureViewModel {
  title: string
  nodeLabel: string
  detailLabel: string
  message: string
  partialOutputLabel: string
  partialOutput?: string
  locateErrorLabel: string
  copyErrorLabel: string
  artifactsLabel: string
  restartLabel: string
  settingsLabel: string
}

export const PIPELINE_NODE_ORDER: PipelineNodeKind[] = [
  'explorer',
  'planner',
  'developer',
  'reviewer',
  'tester',
]

export const PIPELINE_V2_NODE_ORDER: PipelineNodeKind[] = [
  ...PIPELINE_NODE_ORDER,
  'committer',
]

const NODE_LABELS: Record<PipelineNodeKind, string> = {
  explorer: '探索',
  planner: '计划',
  developer: '开发',
  reviewer: '审查',
  tester: '测试',
  committer: '提交',
}

const STATUS_DISPLAY: Record<PipelineSessionStatus, PipelineStatusDisplay> = {
  idle: { label: '未启动', tone: 'neutral' },
  running: { label: '运行中', tone: 'running' },
  waiting_human: { label: '等待人工审核', tone: 'waiting' },
  node_failed: { label: '节点失败', tone: 'failed' },
  completed: { label: '已完成', tone: 'success' },
  terminated: { label: '已停止', tone: 'neutral' },
  recovery_failed: { label: '恢复失败', tone: 'failed' },
}

const STAGE_STATUS_LABELS: Record<PipelineStageVisualStatus, string> = {
  done: '已完成',
  active: '运行中',
  waiting: '待审核',
  failed: '失败',
  stopped: '已停止',
  todo: '待处理',
}

function resolvePipelineVersion(version: PipelineVersion | undefined): PipelineVersion {
  return version ?? 1
}

export function getPipelineNodeOrder(version: PipelineVersion | undefined): PipelineNodeKind[] {
  return resolvePipelineVersion(version) === 2
    ? PIPELINE_V2_NODE_ORDER
    : PIPELINE_NODE_ORDER
}

function nodeIndex(node: PipelineNodeKind | undefined, order: readonly PipelineNodeKind[]): number {
  return node ? order.indexOf(node) : -1
}

function buildSummary(status: PipelineSessionStatus, nodeLabel: string): string {
  switch (status) {
    case 'running':
      return `${nodeLabel}执行中`
    case 'waiting_human':
      return `等待确认${nodeLabel}节点`
    case 'node_failed':
      return `${nodeLabel}节点失败`
    case 'completed':
      return 'Pipeline 已完成'
    case 'terminated':
      return 'Pipeline 已停止'
    case 'recovery_failed':
      return `${nodeLabel}恢复失败`
    case 'idle':
    default:
      return '准备启动'
  }
}

export function getPipelineNodeLabel(node: PipelineNodeKind): string {
  return NODE_LABELS[node]
}

export function getPipelineStatusDisplay(status: PipelineSessionStatus): PipelineStatusDisplay {
  return STATUS_DISPLAY[status]
}

export function buildPipelineHeaderViewModel({
  session,
  state,
}: {
  session: PipelineSessionMeta | null
  state: PipelineStateSnapshot | null
}): PipelineHeaderViewModel {
  const status = state?.status ?? session?.status ?? 'idle'
  const currentNode = state?.currentNode ?? session?.currentNode ?? 'explorer'
  const nodeLabel = getPipelineNodeLabel(currentNode)
  const display = getPipelineStatusDisplay(status)
  const reviewIteration = state?.reviewIteration ?? session?.reviewIteration ?? 0
  const metaItems = [`第 ${reviewIteration + 1} 轮`]

  return {
    title: session?.title ?? '新 Pipeline 会话',
    eyebrow: 'CodeInsights Pipeline',
    statusLabel: display.label,
    statusTone: display.tone,
    nodeLabel,
    summary: buildSummary(status, nodeLabel),
    metaItems,
  }
}

export function buildPipelineStageViewModels(
  state: PipelineStateSnapshot | null,
  options: { version?: PipelineVersion } = {},
): PipelineStageViewModel[] {
  const version = options.version ?? state?.version
  const order = getPipelineNodeOrder(version)
  const lastApprovedIndex = nodeIndex(state?.lastApprovedNode, order)
  const currentIndex = nodeIndex(state?.currentNode, order)

  return order.map((node, index) => {
    let status: PipelineStageVisualStatus = lastApprovedIndex >= index ? 'done' : 'todo'

    if (state?.status === 'completed' && currentIndex >= index) {
      status = 'done'
    } else if (state?.status === 'terminated') {
      status = currentIndex === index ? 'stopped' : status
    } else if (state?.status === 'node_failed' || state?.status === 'recovery_failed') {
      status = currentIndex === index ? 'failed' : status
    } else if (state?.status === 'waiting_human') {
      status = currentIndex === index ? 'waiting' : status
    } else if (state?.status === 'running') {
      status = currentIndex === index ? 'active' : status
    }

    return {
      node,
      label: getPipelineNodeLabel(node),
      index,
      status,
      statusLabel: STAGE_STATUS_LABELS[status],
      ariaLabel: `${getPipelineNodeLabel(node)}节点：${STAGE_STATUS_LABELS[status]}`,
    }
  })
}

function approveLabelForNode(node: PipelineNodeKind, version: PipelineVersion): string {
  switch (node) {
    case 'explorer':
      return '确认方向，进入计划'
    case 'planner':
      return '确认计划，进入开发'
    case 'reviewer':
      return '进入测试'
    case 'tester':
      return version === 2 ? '确认测试，进入提交' : '确认完成'
    case 'committer':
      return '确认提交材料'
    case 'developer':
    default:
      return '通过并继续'
  }
}

export function buildPipelineGateViewModel(
  request: PipelineGateRequest,
  options: { version?: PipelineVersion } = {},
): PipelineGateViewModel {
  const nodeLabel = getPipelineNodeLabel(request.node)
  const approveLabel = approveLabelForNode(request.node, resolvePipelineVersion(options.version))
  const isReviewIterationLimit = request.kind === 'review_iteration_limit'
  const reviewIterationLimitApproveLabel = '接受风险并进入测试'

  return {
    title: isReviewIterationLimit && request.title ? request.title : `${nodeLabel}节点待确认`,
    nodeLabel,
    iterationLabel: isReviewIterationLimit ? `已完成 ${request.iteration} 轮审查` : `第 ${request.iteration + 1} 轮`,
    priorityLabel: '待你处理',
    primaryActionHint: isReviewIterationLimit ? reviewIterationLimitApproveLabel : approveLabel,
    summary: request.summary,
    feedbackPlaceholder: request.feedbackHint ?? '填写反馈后可以要求修改或重跑当前节点',
    approveLabel: isReviewIterationLimit ? reviewIterationLimitApproveLabel : approveLabel,
    rejectLabel: '要求修改',
    rerunLabel: `重跑${nodeLabel}`,
    rejectRequiresFeedback: true,
  }
}

export function buildPipelineFailureViewModel({
  state,
  error,
  partialOutput,
}: {
  state: PipelineStateSnapshot | null
  error?: string | null
  partialOutput?: string
}): PipelineFailureViewModel | null {
  if (!state || (state.status !== 'node_failed' && state.status !== 'recovery_failed')) {
    return null
  }

  const nodeLabel = getPipelineNodeLabel(state.currentNode)
  const title = state.status === 'recovery_failed'
    ? `${nodeLabel}节点恢复失败`
    : `${nodeLabel}节点执行失败`

  return {
    title,
    nodeLabel,
    detailLabel: '错误详情',
    message: error?.trim() || '没有收到详细错误信息，请查看运行日志。',
    partialOutputLabel: '失败前输出',
    partialOutput: partialOutput?.trim() || undefined,
    locateErrorLabel: '定位错误记录',
    copyErrorLabel: '复制错误',
    artifactsLabel: '打开产物目录',
    restartLabel: '重新启动 Pipeline',
    settingsLabel: '打开 Agent 设置',
  }
}
