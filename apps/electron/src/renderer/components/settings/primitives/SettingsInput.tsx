/**
 * SettingsInput - 设置文本输入控件
 *
 * 封装 ShadcnUI Input，集成标签和描述。
 * 支持错误状态提示。
 */

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { LABEL_CLASS, DESCRIPTION_CLASS } from './SettingsUIConstants'
import { cn } from '@/lib/utils'

interface SettingsInputProps {
  /** 标签文本 */
  label: string
  /** 描述文本（可选） */
  description?: string
  /** 输入值 */
  value: string
  /** 变更回调 */
  onChange: (value: string) => void
  /** 失焦回调（可选，用于延迟保存场景） */
  onBlur?: () => void
  /** 占位符 */
  placeholder?: string
  /** 是否必填 */
  required?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 错误信息（可选） */
  error?: string
  /** 输入类型 */
  type?: string
}

export function SettingsInput({
  label,
  description,
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  disabled,
  error,
  type = 'text',
}: SettingsInputProps): React.ReactElement {
  const id = React.useId()
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="px-4 py-3 space-y-2">
      <div>
        <label className={LABEL_CLASS} htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-status-danger-fg">*</span>}
        </label>
        {description && (
          <div id={descriptionId} className={cn(DESCRIPTION_CLASS, 'mt-0.5 break-words')}>{description}</div>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(error && 'border-status-danger-border focus-visible:ring-status-danger')}
      />
      {error && (
        <p id={errorId} className="text-xs text-status-danger-fg">{error}</p>
      )}
    </div>
  )
}
