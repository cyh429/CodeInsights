import * as React from 'react'
import type { PipelineNodeKind, PipelineRecord } from '@codeinsights/shared'
import type { PipelineRecordsFocusRequest } from './PipelineRecords'
import {
  mergePipelineRecordsTail,
  resetPipelineRecordsTailLoadState,
  shouldApplyPipelineRecordsTailLoad,
} from './pipeline-record-tail-model'

export interface UsePipelineRecordsTailResult {
  records: PipelineRecord[]
  recordsFocusRequest: PipelineRecordsFocusRequest | null
  requestStageFocus: (node: PipelineNodeKind) => void
  requestRecordFocus: (recordId: string) => void
}

export function usePipelineRecordsTail(
  sessionId: string,
  refreshVersion: number,
): UsePipelineRecordsTailResult {
  const [records, setRecords] = React.useState<PipelineRecord[]>([])
  const [recordsFocusRequest, setRecordsFocusRequest] = React.useState<PipelineRecordsFocusRequest | null>(null)
  const recordsCursorRef = React.useRef(0)
  const recordsLoadSeqRef = React.useRef(0)
  const recordsFocusSeqRef = React.useRef(0)

  React.useEffect(() => {
    const reset = resetPipelineRecordsTailLoadState({
      cursor: recordsCursorRef.current,
      latestLoadId: recordsLoadSeqRef.current,
    })
    recordsCursorRef.current = reset.cursor
    recordsLoadSeqRef.current = reset.latestLoadId
    setRecords([])
  }, [sessionId])

  React.useEffect(() => {
    let cancelled = false

    async function loadRecordsTail(): Promise<void> {
      const loadId = recordsLoadSeqRef.current + 1
      recordsLoadSeqRef.current = loadId
      const afterIndex = recordsCursorRef.current
      let result = await window.electronAPI.getPipelineRecordsTail({
        sessionId,
        afterIndex,
        limit: 300,
      })
      const recordsBatch = [...result.records]

      while (result.hasMore) {
        result = await window.electronAPI.getPipelineRecordsTail({
          sessionId,
          afterIndex: result.nextIndex,
          limit: 300,
        })
        recordsBatch.push(...result.records)
      }

      if (cancelled) return
      if (!shouldApplyPipelineRecordsTailLoad({
        loadId,
        latestLoadId: recordsLoadSeqRef.current,
        afterIndex,
        currentCursor: recordsCursorRef.current,
      })) {
        return
      }

      recordsCursorRef.current = result.nextIndex
      setRecords((prev) => mergePipelineRecordsTail(prev, recordsBatch, afterIndex))
    }

    loadRecordsTail().catch((error) => {
      console.error('[PipelineRecordsTail] 读取 Pipeline 记录失败:', error)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion])

  const requestStageFocus = React.useCallback((node: PipelineNodeKind): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'stage',
      node,
    })
  }, [])

  const requestRecordFocus = React.useCallback((recordId: string): void => {
    recordsFocusSeqRef.current += 1
    setRecordsFocusRequest({
      nonce: recordsFocusSeqRef.current,
      type: 'record',
      recordId,
    })
  }, [])

  return {
    records,
    recordsFocusRequest,
    requestStageFocus,
    requestRecordFocus,
  }
}
