import { describe, expect, test } from 'bun:test'
import type { AgentMessage } from '@codeinsights/shared'
import {
  buildCompletionOptions,
  sendCompletionSignal,
} from './completion-signal'

describe('completion-signal helper', () => {
  test('构造完成 opts 时保留 startedAt 和可选字段', () => {
    expect(buildCompletionOptions(1234, {
      stoppedByUser: false,
      resultSubtype: 'success',
    })).toEqual({
      stoppedByUser: false,
      resultSubtype: 'success',
      startedAt: 1234,
    })
  })

  test('发送错误完成信号时保持先 onError 后 onComplete', () => {
    const calls: string[] = []
    const messages: AgentMessage[] = []

    sendCompletionSignal({
      callbacks: {
        onError: (error) => {
          calls.push(`error:${error}`)
        },
        onComplete: (completeMessages, opts) => {
          expect(completeMessages).toBe(messages)
          expect(opts).toEqual({ startedAt: 5678 })
          calls.push('complete')
        },
      },
      error: '渠道不存在',
      messages,
      startedAt: 5678,
    })

    expect(calls).toEqual(['error:渠道不存在', 'complete'])
  })

  test('错误路径先发送 onError，再延迟读取完成消息', () => {
    const calls: string[] = []
    const messages: AgentMessage[] = []

    sendCompletionSignal({
      callbacks: {
        onError: (error) => {
          calls.push(`error:${error}`)
        },
        onComplete: (completeMessages) => {
          expect(completeMessages).toBe(messages)
          calls.push('complete')
        },
      },
      error: '执行失败',
      messages: () => {
        calls.push('read-messages')
        return messages
      },
      startedAt: 9012,
    })

    expect(calls).toEqual(['error:执行失败', 'read-messages', 'complete'])
  })
})
