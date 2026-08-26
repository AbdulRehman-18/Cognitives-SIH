"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-[16px] data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--color-surface-1)] rounded-[6px] p-[3px] border border-[color:var(--color-border-resting)]",
        line: "gap-[16px] bg-transparent rounded-none border-b border-[color:var(--color-border-resting)] w-full justify-start",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Inactive: Small 13/20/500 at 60% opacity
        // Hover: 80% opacity — 120ms micro
        // Active: 100% opacity, 2px accent underline, weight 600 — 200ms standard
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-[8px] rounded-[4px] border border-transparent px-3 py-1.5 text-[13px] leading-[20px] font-medium whitespace-nowrap opacity-60 transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-80 hover:text-foreground focus-visible:border-[color:var(--color-accent)] focus-visible:ring-[2px] focus-visible:ring-[color:var(--color-accent)]/30 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // Active state — full opacity + semibold + accent underline
        "data-active:opacity-100 data-active:font-semibold data-active:text-foreground data-active:duration-[200ms]",
        // Default variant active surface
        "group-data-[variant=default]/tabs-list:data-active:bg-[color:var(--color-surface-2)] group-data-[variant=default]/tabs-list:data-active:border-[color:var(--color-border-hover)]",
        // Line variant — transparent bg, accent underline (2px)
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "after:absolute after:bg-[color:var(--color-accent)] after:opacity-0 after:transition-opacity after:duration-[200ms] after:ease-[cubic-bezier(0.4,0,0.2,1)] group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-[2px] group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-[2px] group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-[15px] leading-[24px] outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
