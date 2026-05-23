import * as React from 'react'
import type { PipelineSessionMeta, PipelineStateSnapshot } from '@codeinsights/shared'
import { Activity, GitBranch, Radar, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildPipelineHeaderViewModel, type PipelineDisplayTone } from './pipeline-display-model'

const STATUS_TONE_CLASS: Record<PipelineDisplayTone, string> = {
  neutral: 'border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg',
  running: 'border-status-running-border bg-status-running-bg text-status-running-fg pipeline-status-pulse',
  waiting: 'border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg',
  failed: 'border-status-danger-border bg-status-danger-bg text-status-danger-fg',
  success: 'border-status-success-border bg-status-success-bg text-status-success-fg',
}

const STATUS_DOT_CLASS: Record<PipelineDisplayTone, string> = {
  neutral: 'bg-status-neutral',
  running: 'bg-status-running shadow-[0_0_18px_hsl(var(--status-running)/0.75)]',
  waiting: 'bg-status-waiting shadow-[0_0_18px_hsl(var(--status-waiting)/0.65)]',
  failed: 'bg-status-danger shadow-[0_0_18px_hsl(var(--status-danger)/0.65)]',
  success: 'bg-status-success shadow-[0_0_18px_hsl(var(--status-success)/0.65)]',
}

export function PipelineHeader({
  session,
  state,
}: {
  session: PipelineSessionMeta | null
  state: PipelineStateSnapshot | null
}): React.ReactElement {
  const viewModel = buildPipelineHeaderViewModel({ session, state })

  return (
    <section className="pipeline-glow-card pipeline-shell-grid relative overflow-hidden rounded-panel border border-border-subtle/70 bg-surface-card/90 text-text-primary shadow-panel backdrop-blur">
      <div className="pipeline-scanline pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--status-running)/0.08),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--status-success)/0.06),transparent_28%)]" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
              <Radar size={13} className="text-status-running-fg" aria-hidden="true" />
              {viewModel.eyebrow}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/70 bg-surface-muted/70 px-2.5 py-1 text-xs font-medium text-text-secondary shadow-sm backdrop-blur">
              <GitBranch size={12} className="text-status-running-fg" aria-hidden="true" />
              当前节点：{viewModel.nodeLabel}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border-subtle/60 bg-background/55 px-3 py-1.5 shadow-sm backdrop-blur">
              <Activity size={14} className="text-status-running-fg" aria-hidden="true" />
              {viewModel.summary}
            </span>
            {viewModel.metaItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border-subtle/60 bg-surface-muted/65 px-2.5 py-1 text-xs font-medium text-text-secondary"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 rounded-card border border-border-subtle/60 bg-background/45 p-3 shadow-card backdrop-blur lg:min-w-[230px]">
          <div
            className={cn(
              'inline-flex items-center justify-between gap-3 rounded-full border px-3 py-1.5 text-sm font-semibold',
              STATUS_TONE_CLASS[viewModel.statusTone],
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span className={cn('size-2.5 rounded-full', STATUS_DOT_CLASS[viewModel.statusTone])} aria-hidden="true" />
              {viewModel.statusLabel}
            </span>
            <ShieldCheck size={15} aria-hidden="true" />
          </div>
          <div className="text-xs leading-5 text-text-tertiary">
            进度和人工审核状态会同步到下方阶段轨。
          </div>
        </div>
      </div>
    </section>
  )
}
