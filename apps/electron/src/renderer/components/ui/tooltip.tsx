/**
 * Tooltip 工具提示组件
 *
 * 基于 Radix UI Tooltip 原语，
 * 用于鼠标悬停时显示额外信息。
 */

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = ({
  delayDuration = 400,
  skipDelayDuration = 150,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
    {...props}
  />
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // 深色毛玻璃效果：主题色调深色背景 + 模糊 + 高对比度文字
        "z-[100] overflow-hidden rounded-control px-2 py-1.5 text-xs",
        "bg-tooltip/90 text-tooltip-foreground backdrop-blur-md",
        "shadow-card",
        "animate-in fade-in-0 zoom-in-95 duration-fast",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        // 内部次要文字使用 tooltip-muted 颜色
        "[&_.text-muted-foreground]:text-tooltip-muted",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
