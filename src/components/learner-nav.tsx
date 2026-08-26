"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Priority 6 — top tab-based nav replacing the ad-hoc "click a card to find
// the next screen" pattern. Four tabs, matching the PRD's learner surface
// area exactly: Overview (dashboard), Gap Report, Learning Path, Tutor.
const TABS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Gap Report", href: "/gaps" },
  { label: "Learning Path", href: "/path" },
  { label: "Tutor", href: "/tutor" },
] as const;

export function LearnerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border px-6" aria-label="Learner navigation">
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
