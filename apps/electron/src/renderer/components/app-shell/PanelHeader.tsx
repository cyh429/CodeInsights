/**
 * PanelHeader - Header component for panels
 * Displays title and optional action buttons
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PanelHeaderProps {
  /** Panel title */
  title: string
  /** Optional action buttons */
  actions?: React.ReactNode
  /** Optional className */
  className?: string
}

export function PanelHeader({ title, actions, className }: PanelHeaderProps): React.ReactElement {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-border-subtle/55 bg-background/35 px-4 py-3 backdrop-blur-sm', className)}>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-status-running-fg">Navigator</div>
        <h2 className="truncate text-[13px] font-semibold text-text-primary">{title}</h2>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
