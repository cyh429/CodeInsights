import * as React from 'react'
import type { PipelineGateRequest, PipelineVersion } from '@codeinsights/shared'
import { AlertTriangle, CheckCircle2, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildPipelineGateViewModel } from './pipeline-display-model'

export function PipelineGateCard({
  request,
  onRespond,
  version,
}: {
  request: PipelineGateRequest
  onRespond: (action: 'approve' | 'reject_with_feedback' | 'rerun_node', feedback?: string) => Promise<void>
  version?: PipelineVersion
}): React.ReactElement {
  const [feedback, setFeedback] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submittedGateId, setSubmittedGateId] = React.useState<string | null>(null)
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const viewModel = buildPipelineGateViewModel(request, { version })
  const locked = submitting || submittedGateId === request.gateId
  const highRisk = request.kind === 'remote_write_confirmation' || request.kind === 'test_blocked'

  React.useEffect(() => {
    setSubmittedGateId(null)
    setSubmitting(false)
    setSubmitError(null)
    setFeedbackError(null)
  }, [request.gateId])

  const handleSubmit = async (
    action: 'approve' | 'reject_with_feedback' | 'rerun_node',
  ): Promise<void> => {
    if (locked) return

    const trimmedFeedback = feedback.trim()
    if (action === 'reject_with_feedback' && viewModel.rejectRequiresFeedback && !trimmedFeedback) {
      setFeedbackError('请填写需要修改的具体反馈。')
      return
    }

    setSubmitting(true)
    setFeedbackError(null)
    setSubmitError(null)
    try {
      await onRespond(action, trimmedFeedback || undefined)
      setSubmittedGateId(request.gateId)
      if (action !== 'approve') {
        setFeedback('')
      }
    } catch (error) {
      console.error('[PipelineGateCard] 响应审核失败:', error)
      setSubmitError(error instanceof Error ? error.message : '提交审核失败，请稍后重试。')
      setSubmittedGateId(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-label="Pipeline 人工审核操作区"
      className={cn(
        'rounded-panel border px-4 py-4 shadow-card',
        highRisk
          ? 'border-status-danger-border bg-status-danger-bg text-text-primary'
          : 'border-status-waiting-border bg-status-waiting-bg text-text-primary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cn(
            'flex items-center gap-2 text-xs font-semibold tracking-[0.16em]',
            highRisk ? 'text-status-danger-fg' : 'text-status-waiting-fg',
          )}>
            {highRisk ? <AlertTriangle size={14} /> : <Send size={14} />}
            审核面板
          </div>
          <div className="mt-1 text-base font-semibold text-text-primary">
            {viewModel.title}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            {viewModel.primaryActionHint}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <div className={cn(
            'rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold',
            highRisk
              ? 'border-status-danger-border text-status-danger-fg'
              : 'border-status-waiting-border text-status-waiting-fg',
          )}>
            {viewModel.priorityLabel}
          </div>
          <div className="text-xs text-text-tertiary">
            {viewModel.iterationLabel}
          </div>
        </div>
      </div>
      {viewModel.summary ? (
        <p className="mt-3 rounded-card bg-background/80 px-3 py-2 text-sm leading-6 text-text-primary">
          {viewModel.summary}
        </p>
      ) : null}
      {highRisk ? (
        <div className="mt-3 rounded-card border border-status-danger-border bg-background/75 px-3 py-2 text-sm leading-6 text-status-danger-fg">
          当前审核会影响测试阻塞或远端写入，请确认风险、目标分支和证据后再继续。
        </div>
      ) : null}
      <label
        htmlFor={`pipeline-gate-feedback-${request.gateId}`}
        className={cn(
          'mt-4 block text-xs font-semibold',
          highRisk ? 'text-status-danger-fg' : 'text-status-waiting-fg',
        )}
      >
        反馈
      </label>
      <textarea
        id={`pipeline-gate-feedback-${request.gateId}`}
        value={feedback}
        onChange={(event) => {
          setFeedback(event.target.value)
          if (feedbackError) setFeedbackError(null)
          if (submitError) setSubmitError(null)
        }}
        placeholder={viewModel.feedbackPlaceholder}
        className={cn(
          'mt-2 min-h-24 w-full rounded-card border bg-background px-3 py-3 text-sm text-text-primary outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-focus',
          highRisk ? 'border-status-danger-border' : 'border-status-waiting-border',
        )}
      />
      {feedbackError ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {feedbackError}
        </div>
      ) : null}
      {submitError ? (
        <div className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {submitError}
        </div>
      ) : null}
      {submittedGateId === request.gateId ? (
        <div className="mt-2 text-xs text-text-secondary">
          已提交审核响应，正在等待 Pipeline 恢复。
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={locked}
          onClick={() => void handleSubmit('approve')}
          className="bg-status-success text-white hover:bg-status-success/90"
        >
          <CheckCircle2 size={15} />
          {locked ? '处理中' : viewModel.approveLabel}
        </Button>
        <Button
          type="button"
          disabled={locked}
          onClick={() => void handleSubmit('reject_with_feedback')}
          variant={highRisk ? 'destructive' : 'secondary'}
        >
          {viewModel.rejectLabel}
        </Button>
        <Button
          type="button"
          disabled={locked}
          onClick={() => void handleSubmit('rerun_node')}
          variant="outline"
        >
          <RotateCcw size={15} />
          {viewModel.rerunLabel}
        </Button>
      </div>
    </section>
  )
}
