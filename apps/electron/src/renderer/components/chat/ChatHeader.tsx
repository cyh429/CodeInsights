/**
 * ChatHeader - 对话头部
 *
 * 显示对话标题（可点击编辑）+ 置顶按钮 + 并排模式切换按钮。
 */

import * as React from 'react'
import { useSetAtom } from 'jotai'
import { Pencil, Check, X, Pin, Columns2 } from 'lucide-react'
import { conversationsAtom } from '@/atoms/chat-atoms'
import { useConversationParallelMode } from '@/hooks/useConversationSettings'
import type { ConversationMeta } from '@codeinsights/shared'
import { SystemPromptSelector } from './SystemPromptSelector'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  conversation: ConversationMeta | null
}

export function ChatHeader({ conversation }: ChatHeaderProps): React.ReactElement | null {
  const setConversations = useSetAtom(conversationsAtom)
  const [parallelMode, setParallelMode] = useConversationParallelMode()
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  if (!conversation) return null

  /** 进入编辑模式 */
  const startEdit = (): void => {
    setEditTitle(conversation.title)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  /** 保存标题 */
  const saveTitle = async (): Promise<void> => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === conversation.title) {
      setEditing(false)
      return
    }

    try {
      const updated = await window.electronAPI.updateConversationTitle(conversation.id, trimmed)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
    } catch (error) {
      console.error('[ChatHeader] 更新标题失败:', error)
    }
    setEditing(false)
  }

  /** 键盘事件 */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  return (
    <div className="chat-header-shell relative z-[51] mx-3 mt-3 flex min-h-[76px] items-center gap-3 rounded-panel border border-border-subtle/70 bg-surface-card/85 px-4 shadow-card backdrop-blur titlebar-drag-region md:mx-4 md:min-h-[84px] md:px-5">
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 titlebar-no-drag">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveTitle}
            className="flex-1 min-w-0 border-b border-primary/50 bg-transparent px-0 py-0.5 text-sm font-medium outline-none"
            maxLength={100}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={saveTitle}
            className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="保存标题"
            title="保存标题"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(false)}
            className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="取消编辑标题"
            title="取消编辑标题"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Conversation Deck</div>
            <span className="truncate text-[18px] font-semibold leading-6 text-text-primary md:text-[20px]">
              {conversation.title}
            </span>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={startEdit}
            className="titlebar-no-drag rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="编辑标题"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      )}

      {/* 右侧按钮组 */}
      <div className="ml-auto flex items-center gap-1.5 rounded-full border border-border-subtle/60 bg-background/45 px-1.5 py-1 shadow-sm backdrop-blur titlebar-no-drag">
        <SystemPromptSelector />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', conversation.pinned && 'bg-accent text-accent-foreground')}
              onClick={async () => {
                const updated = await window.electronAPI.togglePinConversation(conversation.id)
                setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
              }}
              aria-label={conversation.pinned ? '取消置顶对话' : '置顶对话'}
            >
              <Pin className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{conversation.pinned ? '取消置顶' : '置顶对话'}</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', parallelMode && 'bg-accent text-accent-foreground')}
              onClick={() => setParallelMode(!parallelMode)}
              aria-label={parallelMode ? '关闭并排模式' : '打开并排模式'}
            >
              <Columns2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{parallelMode ? '关闭并排模式' : '并排模式'}</p></TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
