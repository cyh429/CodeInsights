/**
 * Panel - Base container component for app panels
 * Provides consistent styling for panel containers
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface PanelProps {
  /** Panel sizing behavior */
  variant?: 'shrink' | 'grow'
  /** Fixed width in pixels (only for shrink variant) */
  width?: number
  /** Optional className for additional styling */
  className?: string
  /** Optional inline styles */
  style?: React.CSSProperties
  /** Panel content */
  children: React.ReactNode
}

/**
 * Base panel container with consistent styling
 */
export function Panel({
  variant = 'grow',
  width,
  className,
  style,
  children,
}: PanelProps): React.ReactElement {
  return (
    <div
      className={cn(
        'h-full flex min-w-0 flex-col overflow-hidden rounded-panel border border-border-subtle/60 bg-surface-panel/88 shadow-panel backdrop-blur-xl',
        variant === 'grow' && 'flex-1',
        variant === 'shrink' && 'shrink-0',
        className
      )}
      style={{
        ...(variant === 'shrink' && width ? { width } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
