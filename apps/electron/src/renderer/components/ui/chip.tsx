import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-control border px-2 py-1 text-xs leading-none text-text-secondary shadow-sm transition-colors duration-fast",
  {
    variants: {
      variant: {
        default: "border-border-subtle bg-surface-muted/70",
        model: "border-primary/20 bg-primary/10 text-primary",
        file: "border-border-subtle bg-surface-card",
        path: "border-border-subtle bg-surface-muted/70 font-mono tabular-nums",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  )
)
Chip.displayName = "Chip"

export { Chip, chipVariants }
