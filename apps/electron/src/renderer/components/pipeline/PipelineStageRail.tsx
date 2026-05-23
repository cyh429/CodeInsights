import * as React from 'react'
import type { PipelineNodeKind, PipelineStateSnapshot, PipelineVersion } from '@codeinsights/shared'
import {
  AlertCircle,
  Check,
  Circle,
  ClipboardList,
  Code2,
  FlaskConical,
  GitBranch,
  Loader2,
  PauseCircle,
  RadioTower,
  Search,
  Send,
  ShieldCheck,
  Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildPipelineStageViewModels, type PipelineStageVisualStatus } from './pipeline-display-model'

const STEP_TONE_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'border-status-success-border bg-status-success-bg text-status-success-fg',
  active: 'border-status-running-border bg-status-running-bg text-status-running-fg shadow-[0_0_24px_hsl(var(--status-running)/0.32)]',
  waiting: 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
  failed: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
  stopped: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  todo: 'border-border-subtle bg-surface-card text-text-tertiary',
}

const CONNECTOR_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'pipeline-stage-route-line pipeline-energy-line bg-status-success',
  active: 'pipeline-stage-route-line pipeline-energy-line bg-status-running',
  waiting: 'pipeline-stage-route-line bg-status-waiting',
  failed: 'pipeline-stage-route-line bg-status-danger',
  stopped: 'pipeline-stage-route-line bg-status-neutral',
  todo: 'pipeline-stage-route-line bg-border-subtle',
}

const STAGE_CARD_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'border-status-success-border bg-status-success-bg shadow-[0_0_20px_hsl(var(--status-success)/0.10)]',
  active: 'pipeline-stage-active pipeline-stage-route-active border-status-running-border bg-status-running-bg',
  waiting: 'border-status-waiting-border bg-status-waiting-bg shadow-[0_0_18px_hsl(var(--status-waiting)/0.12)]',
  failed: 'border-status-danger-border bg-status-danger-bg shadow-[0_0_18px_hsl(var(--status-danger)/0.12)]',
  stopped: 'border-status-neutral-border bg-status-neutral-bg/75',
  todo: 'border-border-subtle bg-surface-panel/42',
}

const NODE_TONE_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'border-status-success-border bg-status-success text-background shadow-[0_0_22px_hsl(var(--status-success)/0.26)]',
  active: 'pipeline-status-pulse border-status-running-border bg-status-running text-background shadow-[0_0_28px_hsl(var(--status-running)/0.42)]',
  waiting: 'border-status-waiting-border bg-status-waiting text-background shadow-[0_0_18px_hsl(var(--status-waiting)/0.22)]',
  failed: 'border-status-danger-border bg-status-danger text-background shadow-[0_0_18px_hsl(var(--status-danger)/0.24)]',
  stopped: 'border-status-neutral-border bg-status-neutral text-background',
  todo: 'border-border-subtle bg-surface-card text-text-tertiary',
}

const METER_CLASS: Record<PipelineStageVisualStatus, string> = {
  done: 'bg-status-success',
  active: 'pipeline-stage-route-meter bg-status-running',
  waiting: 'bg-status-waiting',
  failed: 'bg-status-danger',
  stopped: 'bg-status-neutral',
  todo: 'bg-border-subtle',
}

function StageIcon({ status }: { status: PipelineStageVisualStatus }): React.ReactElement {
  switch (status) {
    case 'done':
      return <Check size={14} />
    case 'active':
      return <Loader2 size={14} className="animate-spin" />
    case 'waiting':
      return <PauseCircle size={14} />
    case 'failed':
      return <AlertCircle size={14} />
    case 'stopped':
      return <Square size={12} />
    case 'todo':
    default:
      return <Circle size={10} />
  }
}

function NodeIcon({ node }: { node: PipelineNodeKind }): React.ReactElement {
  switch (node) {
    case 'explorer':
      return <Search size={15} />
    case 'planner':
      return <ClipboardList size={15} />
    case 'developer':
      return <Code2 size={15} />
    case 'reviewer':
      return <ShieldCheck size={15} />
    case 'tester':
      return <FlaskConical size={15} />
    case 'committer':
      return <Send size={15} />
    default:
      return <GitBranch size={15} />
  }
}

export function PipelineStageRail({
  onSelectStage,
  state,
  version,
}: {
  onSelectStage?: (node: PipelineNodeKind) => void
  state: PipelineStateSnapshot | null
  version?: PipelineVersion
}): React.ReactElement {
  const stages = buildPipelineStageViewModels(state, { version })

  return (
    <section className="pipeline-glow-card pipeline-stage-route-shell rounded-panel border border-border-subtle/70 bg-surface-card px-4 py-4 shadow-card">
      <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            <RadioTower size={13} className="text-status-running-fg" aria-hidden="true" />
            Mission Route
          </div>
          <h2 className="mt-1 text-base font-semibold text-text-primary">贡献工作流航线</h2>
        </div>
        <span className="rounded-full border border-border-subtle/60 bg-surface-muted/70 px-2.5 py-1 text-xs font-medium text-text-secondary">
          {stages.length} 个阶段
        </span>
      </div>
      <div className="relative z-10 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <div key={stage.node} className="relative min-w-0">
            {index > 0 ? (
              <div
                className={cn(
                  'absolute -left-3 top-[46px] hidden h-px w-3 transition-colors sm:block',
                  CONNECTOR_CLASS[stages[index - 1]?.status ?? 'todo'],
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.node)}
              aria-label={`定位${stage.ariaLabel}记录`}
              className={cn(
                'pipeline-stage-route-card group flex h-full min-h-[144px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-card border px-3.5 py-3.5 text-left outline-none transition-[background-color,border-color,box-shadow,transform] duration-normal hover:-translate-y-1 hover:border-primary/35 hover:bg-surface-muted/70 focus-visible:ring-2 focus-visible:ring-focus',
                STAGE_CARD_CLASS[stage.status],
              )}
            >
              <span className="pipeline-stage-route-grid" aria-hidden="true" />
              <span className="relative z-10 flex w-full items-start justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full border transition-colors',
                      NODE_TONE_CLASS[stage.status],
                    )}
                    aria-hidden="true"
                  >
                    <NodeIcon node={stage.node} />
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </span>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                    STEP_TONE_CLASS[stage.status],
                  )}
                  aria-hidden="true"
                >
                  <StageIcon status={stage.status} />
                </span>
              </span>
              <span className="relative z-10 min-w-0">
                <span className="block truncate text-base font-semibold text-text-primary">{stage.label}</span>
                <span className="mt-1 block truncate text-xs text-text-tertiary">贡献节点 · {stage.node}</span>
                <span
                  className={cn(
                    'mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                    STEP_TONE_CLASS[stage.status],
                  )}
                >
                  {stage.statusLabel}
                </span>
                <span className="mt-3 grid grid-cols-4 gap-1" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, meterIndex) => (
                    <span
                      key={`${stage.node}-${meterIndex}`}
                      className={cn(
                        'h-1 rounded-full opacity-40 transition-opacity group-hover:opacity-80',
                        meterIndex <= Math.min(index, 3) ? METER_CLASS[stage.status] : 'bg-border-subtle',
                      )}
                    />
                  ))}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
