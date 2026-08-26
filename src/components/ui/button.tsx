import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: transitions use token durations/easing; no hardcoded colors
  "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--color-accent)]/40 focus-visible:border-[color:var(--color-accent)] disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] active:scale-[0.98] active:duration-[80ms]",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--color-accent)] text-white border border-transparent shadow-[var(--shadow-cta)] hover:brightness-[1.06] hover:shadow-[0_0_0_1px_rgba(46,58,255,0.18),0_8px_24px_rgba(46,58,255,0.16)] rounded-full",
        outline:
          "border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] text-foreground hover:bg-[color:var(--color-surface-2)] hover:border-[color:var(--color-border-hover)] rounded-full",
        secondary:
          "bg-[color:var(--color-surface-1)] text-foreground border border-[color:var(--color-border-resting)] hover:bg-[color:var(--color-surface-2)] rounded-full",
        ghost:
          "bg-transparent text-foreground/70 hover:text-foreground hover:bg-[color:var(--color-surface-1)] border border-transparent rounded-full",
        destructive:
          "bg-[color:var(--color-critical)]/10 text-[color:var(--color-critical)] border border-transparent hover:bg-[color:var(--color-critical)]/16 rounded-full",
        link: "text-[color:var(--color-accent)] underline-offset-4 hover:underline border-transparent bg-transparent",
      },
      size: {
        default:
          "h-8 gap-[8px] px-4 rounded-full text-[13px] leading-[20px] font-medium has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-full px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-full px-3 text-[13px] leading-[20px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-[8px] px-5 rounded-full text-[15px] leading-[24px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-full",
        "icon-lg": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  // Lock width when loading to prevent layout shift — caller can still override via style
  const ref = React.useRef<HTMLButtonElement>(null)
  const [lockedWidth, setLockedWidth] = React.useState<number | undefined>(undefined)

  React.useLayoutEffect(() => {
    if (loading && ref.current && lockedWidth === undefined) {
      setLockedWidth(ref.current.getBoundingClientRect().width)
    }
    if (!loading && lockedWidth !== undefined) {
      setLockedWidth(undefined)
    }
  }, [loading, lockedWidth])

  const isDisabled = disabled || loading

  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      style={lockedWidth !== undefined ? { width: lockedWidth, ...style } as React.CSSProperties : style}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center" aria-hidden>
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
        </span>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
