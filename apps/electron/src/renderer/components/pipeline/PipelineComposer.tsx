import * as React from 'react'
import type { PipelineSessionStatus } from '@codeinsights/shared'
import { Activity, Play, Rocket, Square, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PipelineComposerNoticeTone = 'neutral' | 'danger'

interface PipelineComposerNotice {
  tone: PipelineComposerNoticeTone
  message: string
}

interface PipelineComposerViewModelInput {
  disabled: boolean
  currentTask?: string
  stopping: boolean
  status?: PipelineSessionStatus | null
  stopError?: string | null
}

export interface PipelineComposerViewModel {
  currentTaskLabel: string
  stopButtonLabel: string
  stopButtonDisabled: boolean
  notice: PipelineComposerNotice | null
}

export interface PipelineComposerSubmitResult {
  started: boolean
}

export function shouldClearPipelineComposerInput(result: PipelineComposerSubmitResult): boolean {
  return result.started
}

export function buildPipelineComposerViewModel({
  currentTask,
  stopping,
  status,
  stopError,
}: PipelineComposerViewModelInput): PipelineComposerViewModel {
  let notice: PipelineComposerNotice | null = null

  if (stopping) {
    notice = {
      tone: 'neutral',
      message: '正在停止当前 Pipeline...',
    }
  } else if (stopError) {
    notice = {
      tone: 'danger',
      message: stopError,
    }
  } else if (status === 'terminated') {
    notice = {
      tone: 'neutral',
      message: 'Pipeline 已停止运行，可以调整任务后重新启动。',
    }
  }

  return {
    currentTaskLabel: currentTask || 'Pipeline 正在运行',
    stopButtonLabel: stopping ? '正在停止...' : '停止运行',
    stopButtonDisabled: stopping,
    notice,
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误'
}

function PipelineComposerNoticeLine({
  notice,
}: {
  notice: PipelineComposerNotice
}): React.ReactElement {
  const toneClass = notice.tone === 'danger'
    ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
    : 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-panel border px-3 py-2 text-sm leading-5 shadow-sm ${toneClass}`}
    >
      {notice.message}
    </div>
  )
}

export function PipelineComposer({
  disabled,
  startDisabled = false,
  currentTask,
  status,
  onSubmit,
  onStop,
}: {
  disabled: boolean
  startDisabled?: boolean
  currentTask?: string
  status?: PipelineSessionStatus | null
  onSubmit: (input: string) => Promise<PipelineComposerSubmitResult>
  onStop: () => Promise<void>
}): React.ReactElement {
  const [value, setValue] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [stopping, setStopping] = React.useState(false)
  const [stopError, setStopError] = React.useState<string | null>(null)
  const viewModel = buildPipelineComposerViewModel({
    disabled,
    currentTask,
    stopping,
    status,
    stopError,
  })

  const handleSubmit = async (): Promise<void> => {
    const input = value.trim()
    if (!input) return
    setSubmitting(true)
    try {
      const result = await onSubmit(input)
      if (shouldClearPipelineComposerInput(result)) {
        setValue('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    setStopping(true)
    setStopError(null)
    try {
      await onStop()
    } catch (error) {
      setStopError(`停止 Pipeline 失败: ${formatUnknownError(error)}`)
    } finally {
      setStopping(false)
    }
  }

  if (disabled) {
    return (
      <section className="pipeline-command-strip pipeline-glow-card relative overflow-hidden rounded-panel border border-status-running-border/80 bg-surface-card/92 px-4 py-4 shadow-panel backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--status-running)/0.10),transparent_28%)]" aria-hidden="true" />
        <div className="pipeline-command-strip__scan" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="pipeline-command-beacon mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-card border border-status-running-border bg-status-running-bg text-status-running-fg shadow-[0_0_28px_hsl(var(--status-running)/0.20)]">
              <SquareTerminal size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-status-running-border/70 bg-status-running-bg/80 px-2.5 py-1 text-xs font-semibold text-status-running-fg">
                  <Activity size={13} className="pipeline-command-dot" aria-hidden="true" />
                  当前任务
                </span>
                <span className="rounded-full border border-border-subtle/60 bg-background/55 px-2.5 py-1 text-xs font-medium text-text-secondary">
                  Agent Workbench
                </span>
              </div>
              <div className="mt-3 max-h-28 overflow-auto break-words rounded-card border border-border-subtle/60 bg-background/72 px-4 py-3 text-base font-semibold leading-7 text-text-primary shadow-inner [overflow-wrap:anywhere]">
                {viewModel.currentTaskLabel}
              </div>
              {viewModel.notice ? (
                <PipelineComposerNoticeLine notice={viewModel.notice} />
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            disabled={viewModel.stopButtonDisabled}
            onClick={() => void handleStop()}
            variant="outline"
            className="min-h-11 flex-shrink-0 border-status-danger-border bg-status-danger-bg px-4 text-status-danger-fg shadow-[0_0_22px_hsl(var(--status-danger)/0.14)] hover:bg-status-danger-bg"
          >
            <Square size={15} />
            {viewModel.stopButtonLabel}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="pipeline-glow-card rounded-panel border border-border-subtle/70 bg-surface-card/92 px-4 py-4 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-text-tertiary">
            <Rocket size={14} className="text-status-running-fg" aria-hidden="true" />
            发射台
          </div>
          <label htmlFor="pipeline-task-input" className="mt-1 block text-sm font-semibold text-text-primary">
            Pipeline 任务
          </label>
        </div>
        <span className="rounded-full border border-border-subtle/60 bg-surface-muted/70 px-2.5 py-1 text-xs font-medium text-text-secondary">
          等待输入
        </span>
      </div>
      {viewModel.notice ? (
        <PipelineComposerNoticeLine notice={viewModel.notice} />
      ) : null}
      <textarea
        id="pipeline-task-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入要交给 CodeInsights Pipeline 的任务"
        className="mt-3 min-h-36 w-full resize-y rounded-panel border border-border-subtle/70 bg-background/70 px-3 py-3 text-sm leading-6 text-text-primary shadow-inner outline-none transition-[border-color,box-shadow,background-color] duration-normal placeholder:text-text-tertiary focus:border-status-running-border focus:bg-background/85 focus:ring-2 focus:ring-focus"
      />
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={disabled || startDisabled || submitting}
          onClick={() => void handleSubmit()}
          loading={submitting}
          loadingLabel="正在启动 Pipeline"
          className="min-h-10 bg-status-running text-white shadow-[0_0_24px_hsl(var(--status-running)/0.28)] hover:bg-status-running/90"
        >
          <Play size={15} />
          启动 Pipeline
        </Button>
      </div>
    </section>
  )
}
