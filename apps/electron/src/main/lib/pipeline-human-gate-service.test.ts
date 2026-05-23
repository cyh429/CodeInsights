import { test, expect } from 'bun:test'
import { PipelineHumanGateService } from './pipeline-human-gate-service'

test('发起 gate 后可等待并接收 approve 响应', async () => {
  const service = new PipelineHumanGateService()
  const promise = service.waitForDecision('session-1', {
    gateId: 'gate-1',
    sessionId: 'session-1',
    node: 'planner',
    iteration: 0,
    createdAt: Date.now(),
  })

  service.respond({
    gateId: 'gate-1',
    sessionId: 'session-1',
    action: 'approve',
    createdAt: Date.now(),
  })

  const result = await promise
  expect(result.action).toBe('approve')
})

test('abort 后会安全清理 pending gate', async () => {
  const service = new PipelineHumanGateService()
  const controller = new AbortController()
  const promise = service.waitForDecision(
    'session-2',
    {
      gateId: 'gate-2',
      sessionId: 'session-2',
      node: 'reviewer',
      iteration: 1,
      createdAt: Date.now(),
    },
    controller.signal,
  )

  controller.abort()

  const result = await promise
  expect(result.action).toBe('reject_with_feedback')
  expect(service.getPendingRequests()).toHaveLength(0)
})
