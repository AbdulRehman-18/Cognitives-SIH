import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <line x1="2" y1="10" x2="18" y2="10" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="5" y1="4" x2="5" y2="16" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="14" y1="6" x2="14" y2="14" stroke="var(--color-target)" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            SkillForge AI
          </span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}

