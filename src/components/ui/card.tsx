import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-[16px] overflow-hidden rounded-[20px] bg-[color:var(--color-surface-1)] text-[15px] leading-[24px] text-card-foreground shadow-[var(--shadow-card)] border border-[color:var(--color-border-resting)] p-[24px] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[color:var(--color-surface-2)] hover:border-[color:var(--color-border-hover)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[1px] focus-within:ring-[1px] focus-within:ring-[color:var(--color-accent)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:p-[16px] data-[size=sm]:rounded-[16px]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-header" className={cn("group/card-header @container/card-header grid auto-rows-min items-start gap-[8px]", className)} {...props} />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-[20px] leading-[28px] font-semibold tracking-normal", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-[15px] leading-[24px] text-muted-foreground", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-action" className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-footer" className={cn("flex items-center border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/50 -mx-[24px] -mb-[24px] mt-[8px] px-[24px] py-[16px]", className)} {...props} />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
