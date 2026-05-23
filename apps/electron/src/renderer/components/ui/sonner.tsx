import { useAtomValue } from "jotai"
import { Toaster as Sonner } from "sonner"
import { resolvedThemeAtom } from "@/atoms/theme"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useAtomValue(resolvedThemeAtom)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={58}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-border-subtle group-[.toaster]:bg-surface-elevated group-[.toaster]:text-text-primary group-[.toaster]:shadow-card",
          description: "group-[.toast]:text-text-secondary",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-surface-muted group-[.toast]:text-text-secondary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
