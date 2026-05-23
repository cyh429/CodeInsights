import * as React from 'react'
import { cn } from '@/lib/utils'
import { LABEL_CLASS, DESCRIPTION_CLASS } from './SettingsUIConstants'

interface SettingsTextareaProps {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  error?: string
  className?: string
}

export function SettingsTextarea({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  error,
  className,
}: SettingsTextareaProps): React.ReactElement {
  const id = React.useId()
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="px-4 py-3 space-y-2">
      <div>
        <label className={LABEL_CLASS} htmlFor={id}>{label}</label>
        {description && (
          <div id={descriptionId} className={cn(DESCRIPTION_CLASS, 'mt-0.5 break-words')}>{description}</div>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono',
          error && 'border-status-danger-border focus-visible:ring-status-danger',
          className,
        )}
      />
      {error && <p id={errorId} className="text-xs text-status-danger-fg">{error}</p>}
    </div>
  )
}
