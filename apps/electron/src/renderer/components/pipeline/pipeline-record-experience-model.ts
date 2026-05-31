import type { PipelineNodeKind, PipelineRecord, PipelineVersion } from '@codeinsights/shared'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
  type PipelineRecordGroup,
} from './pipeline-record-view-model'

export type PipelineRecordTab = 'artifacts' | 'logs'
export type PipelineRecordStageFilter = 'all' | PipelineNodeKind | 'task'

export interface PipelineRecordFilter {
  stage: PipelineRecordStageFilter
  query: string
}

export interface PipelineRecordGroupSlice {
  groups: PipelineRecordGroup[]
  totalCount: number
  visibleCount: number
  hasMore: boolean
}

export interface PipelineRecordSearchMatch {
  recordId: string
  tab: PipelineRecordTab
  stage: PipelineRecordStageFilter
  title: string
  snippet: string
}

export interface PipelineRecordNavigationTarget {
  recordId: string
  tab: PipelineRecordTab
  stage: PipelineRecordStageFilter
}

export interface PipelineExternalFocusFilterInput {
  query: string
  stage: PipelineRecordStageFilter
  targetStage: PipelineRecordStageFilter
}

export interface PipelineExternalFocusFilter {
  query: string
  stage: PipelineRecordStageFilter
}

export interface PipelineMarkdownReportInput {
  title: string
  records: PipelineRecord[]
  generatedAt: number
  version?: PipelineVersion
}

interface PipelineRecordExperienceOptions {
  version?: PipelineVersion
}

const SEARCH_FIELD_LIMIT = 4000

function hasRecordNode(record: PipelineRecord): record is PipelineRecord & { node: PipelineNodeKind } {
  return 'node' in record
}

