import type {
  PipelineGateRequest,
  PipelineGateResponse,
} from '@codeinsights/shared'

interface PendingPipelineGate {
  request: PipelineGateRequest
  resolve: (response: PipelineGateResponse) => void
}

/**
 * Pipeline 人工审核服务
 *
 * 使用 Promise + Map 保存待审批请求，支持应用重载后恢复 UI。
 */
export class PipelineHumanGateService {
  private pendingRequests = new Map<string, PendingPipelineGate>()

  waitForDecision(
    sessionId: string,
    request: PipelineGateRequest,
    signal?: AbortSignal,
  ): Promise<PipelineGateResponse> {
    return new Promise<PipelineGateResponse>((resolve) => {
      this.pendingRequests.set(request.gateId, {
        request: {
          ...request,
          sessionId,
        },
        resolve,
      })

      signal?.addEventListener('abort', () => {
        if (!this.pendingRequests.has(request.gateId)) return

        this.pendingRequests.delete(request.gateId)
        resolve({
          gateId: request.gateId,
          sessionId,
          action: 'reject_with_feedback',
          feedback: '操作已中止',
          createdAt: Date.now(),
        })
      }, { once: true })
    })
  }

  respond(response: PipelineGateResponse): boolean {
    const pending = this.pendingRequests.get(response.gateId)
    if (!pending) return false
    if (pending.request.sessionId !== response.sessionId) return false

    pending.resolve(response)
    this.pendingRequests.delete(response.gateId)
    return true
  }

  getPendingRequests(): PipelineGateRequest[] {
    return [...this.pendingRequests.values()].map((item) => item.request)
  }

  clearSessionPending(sessionId: string): void {
    for (const [gateId, pending] of this.pendingRequests.entries()) {
      if (pending.request.sessionId !== sessionId) continue

      pending.resolve({
        gateId,
        sessionId,
        action: 'reject_with_feedback',
        feedback: '会话已结束',
        createdAt: Date.now(),
      })
      this.pendingRequests.delete(gateId)
    }
  }
}
