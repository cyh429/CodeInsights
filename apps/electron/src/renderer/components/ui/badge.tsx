import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-[22px] items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-border-subtle bg-surface-muted text-text-secondary hover:bg-surface-muted/80",
        destructive:
          "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
        outline: "border-border-subtle text-text-secondary",
        running:
          "border-status-running-border bg-status-running-bg text-status-running-fg",
        waiting:
          "border-status-waiting-border bg-status-waiting-bg text-status-waiting-fg",
        success:
          "border-status-success-border bg-status-success-bg text-status-success-fg",
        danger:
          "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
        neutral:
          "border-status-neutral-border bg-status-neutral-bg text-status-neutral-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
