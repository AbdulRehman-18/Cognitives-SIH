"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/admin/overview" },
  { label: "Departments", href: "/admin/departments" },
  { label: "Roles", href: "/admin/roles" },
  { label: "Shortages", href: "/admin/shortages" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-[16px] border-b border-[color:var(--color-border-resting)] px-[20px] lg:px-[64px]" aria-label="Admin navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative px-[12px] py-[12px] text-small transition-colors duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
              active
                ? "text-foreground font-semibold opacity-100"
                : "text-muted-foreground opacity-60 hover:opacity-80 hover:text-foreground font-medium",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "absolute inset-x-[12px] bottom-0 h-[2px] rounded-full bg-[color:var(--color-accent)] transition-opacity duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                active ? "opacity-100" : "opacity-0"
              )}
              aria-hidden
            />
          </Link>
        );
      })}
    </nav>
  );
}
