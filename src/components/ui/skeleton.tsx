import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[6px] bg-[color:var(--color-border-resting)]", className)}
      style={{ animation: "gauge-pulse 1.4s ease-in-out infinite" } as React.CSSProperties}
      {...props}
    />
  )
}

export { Skeleton }
