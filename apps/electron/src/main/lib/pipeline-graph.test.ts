import { describe, expect, test } from 'bun:test'
import { MemorySaver } from '@langchain/langgraph'
import { createPipelineGraph, createPipelineGraphV2 } from './pipeline-graph'

describe('pipeline-graph', () => {
  test('reviewer 首次拒绝后仍进入 reviewer gate，人工驳回后回到 developer 并再次审核', async () => {
    let reviewerCount = 0

    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        if (node === 'reviewer') {
          reviewerCount += 1
          if (reviewerCount === 1) {
            return {
              output: '缺少测试',
              summary: '缺少测试',
              approved: false,
              issues: ['缺少测试'],
            }
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const first = await graph.invoke({
      sessionId: 'session-review-loop',
      userInput: '请修复 pipeline',
    })
    expect(first.interrupted?.node).toBe('explorer')

    const second = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: first.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'approve',
        createdAt: Date.now(),
      },
    })
    expect(second.interrupted?.node).toBe('planner')

    const third = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: second.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(third.interrupted?.node).toBe('reviewer')
    expect(third.state.reviewIteration).toBe(0)
    expect(third.state.currentNode).toBe('reviewer')

    const fourth = await graph.resume({
      sessionId: 'session-review-loop',
      response: {
        gateId: third.interrupted!.gateId,
        sessionId: 'session-review-loop',
        action: 'reject_with_feedback',
        feedback: '请补测试',
        createdAt: Date.now(),
      },
    })

    expect(fourth.interrupted?.node).toBe('reviewer')
    expect(fourth.state.reviewIteration).toBe(1)
    expect(fourth.state.currentNode).toBe('reviewer')
  })

  test('tester 审核通过后进入 completed', async () => {
    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node) => ({
        output: `${node}-ok`,
        summary: `${node}-ok`,
        approved: true,
      }),
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-complete',
      userInput: '请完成任务',
    })

    const plannerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const reviewerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const testerPause = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: reviewerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const completed = await graph.resume({
      sessionId: 'session-complete',
      response: {
        gateId: testerPause.interrupted!.gateId,
        sessionId: 'session-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(completed.interrupted).toBeUndefined()
    expect(completed.state.status).toBe('completed')
    expect(completed.state.lastApprovedNode).toBe('tester')
  })

  test('v2 tester 审核通过后进入 committer，committer 审核通过后 completed', async () => {
    const nodes: string[] = []
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        nodes.push(node)
        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-complete',
      userInput: '请完成 v2 任务',
    })

    expect(explorerPause.interrupted?.kind).toBe('task_selection')

    const plannerPause = await graph.resume({
      sessionId: 'session-v2-complete',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-complete',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })

    expect(plannerPause.interrupted?.kind).toBe('document_review')

    const developerPause = await graph.resume({
      sessionId: 'session-v2-complete',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(developerPause.interrupted?.node).toBe('developer')
    expect(developerPause.interrupted?.kind).toBe('document_review')

    const testerPause = await graph.resume({
      sessionId: 'session-v2-complete',
      response: {
        gateId: developerPause.interrupted!.gateId,
        sessionId: 'session-v2-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(testerPause.interrupted?.node).toBe('tester')

    const committerPause = await graph.resume({
      sessionId: 'session-v2-complete',
      response: {
        gateId: testerPause.interrupted!.gateId,
        sessionId: 'session-v2-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(committerPause.interrupted?.node).toBe('committer')
    expect(committerPause.interrupted?.kind).toBe('submission_review')
    expect(committerPause.state.currentNode).toBe('committer')
    expect(committerPause.state.lastApprovedNode).toBe('tester')
    expect(committerPause.state.status).toBe('waiting_human')

    const completed = await graph.resume({
      sessionId: 'session-v2-complete',
      response: {
        gateId: committerPause.interrupted!.gateId,
        sessionId: 'session-v2-complete',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(completed.interrupted).toBeUndefined()
    expect(completed.state.version).toBe(2)
    expect(completed.state.status).toBe('completed')
    expect(completed.state.currentNode).toBe('committer')
    expect(completed.state.lastApprovedNode).toBe('committer')
    expect(nodes).toEqual(['explorer', 'planner', 'developer', 'reviewer', 'tester', 'committer'])
  })

  test('v2 tester 遇到环境阻塞时进入 test_blocked gate，接受风险后进入 committer', async () => {
    const nodes: string[] = []
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        nodes.push(node)
        if (node === 'tester') {
          return {
            output: '缺少 Bun，无法执行测试',
            summary: '测试环境阻塞',
            approved: false,
            issues: ['缺少 Bun'],
            stageOutput: {
              node: 'tester',
              summary: '测试环境阻塞',
              commands: ['bun test'],
              results: [],
              blockers: ['缺少 Bun'],
              passed: false,
              content: '缺少 Bun，无法执行测试',
            },
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-test-blocked',
      userInput: '请完成 v2 任务',
    })
    const plannerPause = await graph.resume({
      sessionId: 'session-v2-test-blocked',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-blocked',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })
    const developerPause = await graph.resume({
      sessionId: 'session-v2-test-blocked',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-blocked',
        action: 'approve',
        createdAt: Date.now(),
      },
    })
    const testerBlocked = await graph.resume({
      sessionId: 'session-v2-test-blocked',
      response: {
        gateId: developerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-blocked',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(testerBlocked.interrupted).toMatchObject({
      node: 'tester',
      kind: 'test_blocked',
    })
    expect(testerBlocked.state.currentNode).toBe('tester')
    expect(testerBlocked.state.status).toBe('waiting_human')

    const committerPause = await graph.resume({
      sessionId: 'session-v2-test-blocked',
      response: {
        gateId: testerBlocked.interrupted!.gateId,
        sessionId: 'session-v2-test-blocked',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(committerPause.interrupted).toMatchObject({
      node: 'committer',
      kind: 'submission_review',
    })
    expect(committerPause.state.lastApprovedNode).toBe('tester')
    expect(nodes).toEqual(['explorer', 'planner', 'developer', 'reviewer', 'tester', 'committer'])
  })

  test('v2 tester 存在失败测试证据时进入 test_blocked gate', async () => {
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        if (node === 'tester') {
          return {
            output: '测试证据失败',
            summary: '测试证据失败',
            approved: false,
            issues: ['bun test failed'],
            stageOutput: {
              node: 'tester',
              summary: '测试证据失败',
              commands: ['bun test'],
              results: ['失败'],
              blockers: [],
              passed: true,
              testEvidence: [
                {
                  command: 'bun test',
                  status: 'failed',
                  summary: '失败',
                },
              ],
              content: '测试证据失败',
            },
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-test-evidence-failed',
      userInput: '请完成 v2 任务',
    })
    const plannerPause = await graph.resume({
      sessionId: 'session-v2-test-evidence-failed',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-evidence-failed',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })
    const developerPause = await graph.resume({
      sessionId: 'session-v2-test-evidence-failed',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-evidence-failed',
        action: 'approve',
        createdAt: Date.now(),
      },
    })
    const testerBlocked = await graph.resume({
      sessionId: 'session-v2-test-evidence-failed',
      response: {
        gateId: developerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-evidence-failed',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(testerBlocked.interrupted).toMatchObject({
      node: 'tester',
      kind: 'test_blocked',
    })
  })

  test('v2 tester 结果被要求修订时带反馈回到 developer', async () => {
    const nodes: string[] = []
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        nodes.push(node)
        if (node === 'tester') {
          return {
            output: '测试失败',
            summary: '测试失败',
            approved: false,
            issues: ['缺少回归测试'],
            stageOutput: {
              node: 'tester',
              summary: '测试失败',
              commands: ['bun test'],
              results: ['回归测试失败'],
              blockers: [],
              passed: false,
              content: '测试失败',
            },
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-test-reject',
      userInput: '请完成 v2 任务',
    })
    const plannerPause = await graph.resume({
      sessionId: 'session-v2-test-reject',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-reject',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })
    const developerPause = await graph.resume({
      sessionId: 'session-v2-test-reject',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-reject',
        action: 'approve',
        createdAt: Date.now(),
      },
    })
    const testerBlocked = await graph.resume({
      sessionId: 'session-v2-test-reject',
      response: {
        gateId: developerPause.interrupted!.gateId,
        sessionId: 'session-v2-test-reject',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(testerBlocked.interrupted).toMatchObject({
      node: 'tester',
      kind: 'test_blocked',
    })

    const developerRevision = await graph.resume({
      sessionId: 'session-v2-test-reject',
      response: {
        gateId: testerBlocked.interrupted!.gateId,
        sessionId: 'session-v2-test-reject',
        action: 'reject_with_feedback',
        feedback: '请补上失败用例并修复实现',
        createdAt: Date.now(),
      },
    })

    expect(developerRevision.interrupted).toMatchObject({
      node: 'developer',
      kind: 'document_review',
    })
    expect(developerRevision.state.currentNode).toBe('developer')
    expect(developerRevision.state.status).toBe('waiting_human')
    expect(nodes).toEqual(['explorer', 'planner', 'developer', 'reviewer', 'tester', 'developer'])
  })

  test('v2 developer 完成后先进入文档审核 gate，用户接受后才运行 reviewer', async () => {
    const nodes: string[] = []
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        nodes.push(node)
        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-dev-gate',
      userInput: '请完成 Phase 4',
    })
    const plannerPause = await graph.resume({
      sessionId: 'session-v2-dev-gate',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-dev-gate',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })
    const developerPause = await graph.resume({
      sessionId: 'session-v2-dev-gate',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-dev-gate',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(nodes).toEqual(['explorer', 'planner', 'developer'])
    expect(developerPause.interrupted).toMatchObject({
      node: 'developer',
      kind: 'document_review',
    })
    expect(developerPause.state.currentNode).toBe('developer')
    expect(developerPause.state.status).toBe('waiting_human')

    const testerPause = await graph.resume({
      sessionId: 'session-v2-dev-gate',
      response: {
        gateId: developerPause.interrupted!.gateId,
        sessionId: 'session-v2-dev-gate',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(nodes).toEqual(['explorer', 'planner', 'developer', 'reviewer', 'tester'])
    expect(testerPause.interrupted?.node).toBe('tester')
    expect(testerPause.state.lastApprovedNode).toBe('reviewer')
  })

  test('v2 reviewer 不通过时未达上限自动回 developer，达到上限进入人工接管 gate', async () => {
    const nodes: string[] = []
    const graph = createPipelineGraphV2({
      checkpointer: new MemorySaver(),
      runNode: async (node) => {
        nodes.push(node)
        if (node === 'reviewer') {
          return {
            output: '需要返工',
            summary: '需要返工',
            approved: false,
            issues: ['缺少测试'],
            stageOutput: {
              node: 'reviewer',
              summary: '需要返工',
              approved: false,
              issues: ['缺少测试'],
              content: '需要返工',
            },
          }
        }
        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-v2-review-loop',
      userInput: '请完成 Phase 4',
    })
    const plannerPause = await graph.resume({
      sessionId: 'session-v2-review-loop',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-v2-review-loop',
        action: 'approve',
        selectedReportId: 'report-001',
        createdAt: Date.now(),
      },
    })

    let current = await graph.resume({
      sessionId: 'session-v2-review-loop',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-v2-review-loop',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      current = await graph.resume({
        sessionId: 'session-v2-review-loop',
        response: {
          gateId: current.interrupted!.gateId,
          sessionId: 'session-v2-review-loop',
          action: 'approve',
          createdAt: Date.now(),
        },
      })
    }

    expect(nodes).toEqual([
      'explorer',
      'planner',
      'developer',
      'reviewer',
      'developer',
      'reviewer',
      'developer',
      'reviewer',
    ])
    expect(current.interrupted).toMatchObject({
      node: 'reviewer',
      kind: 'review_iteration_limit',
      iteration: 3,
    })
    expect(current.state.currentNode).toBe('reviewer')
    expect(current.state.status).toBe('waiting_human')
    expect(current.state.reviewIteration).toBe(3)
  })

  test('getState 会从 checkpoint interrupt 回填 pendingGate', async () => {
    const checkpointer = new MemorySaver()
    const graph = createPipelineGraph({
      checkpointer,
      runNode: async (node) => ({
        output: `${node}-ok`,
        summary: `${node}-ok`,
        approved: true,
      }),
    })

    const interrupted = await graph.invoke({
      sessionId: 'session-state-gate',
      userInput: '请执行到人工审核',
    })

    const state = await graph.getState('session-state-gate')

    expect(interrupted.interrupted?.node).toBe('explorer')
    expect(state.status).toBe('waiting_human')
    expect(state.pendingGate).toMatchObject({
      gateId: interrupted.interrupted?.gateId,
      sessionId: 'session-state-gate',
      node: 'explorer',
    })
  })

  test('下游节点可以读取上游阶段产物，快照保留 stageOutputs', async () => {
    const developerContextSummaries: string[] = []

    const graph = createPipelineGraph({
      checkpointer: new MemorySaver(),
      runNode: async (node, context) => {
        if (node === 'developer') {
          developerContextSummaries.push(context.stageOutputs?.planner?.summary ?? '')
        }

        if (node === 'explorer') {
          return {
            output: '{"summary":"已定位入口"}',
            summary: '已定位入口',
            approved: true,
            stageOutput: {
              node: 'explorer',
              summary: '已定位入口',
              findings: ['入口在 PipelineView'],
              keyFiles: ['PipelineView.tsx'],
              nextSteps: ['制定计划'],
              content: '{"summary":"已定位入口"}',
            },
          }
        }

        if (node === 'planner') {
          return {
            output: '{"summary":"按三步实现"}',
            summary: '按三步实现',
            approved: true,
            stageOutput: {
              node: 'planner',
              summary: '按三步实现',
              steps: ['补测试', '改实现', '跑验证'],
              risks: ['状态回归'],
              verification: ['bun test'],
              content: '{"summary":"按三步实现"}',
            },
          }
        }

        return {
          output: `${node}-ok`,
          summary: `${node}-ok`,
          approved: true,
        }
      },
    })

    const explorerPause = await graph.invoke({
      sessionId: 'session-stage-output',
      userInput: '请实现结构化产物',
    })

    const plannerPause = await graph.resume({
      sessionId: 'session-stage-output',
      response: {
        gateId: explorerPause.interrupted!.gateId,
        sessionId: 'session-stage-output',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    const reviewerPause = await graph.resume({
      sessionId: 'session-stage-output',
      response: {
        gateId: plannerPause.interrupted!.gateId,
        sessionId: 'session-stage-output',
        action: 'approve',
        createdAt: Date.now(),
      },
    })

    expect(developerContextSummaries).toEqual(['按三步实现'])
    expect(reviewerPause.state.stageOutputs?.explorer?.summary).toBe('已定位入口')
    expect(reviewerPause.state.stageOutputs?.planner?.summary).toBe('按三步实现')
  })
})