export function getPipelineRecordStage(record: PipelineRecord): PipelineRecordStageFilter | 'system' {
  if (record.type === 'user_input') return 'task'
  if (record.type === 'node_transition') return record.toNode
  if (hasRecordNode(record)) return record.node
  return 'system'
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

function boundedSearchField(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.slice(0, SEARCH_FIELD_LIMIT)
}

function stringifyForSearch(record: PipelineRecord): string {
  const viewModel = buildPipelineRecordViewModel(record)
  return [
    record.id,
    record.type,
    viewModel.badge,
    viewModel.title,
    boundedSearchField(viewModel.summary),
    boundedSearchField(viewModel.details),
    ...(viewModel.bullets ?? []).map((item) => boundedSearchField(item)),
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n')
    .toLowerCase()
}

function buildSnippet(record: PipelineRecord, query: string): string {
  const viewModel = buildPipelineRecordViewModel(record)
  const candidates = [
    viewModel.summary,
    ...(viewModel.bullets ?? []),
    viewModel.details,
    viewModel.title,
  ].filter((item): item is string => Boolean(item))
  const normalized = normalizeQuery(query)
  const matched = candidates.find((item) => item.toLowerCase().includes(normalized))
    ?? candidates[0]
    ?? viewModel.title

  return matched.length > 72 ? `${matched.slice(0, 72)}...` : matched
}

export function recordMatchesQuery(record: PipelineRecord, query: string): boolean {
  const normalized = normalizeQuery(query)
  if (!normalized) return true
  return stringifyForSearch(record).includes(normalized)
}

export function recordMatchesStage(record: PipelineRecord, stage: PipelineRecordStageFilter): boolean {
  if (stage === 'all') return true
  return getPipelineRecordStage(record) === stage
}

export function filterPipelineRecords(
  records: PipelineRecord[],
  filter: PipelineRecordFilter,
): PipelineRecord[] {
  return records.filter((record) =>
    recordMatchesStage(record, filter.stage) && recordMatchesQuery(record, filter.query),
  )
}

export function filterPipelineRecordGroups(
  groups: PipelineRecordGroup[],
  filter: PipelineRecordFilter,
): PipelineRecordGroup[] {
  return groups
    .map((group) => ({
      ...group,
      records: group.records.filter((record) =>
        recordMatchesStage(record, filter.stage) && recordMatchesQuery(record, filter.query),
      ),
    }))
    .filter((group) => group.records.length > 0)
}

export function flattenPipelineRecordGroups(groups: PipelineRecordGroup[]): PipelineRecord[] {
  return groups.flatMap((group) => group.records)
}

export function slicePipelineRecordGroups(
  groups: PipelineRecordGroup[],
  visibleLimit: number,
): PipelineRecordGroupSlice {
  const totalCount = flattenPipelineRecordGroups(groups).length
  const targetCount = Math.max(0, visibleLimit)
  let remaining = targetCount
  const slicedGroups: PipelineRecordGroup[] = []

  for (const group of groups) {
    if (remaining <= 0) break

    const records = group.records.slice(0, remaining)
    if (records.length > 0) {
      slicedGroups.push({
        ...group,
        records,
      })
    }
    remaining -= records.length
  }

  const visibleCount = flattenPipelineRecordGroups(slicedGroups).length

  return {
    groups: slicedGroups,
    totalCount,
    visibleCount,
    hasMore: visibleCount < totalCount,
  }
}

export function buildPipelineRecordSearchMatches(
  records: PipelineRecord[],
  query: string,
  options: PipelineRecordExperienceOptions = {},
): PipelineRecordSearchMatch[] {
  const normalized = normalizeQuery(query)
  if (!normalized) return []

  const groups = buildPipelineRecordGroups(records, { version: options.version })
  const artifactIds = new Set(flattenPipelineRecordGroups(groups.artifacts).map((record) => record.id))

  return records
    .filter((record) => recordMatchesQuery(record, normalized))
    .map((record) => {
      const viewModel = buildPipelineRecordViewModel(record)
      const stage = getPipelineRecordStage(record)
      return {
        recordId: record.id,
        tab: artifactIds.has(record.id) ? 'artifacts' : 'logs',
        stage: stage === 'system' ? 'all' : stage,
        title: viewModel.title,
        snippet: buildSnippet(record, normalized),
      }
    })
}

export function buildPipelineRecordFocusTarget(
  records: PipelineRecord[],
  recordId: string,
  options: PipelineRecordExperienceOptions = {},
): PipelineRecordNavigationTarget | null {
  const groups = buildPipelineRecordGroups(records, { version: options.version })
  const artifactIds = new Set(flattenPipelineRecordGroups(groups.artifacts).map((record) => record.id))
  const record = records.find((item) => item.id === recordId)
  if (!record) return null

  const stage = getPipelineRecordStage(record)
  return {
    recordId,
    tab: artifactIds.has(recordId) ? 'artifacts' : 'logs',
    stage: stage === 'system' ? 'all' : stage,
  }
}

export function buildPipelineStageNavigationTarget(
  records: PipelineRecord[],
  stage: PipelineNodeKind,
  options: PipelineRecordExperienceOptions = {},
): PipelineRecordNavigationTarget | null {
  const groups = buildPipelineRecordGroups(records, { version: options.version })
  const artifactRecord = flattenPipelineRecordGroups(groups.artifacts)
    .find((record) => getPipelineRecordStage(record) === stage)
  if (artifactRecord) {
    return {
      recordId: artifactRecord.id,
      tab: 'artifacts',
      stage,
    }
  }

  const logRecord = groups.logs.find((record) => getPipelineRecordStage(record) === stage)
  if (!logRecord) return null

  return {
    recordId: logRecord.id,
    tab: 'logs',
    stage,
  }
}

export function buildPipelineExternalFocusFilter(
  input: PipelineExternalFocusFilterInput,
): PipelineExternalFocusFilter {
  return {
    query: '',
    stage: input.targetStage,
  }
}

function formatReportTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
  })
}

function appendRecordMarkdown(lines: string[], record: PipelineRecord): void {
  const viewModel = buildPipelineRecordViewModel(record)
  lines.push(`#### ${viewModel.title}`)
  if (viewModel.summary) {
    lines.push('')
    lines.push(viewModel.summary)
  }
  if (viewModel.bullets?.length) {
    lines.push('')
    lines.push(...viewModel.bullets.map((item) => `- ${item}`))
  }
  if (viewModel.details) {
    const fence = viewModel.details.includes('```') ? '````' : '```'
    lines.push('')
    lines.push(`${fence}text`)
    lines.push(viewModel.details)
    lines.push(fence)
  }
  lines.push('')
}

export function buildPipelineMarkdownReport(input: PipelineMarkdownReportInput): string {
  const groups = buildPipelineRecordGroups(input.records, { version: input.version })
  const lines: string[] = [
    `# ${input.title}`,
    '',
    `生成时间：${formatReportTime(input.generatedAt)}`,
    '',
    '## 阶段产物',
    '',
  ]

  if (groups.artifacts.length === 0) {
    lines.push('暂无阶段产物。', '')
  } else {
    for (const group of groups.artifacts) {
      lines.push(`### ${group.title}`, '')
      for (const record of group.records) {
        appendRecordMarkdown(lines, record)
      }
    }
  }

  lines.push('## 关键运行日志', '')
  if (groups.logs.length === 0) {
    lines.push('暂无运行日志。', '')
  } else {
    for (const record of groups.logs) {
      const viewModel = buildPipelineRecordViewModel(record)
      const summary = viewModel.summary ? `：${viewModel.summary}` : ''
      lines.push(`- ${viewModel.title}${summary}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}
