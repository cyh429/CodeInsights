import { describe, expect, test } from 'bun:test'
import {
  buildPipelineRecordGroups,
  buildPipelineRecordViewModel,
} from './pipeline-record-view-model'

describe('buildPipelineRecordViewModel', () => {
  test('review_result 会生成结构化 reviewer 卡片', () => {
    const viewModel = buildPipelineRecordViewModel({
      id: 'review-1',
      sessionId: 'session-1',
      type: 'review_result',
      node: 'reviewer',
      approved: false,
      summary: '缺少测试覆盖',
      issues: ['缺少测试', '没有验证步骤'],
      createdAt: 1,
    })

    expect(viewModel).toEqual({
      badge: '审查结论',
      title: '审查需要修改',
      summary: '缺少测试覆盖',
      bullets: ['缺少测试', '没有验证步骤'],
      tone: 'warning',
    })
  })

  test('node_output 在 summary 与 content 不同时保留 details', () => {
    const viewModel = buildPipelineRecordViewModel({
      id: 'output-1',
      sessionId: 'session-1',
      type: 'node_output',
      node: 'developer',
      summary: '已修改 3 个文件',
      content: '已修改 3 个文件\n- a.ts\n- b.ts\n- c.ts',
      createdAt: 1,
    })

    expect(viewModel).toEqual({
      badge: '开发',
      title: '开发输出',
      summary: '已修改 3 个文件',
      details: '已修改 3 个文件\n- a.ts\n- b.ts\n- c.ts',
      tone: 'neutral',
    })
  })

  test('stage_artifact 会生成结构化阶段产物卡片', () => {
    const viewModel = buildPipelineRecordViewModel({
      id: 'artifact-1',
      sessionId: 'session-1',
      type: 'stage_artifact',
      node: 'planner',
      artifact: {
        node: 'planner',
        summary: '按三步实现',
        steps: ['补测试', '改实现'],
        risks: ['状态回归'],
        verification: ['bun test'],
        content: '{"summary":"按三步实现"}',
      },
      artifactFiles: [
        {
          kind: 'markdown',
          displayName: '计划阶段产物.md',
          relativePath: 'planner-1.md',
        },
      ],
      createdAt: 1,
    })

    expect(viewModel).toEqual({
      badge: '计划产物',
      title: '计划阶段产物',
      summary: '按三步实现',
      details: '{"summary":"按三步实现"}',
      bullets: ['步骤: 补测试', '步骤: 改实现', '风险: 状态回归', '验证: bun test'],
      artifactFiles: [
        {
          kind: 'markdown',
          displayName: '计划阶段产物.md',
          relativePath: 'planner-1.md',
        },
      ],
      tone: 'accent',
    })
  })

  test('records 会拆成阶段产物和运行日志', () => {
    const groups = buildPipelineRecordGroups([
      {
        id: 'input-1',
        sessionId: 'session-1',
        type: 'user_input',
        content: '优化 Pipeline UI',
        createdAt: 1,
      },
      {
        id: 'transition-1',
        sessionId: 'session-1',
        type: 'node_transition',
        toNode: 'explorer',
        createdAt: 2,
      },
      {
        id: 'output-1',
        sessionId: 'session-1',
        type: 'node_output',
        node: 'explorer',
        content: '探索结论',
        createdAt: 3,
      },
      {
        id: 'artifact-1',
        sessionId: 'session-1',
        type: 'stage_artifact',
        node: 'explorer',
        artifact: {
          node: 'explorer',
          summary: '探索结论',
          findings: ['入口在 PipelineView'],
          keyFiles: ['PipelineView.tsx'],
          nextSteps: ['进入计划'],
          content: '{"summary":"探索结论"}',
        },
        createdAt: 3,
      },
      {
        id: 'status-1',
        sessionId: 'session-1',
        type: 'status_change',
        status: 'completed',
        createdAt: 4,
      },
    ])

    expect(groups.artifacts.map((group) => ({
      id: group.id,
      title: group.title,
      recordIds: group.records.map((record) => record.id),
    }))).toEqual([
      {
        id: 'task',
        title: '任务输入',
        recordIds: ['input-1'],
      },
      {
        id: 'explorer',
        title: '探索',
        recordIds: ['artifact-1'],
      },
    ])
    expect(groups.logs.map((record) => record.id)).toEqual([
      'transition-1',
      'output-1',
      'status-1',
    ])
  })
})
