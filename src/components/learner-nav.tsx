"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import type { Dictionary } from "@/i18n/dictionaries";

type NavLabels = Dictionary["learnerNav"];

const TABS: { key: keyof NavLabels; href: string }[] = [
  { key: "overview", href: "/dashboard" },
  { key: "gaps", href: "/gaps" },
  { key: "path", href: "/path" },
  { key: "tutor", href: "/tutor" },
  { key: "lab", href: "/lab" },
  { key: "profile", href: "/profile" },
];

const DEFAULT_LABELS: NavLabels = { overview: "Overview", gaps: "Gap Report", path: "Learning Path", tutor: "Tutor", lab: "Lab", profile: "Profile", settings: "Settings" };

export function LearnerNav({ labels = DEFAULT_LABELS }: { labels?: NavLabels }) {
  const pathname = usePathname();
  // Assessments run in a focused, nav-free mode.
  if (pathname === "/assessment" || pathname?.startsWith("/assessment/")) return null;
  return (
    <nav className="flex items-center gap-[4px] border-b border-[color:var(--color-border-resting)] px-[16px] lg:px-[32px] overflow-x-auto" aria-label="Learner navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap rounded-full px-[14px] py-[7px] my-[8px] text-small font-medium transition-colors duration-[120ms]",
              active ? "bg-[color:var(--color-accent)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--color-surface-1)]"
            )}
          >
            {labels[tab.key]}
          </Link>
        );
      })}
      <Link href="/settings" className={cn("ml-auto hidden md:inline-flex rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[6px] text-[12px] font-medium text-muted-foreground hover:text-foreground", pathname === "/settings" ? "bg-foreground text-white border-transparent" : "")}>{labels.settings}</Link>
    </nav>
  );
}
