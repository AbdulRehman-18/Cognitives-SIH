"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/admin/overview" },
  { label: "Departments", href: "/admin/departments" },
  { label: "Roles", href: "/admin/roles" },
  { label: "Shortages", href: "/admin/shortages" },
  { label: "Profile", href: "/admin/profile" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-[4px] border-b border-[color:var(--color-border-resting)] px-[16px] lg:px-[32px] overflow-x-auto" aria-label="Admin navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-full px-[14px] py-[7px] my-[8px] text-small font-medium transition", active ? "bg-[color:var(--color-accent)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--color-surface-1)]")}>
            {tab.label}
          </Link>
        );
      })}
      <Link href="/admin/settings" className={cn("ml-auto hidden md:inline-flex rounded-full border px-[12px] py-[6px] text-[12px] font-medium", pathname === "/admin/settings" ? "bg-foreground text-white border-transparent" : "border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] text-muted-foreground hover:text-foreground")}>Settings</Link>
    </nav>
  );
}
