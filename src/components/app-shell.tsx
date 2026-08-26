import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export function AppShell({
  roleLabel,
  userName,
  children,
}: {
  roleLabel: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
            <line x1="2" y1="10" x2="18" y2="10" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="5" y1="4" x2="5" y2="16" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="14" y1="6" x2="14" y2="14" stroke="var(--color-target)" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SkillForge AI
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {userName} · <span className="uppercase">{roleLabel}</span>
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
