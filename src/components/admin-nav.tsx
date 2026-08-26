"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Admin equivalent of LearnerNav — top tab-based nav for the org →
// department → role → skill drill-down surfaces (PRD §4.10).
const TABS = [
  { label: "Overview", href: "/admin/overview" },
  { label: "Departments", href: "/admin/departments" },
  { label: "Roles", href: "/admin/roles" },
  { label: "Shortages", href: "/admin/shortages" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border px-6" aria-label="Admin navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative px-3 py-3 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[color:var(--color-measure)]" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
