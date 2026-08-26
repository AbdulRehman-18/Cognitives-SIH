import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { StartOnboardingDiagnostic } from "./start-onboarding-diagnostic";

// PRD §5.4 — immediately after the 3-field onboarding form, before the
// officer ever sees a full dashboard, we diagnose the ONE competency their
// role weighs most heavily. This page picks that single competency
// server-side (deterministic — highest RoleCompetency.weight, never an LLM
// choice) and hands off to a client component that triggers generation and
// routes into the existing one-question-at-a-time AssessmentRunner.
export default async function OnboardingDiagnosticPage() {
  const session = await requireRole("LEARNER");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { roleId: true, jobRole: { select: { name: true } } },
  });

  // No role yet (shouldn't happen post-onboarding, but never dead-end) —
  // send back to the 3-field form rather than crashing.
  if (!user?.roleId) {
    redirect("/onboarding");
  }

  const topCompetency = await db.roleCompetency.findFirst({
    where: { roleId: user.roleId },
    orderBy: { weight: "desc" },
    include: { competency: { include: { domain: true } } },
  });

  // Role has no configured target vector at all — nothing to diagnose yet.
  // Don't dump the officer onto a full dashboard; still route them forward
  // through a single, honest next step.
  if (!topCompetency) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <line x1="2" y1="10" x2="18" y2="10" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="5" y1="4" x2="5" y2="16" stroke="var(--color-measure)" strokeWidth="1.5" />
            <line x1="14" y1="6" x2="14" y2="14" stroke="var(--color-target)" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-foreground">SkillForge AI</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <StartOnboardingDiagnostic
          competencyId={topCompetency.competencyId}
          competencyName={topCompetency.competency.name}
          domainName={topCompetency.competency.domain.name}
        />
      </main>
    </div>
  );
}
