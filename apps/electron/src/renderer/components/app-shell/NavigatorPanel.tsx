/**
 * NavigatorPanel - Middle panel for list-based navigation
 * Displays a header with title and scrollable content area
 */

import * as React from 'react'
import { Panel } from './Panel'
import { PanelHeader } from './PanelHeader'

export interface NavigatorPanelProps {
  /** Panel title */
  title: string
  /** Panel width in pixels */
  width: number
  /** Main content */
  children: React.ReactNode
}

export function NavigatorPanel({
  title,
  width,
  children,
}: NavigatorPanelProps): React.ReactElement {
  return (
    <Panel variant="shrink" width={width} className="navigator-panel-shell">
      <PanelHeader title={title} />
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {children}
      </div>
    </Panel>
  )
}
