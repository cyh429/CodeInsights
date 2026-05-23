/**
 * SettingsRow - 设置行布局
 *
 * 左侧显示标签和描述，右侧显示操作控件。
 * 通常用于 SettingsCard 内部。
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { LABEL_CLASS, DESCRIPTION_CLASS, ROW_CLASS } from './SettingsUIConstants'

interface SettingsRowProps {
  /** 行标签 */
  label: React.ReactNode
  /** 标签左侧图标（可选） */
  icon?: React.ReactNode
  /** 行描述（可选） */
  description?: string
  /** 行内状态或错误提示（可选） */
  feedback?: React.ReactNode
  /** 右侧控件 */
  children?: React.ReactNode
  /** 额外 className */
  className?: string
}

export function SettingsRow({
  label,
  icon,
  description,
  feedback,
  children,
  className,
}: SettingsRowProps): React.ReactElement {
  return (
    <div className={cn(ROW_CLASS, className)}>
      <div className="flex min-w-0 flex-1 items-start self-stretch sm:self-auto">
        {icon && <div className="mr-3 flex-shrink-0 pt-0.5">{icon}</div>}
        <div className="min-w-0 flex-1 sm:mr-4">
          <div className={LABEL_CLASS}>{label}</div>
          {description && (
            <div className={cn(DESCRIPTION_CLASS, 'mt-0.5 break-words')}>{description}</div>
          )}
          {feedback && <div className="mt-2">{feedback}</div>}
        </div>
      </div>
      {children && <div className="flex w-full flex-shrink-0 justify-start sm:w-auto sm:justify-end">{children}</div>}
    </div>
  )
}
