import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai'
import type { PipelineStateSnapshot, PipelineStreamPayload } from '@codeinsights/shared'
import {
  applyPipelineStreamState,
  applyPipelineLiveOutput,
  applyPipelineStreamErrorState,
  getPipelineLiveOutput,
  hasPipelineLiveOutputNode,
  pipelineSessionIndicatorMapAtom,
  pipelineSessionStateMapAtom,
  type PipelineLiveOutputState,
} from './pipeline-atoms'

function payload(event: PipelineStreamPayload['event']): PipelineStreamPayload {
  return {
    sessionId: 'session-1',
    event,
  }
}

describe('applyPipelineLiveOutput', () => {
  test('node_start 会重置当前节点 live buffer 并写入启动进度，text_delta 会追加文本', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 1,
    }))
    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toContain('开发节点已启动')

    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '第一段',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '第二段',
      createdAt: 3,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toContain('第一段第二段')

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 4,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toContain('开发节点已启动')
    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).not.toContain('第一段')
  })

  test('node_complete 会清理对应节点，终态会清理整个会话', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'explorer',
      delta: '探索输出',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'planner',
      delta: '计划输出',
      createdAt: 2,
    }))

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_complete',
      node: 'explorer',
      output: '探索输出',
      createdAt: 3,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'explorer')).toBe('')
    expect(getPipelineLiveOutput(state, 'session-1', 'planner')).toBe('计划输出')

    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'completed',
      currentNode: 'tester',
      createdAt: 4,
    }))

    expect(getPipelineLiveOutput(state, 'session-1', 'planner')).toBe('')
  })

  test('失败态保留当前节点 partial output，停止和完成才清理整个会话', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'developer',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'developer',
      delta: '失败前输出',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'node_failed',
      currentNode: 'developer',
      createdAt: 3,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'developer')).toBe(true)
    expect(getPipelineLiveOutput(state, 'session-1', 'developer')).toContain('失败前输出')

    state = applyPipelineLiveOutput(state, payload({
      type: 'status_change',
      status: 'terminated',
      currentNode: 'developer',
      createdAt: 4,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'developer')).toBe(false)
  })

  test('gate_waiting 会清掉当前节点的 live buffer，避免审核完成后继续显示旧输出', () => {
    let state: PipelineLiveOutputState = new Map()

    state = applyPipelineLiveOutput(state, payload({
      type: 'node_start',
      node: 'reviewer',
      createdAt: 1,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'text_delta',
      node: 'reviewer',
      delta: '审查输出',
      createdAt: 2,
    }))
    state = applyPipelineLiveOutput(state, payload({
      type: 'gate_waiting',
      request: {
        gateId: 'gate-1',
        sessionId: 'session-1',
        node: 'reviewer',
        iteration: 0,
        createdAt: 3,
      },
      createdAt: 3,
    }))

    expect(hasPipelineLiveOutputNode(state, 'session-1', 'reviewer')).toBe(false)
  })
})

describe('applyPipelineStreamState', () => {
  test('node_complete 会把结构化阶段产物写入快照', () => {
    const state = applyPipelineStreamState({
      sessionId: 'session-1',
      currentNode: 'planner',
      status: 'running',
      reviewIteration: 0,
      pendingGate: null,
      updatedAt: 1,
    }, payload({
      type: 'node_complete',
      node: 'planner',
      output: '{"summary":"计划完成"}',
      summary: '计划完成',
      artifact: {
        node: 'planner',
        summary: '计划完成',
        steps: ['补测试'],
        risks: [],
        verification: ['bun test'],
        content: '{"summary":"计划完成"}',
      },
      createdAt: 2,
    }))

    expect(state?.stageOutputs?.planner?.summary).toBe('计划完成')
    expect(state?.updatedAt).toBe(2)
  })

  test('gate_waiting 会把已有快照的 reviewer 轮次同步为 gate iteration', () => {
    const state = applyPipelineStreamState({
      sessionId: 'session-1',
      currentNode: 'reviewer',
      status: 'running',
      reviewIteration: 2,
      pendingGate: null,
      updatedAt: 1,
    }, payload({
      type: 'gate_waiting',
      request: {
        gateId: 'gate-review-limit',
        sessionId: 'session-1',
        node: 'reviewer',
        kind: 'review_iteration_limit',
        iteration: 3,
        createdAt: 2,
      },
      createdAt: 2,
    }))

    expect(state?.reviewIteration).toBe(3)
    expect(state?.pendingGate?.iteration).toBe(3)
  })

  test('stream error 会把已有快照落为失败态并清理 pending gate', () => {
    const state = applyPipelineStreamErrorState({
      sessionId: 'session-1',
      currentNode: 'developer',
      status: 'waiting_human',
      reviewIteration: 1,
      pendingGate: {
        gateId: 'gate-1',
        sessionId: 'session-1',
        node: 'developer',
        iteration: 1,
        createdAt: 1,
      },
      updatedAt: 1,
    }, {
      sessionId: 'session-1',
      error: '启动失败',
    }, 3)

    expect(state).toMatchObject({
      sessionId: 'session-1',
      currentNode: 'developer',
      status: 'node_failed',
      pendingGate: null,
      updatedAt: 3,
    })
  })
})

describe('pipelineSessionIndicatorMapAtom', () => {
  test('等待人工、失败和完成状态映射到侧边栏 indicator', () => {
    const store = createStore()
    const stateMap = new Map<string, PipelineStateSnapshot>([
      ['running', {
        sessionId: 'running',
        currentNode: 'developer',
        status: 'running',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      }],
      ['waiting', {
        sessionId: 'waiting',
        currentNode: 'reviewer',
        status: 'waiting_human',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      }],
      ['failed', {
        sessionId: 'failed',
        currentNode: 'tester',
        status: 'node_failed',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      }],
      ['completed', {
        sessionId: 'completed',
        currentNode: 'committer',
        status: 'completed',
        reviewIteration: 0,
        pendingGate: null,
        updatedAt: 1,
      }],
    ])
    store.set(pipelineSessionStateMapAtom, stateMap)

    expect(Object.fromEntries(store.get(pipelineSessionIndicatorMapAtom))).toEqual({
      running: 'running',
      waiting: 'blocked',
      failed: 'failed',
      completed: 'completed',
    })
  })
})
