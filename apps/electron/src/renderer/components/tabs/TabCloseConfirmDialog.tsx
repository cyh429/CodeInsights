/**
 * TabCloseConfirmDialog — 运行中 Tab 关闭时的确认对话框
 *
 * 单例：在 TabBar 内渲染一次即可。
 * 状态通过 pendingCloseTabIdAtom 驱动，任何调用 useCloseTab().requestClose()
 * 的地方在 Agent / Pipeline 流式中都会触发此对话框。
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { tabsAtom } from '@/atoms/tab-atoms'
import { pendingCloseTabIdAtom, useCloseTab } from '@/hooks/useCloseTab'
import { buildTabCloseConfirmCopy } from './tab-close-confirm-model'

export function TabCloseConfirmDialog(): React.ReactElement {
  const [pendingId, setPendingId] = useAtom(pendingCloseTabIdAtom)
  const tabs = useAtomValue(tabsAtom)
  const { executeClose } = useCloseTab()

  const pendingTab = pendingId
    ? tabs.find((t) => t.id === pendingId)
    : undefined
  const copy = buildTabCloseConfirmCopy(pendingTab)

  const handleConfirm = (): void => {
    if (pendingId) executeClose(pendingId)
    setPendingId(null)
  }

  return (
    <AlertDialog
      open={pendingId !== null}
      onOpenChange={(open) => {
        if (!open) setPendingId(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{copy.description}</p>
              <p>确认关闭吗？</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {copy.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
