import { describe, expect, test } from 'bun:test'
import type { PipelineRecord } from '@codeinsights/shared'
import {
  mergePipelineRecordsTail,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'

function userRecord(id: string): PipelineRecord {
  return {
    id,
    sessionId: 'session-1',
    type: 'user_input',
    content: id,
    createdAt: 1,
  }
}

describe('pipeline-record-tail-model', () => {
  test('只允许最新 tail 请求提交，避免旧请求覆盖新 records', () => {
    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 1,
      latestLoadId: 2,
      afterIndex: 0,
      currentCursor: 0,
    })).toBe(false)

    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 2,
      latestLoadId: 2,
      afterIndex: 0,
      currentCursor: 2,
    })).toBe(false)

    expect(shouldApplyPipelineRecordsTailLoad({
      loadId: 2,
      latestLoadId: 2,
      afterIndex: 2,
      currentCursor: 2,
    })).toBe(true)
  })

  test('增量 records 合并按 id 去重并追加', () => {
    const prev = [userRecord('record-1'), userRecord('record-2')]
    const merged = mergePipelineRecordsTail(prev, [
      userRecord('record-2'),
      userRecord('record-3'),
    ], 2)

    expect(merged.map((record) => record.id)).toEqual(['record-1', 'record-2', 'record-3'])
  })
})
