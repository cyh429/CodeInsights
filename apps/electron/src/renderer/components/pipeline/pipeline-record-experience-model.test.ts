import { describe, expect, test } from 'bun:test'
import type { PipelineRecord } from '@codeinsights/shared'
import {
  buildPipelineExternalFocusFilter,
  buildPipelineMarkdownReport,
  buildPipelineRecordFocusTarget,
  buildPipelineRecordSearchMatches,
  buildPipelineStageNavigationTarget,
  filterPipelineRecordGroups,
  filterPipelineRecords,
  flattenPipelineRecordGroups,
  slicePipelineRecordGroups,
} from './pipeline-record-experience-model'
import { buildPipelineRecordGroups } from './pipeline-record-view-model'

const records: PipelineRecord[] = [
  {
    id: 'input-1',
    sessionId: 'session-1',
    type: 'user_input',
    content: '优化 Pipeline UI 搜索体验',
    createdAt: 1,
  },
  {
    id: 'explorer-artifact',
    sessionId: 'session-1',
    type: 'stage_artifact',
    node: 'explorer',
    artifact: {
      node: 'explorer',
      summary: '发现记录列表一次性渲染',
      findings: ['Records 缺少分页'],
      keyFiles: ['PipelineRecords.tsx'],
      nextSteps: ['增加分段渲染'],
      content: '探索全文',
    },
    createdAt: 2,
  },
  {
    id: 'planner-artifact',
    sessionId: 'session-1',
    type: 'stage_artifact',
    node: 'planner',
    artifact: {
      node: 'planner',
      summary: '先补测试再实现',
      steps: ['补充搜索测试', '实现跳转'],
      risks: ['筛选状态丢失'],
      verification: ['bun test'],
      content: '计划全文',
    },
    createdAt: 3,
  },
  {
    id: 'review-log',
    sessionId: 'session-1',
    type: 'gate_decision',
    node: 'reviewer',
    action: 'reject_with_feedback',
    feedback: '需要补充搜索跳转',
    createdAt: 4,
  },
  {
    id: 'status-log',
    sessionId: 'session-1',
    type: 'status_change',
    status: 'completed',
    reason: '测试通过',
    createdAt: 5,
  },
]

describe('pipeline-record-experience-model', () => {
  test('按阶段和搜索词过滤阶段产物', () => {
    const groups = buildPipelineRecordGroups(records)
    const filtered = filterPipelineRecordGroups(groups.artifacts, {
      stage: 'planner',
      query: '搜索',
    })

    expect(filtered.map((group) => ({
      id: group.id,
      recordIds: group.records.map((record) => record.id),
    }))).toEqual([
      {
        id: 'planner',
        recordIds: ['planner-artifact'],
      },
    ])
  })

  test('分段渲染会按组顺序截断记录', () => {
    const groups = buildPipelineRecordGroups(records)
    const sliced = slicePipelineRecordGroups(groups.artifacts, 2)

    expect(sliced.totalCount).toBe(3)
    expect(sliced.visibleCount).toBe(2)
    expect(sliced.hasMore).toBe(true)
    expect(flattenPipelineRecordGroups(sliced.groups).map((record) => record.id)).toEqual([
      'input-1',
      'explorer-artifact',
    ])
  })

  test('搜索匹配会区分阶段产物和运行日志用于跳转', () => {
    const matches = buildPipelineRecordSearchMatches(records, '搜索')

    expect(matches.map((match) => ({
      recordId: match.recordId,
      tab: match.tab,
      stage: match.stage,
    }))).toEqual([
      {
        recordId: 'input-1',
        tab: 'artifacts',
        stage: 'task',
      },
      {
        recordId: 'planner-artifact',
        tab: 'artifacts',
        stage: 'planner',
      },
      {
        recordId: 'review-log',
        tab: 'logs',
        stage: 'reviewer',
      },
    ])
  })

  test('StageRail 节点点击会映射到 Records 阶段筛选和可定位记录', () => {
    expect(buildPipelineStageNavigationTarget(records, 'planner')).toEqual({
      recordId: 'planner-artifact',
      stage: 'planner',
      tab: 'artifacts',
    })

    expect(buildPipelineStageNavigationTarget(records, 'reviewer')).toEqual({
      recordId: 'review-log',
      stage: 'reviewer',
      tab: 'logs',
    })
  })

  test('失败卡定位错误记录时会切到运行日志并保留阶段上下文', () => {
    const target = buildPipelineRecordFocusTarget([
      ...records,
      {
        id: 'developer-error',
        sessionId: 'session-1',
        type: 'error',
        node: 'developer',
        error: '构建失败',
        createdAt: 6,
      },
    ], 'developer-error')

    expect(target).toEqual({
      recordId: 'developer-error',
      stage: 'developer',
      tab: 'logs',
    })
  })

  test('外部定位会清空搜索条件，避免目标记录被当前搜索词过滤掉', () => {
    expect(buildPipelineExternalFocusFilter({
      query: '不匹配目标记录的关键词',
      stage: 'all',
      targetStage: 'developer',
    })).toEqual({
      query: '',
      stage: 'developer',
    })
  })

  test('运行日志过滤保留无节点状态记录的全局可见性', () => {
    const logs = buildPipelineRecordGroups(records).logs

    expect(filterPipelineRecords(logs, { stage: 'planner', query: '' }).map((record) => record.id)).toEqual([])
    expect(filterPipelineRecords(logs, { stage: 'all', query: '测试' }).map((record) => record.id)).toEqual([
      'status-log',
    ])
  })

  test('Markdown 报告会复用结构化产物和关键日志', () => {
    const report = buildPipelineMarkdownReport({
      title: '第四阶段验证',
      records,
      generatedAt: 10,
    })

    expect(report).toContain('# 第四阶段验证')
    expect(report).toContain('## 阶段产物')
    expect(report).toContain('### 探索')
    expect(report).toContain('- 发现: Records 缺少分页')
    expect(report).toContain('## 关键运行日志')
    expect(report).toContain('- 审查审核结果：驳回并回退：需要补充搜索跳转')
  })

  test('Markdown 报告会用更长 fence 包裹包含代码块的详情', () => {
    const report = buildPipelineMarkdownReport({
      title: '包含代码块的报告',
      records: [
        {
          id: 'output-with-fence',
          sessionId: 'session-1',
          type: 'node_output',
          node: 'developer',
          summary: '包含代码块',
          content: '包含代码块\n```ts\nconst value = 1\n```',
          createdAt: 1,
        },
      ],
      generatedAt: 10,
    })

    expect(report).toContain('````text\n包含代码块\n```ts\nconst value = 1\n```\n````')
  })
})
