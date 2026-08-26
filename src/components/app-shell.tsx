import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export function AppShell({
  roleLabel,
  userName,
  nav,
  children,
}: {
  roleLabel: string;
  userName: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-[color:var(--color-canvas)]">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border-resting)] px-[20px] lg:px-[64px] py-[12px]">
        <Link href="/" className="flex items-center gap-[12px]">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
            <line x1="2" y1="10" x2="18" y2="10" stroke="var(--color-accent)" strokeWidth="1.5" />
            <line x1="5" y1="4" x2="5" y2="16" stroke="var(--color-accent)" strokeWidth="1.5" />
            <line x1="14" y1="6" x2="14" y2="14" stroke="var(--color-accent)" strokeWidth="1.5" />
          </svg>
          <span className="text-small font-semibold tracking-tight text-foreground">
            SkillForge AI
          </span>
        </Link>
        <div className="flex items-center gap-[16px]">
          <span className="text-small text-muted-foreground">
            {userName} · <span className="uppercase tracking-[0.08em]">{roleLabel}</span>
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      {nav}
      <main className="flex-1">{children}</main>
    </div>
  );
}
