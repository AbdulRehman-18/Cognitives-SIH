"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/dashboard" },
  { label: "Gap Report", href: "/gaps" },
  { label: "Learning Path", href: "/path" },
  { label: "Tutor", href: "/tutor" },
  { label: "Profile", href: "/profile" },
] as const;

export function LearnerNav() {
  const pathname = usePathname();
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
            {tab.label}
          </Link>
        );
      })}
      <Link href="/settings" className={cn("ml-auto hidden md:inline-flex rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[6px] text-[12px] font-medium text-muted-foreground hover:text-foreground", pathname === "/settings" ? "bg-foreground text-white border-transparent" : "")}>Settings</Link>
    </nav>
  );
}
