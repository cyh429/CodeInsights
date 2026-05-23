import { describe, expect, test } from 'bun:test'
import { buildPipelineRecordsFromNodeComplete } from './pipeline-record-builder'

describe('buildPipelineRecordsFromNodeComplete', () => {
  test('reviewer 节点完成时生成 node_output、stage_artifact 和 review_result', () => {
    const records = buildPipelineRecordsFromNodeComplete('session-1', {
      type: 'node_complete',
      node: 'reviewer',
      output: '{"approved":false}',
      summary: '缺少测试覆盖',
      approved: false,
      issues: ['缺少测试', '未说明回归范围'],
      artifact: {
        node: 'reviewer',
        summary: '缺少测试覆盖',
        approved: false,
        issues: ['缺少测试', '未说明回归范围'],
        content: '{"approved":false}',
      },
      createdAt: 100,
    })

    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({
      type: 'node_output',
      node: 'reviewer',
      summary: '缺少测试覆盖',
    })
    expect(records[1]).toMatchObject({
      type: 'stage_artifact',
      node: 'reviewer',
      artifact: {
        approved: false,
        summary: '缺少测试覆盖',
      },
    })
    expect(records[2]).toMatchObject({
      type: 'review_result',
      node: 'reviewer',
      approved: false,
      summary: '缺少测试覆盖',
      issues: ['缺少测试', '未说明回归范围'],
    })
  })

  test('非 reviewer 节点完成时生成 node_output 和 stage_artifact', () => {
    const records = buildPipelineRecordsFromNodeComplete('session-2', {
      type: 'node_complete',
      node: 'developer',
      output: '完成实现',
      summary: '已修改 3 个文件',
      artifact: {
        node: 'developer',
        summary: '已修改 3 个文件',
        changes: ['修改 Pipeline UI'],
        tests: ['bun test'],
        risks: [],
        content: '完成实现',
      },
      createdAt: 200,
    })

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      type: 'node_output',
      node: 'developer',
      summary: '已修改 3 个文件',
    })
    expect(records[1]).toMatchObject({
      type: 'stage_artifact',
      node: 'developer',
      artifact: {
        changes: ['修改 Pipeline UI'],
      },
    })
  })
})
