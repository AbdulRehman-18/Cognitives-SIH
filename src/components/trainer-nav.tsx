"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
const links = [
  { href: "/trainer", label: "Overview" },
  { href: "/trainer/documents", label: "Documents" },
  { href: "/trainer/assessments", label: "Assessments" },
  { href: "/trainer/questions", label: "Review" },
  { href: "/trainer/learners", label: "Learners" },
];
export function TrainerNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border px-6 py-2">
      {links.map(l => {
        const active = path === l.href || (l.href !== "/trainer" && path.startsWith(l.href));
        return <Link key={l.href} href={l.href} className={cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{l.label}</Link>
      })}
    </nav>
  );
}
