import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { StartDiagnostic } from "@/app/(learner)/assessment/new/start-diagnostic";

// Entry point for "take a diagnostic assessment". The actual generation
// (LLM writes questions, engine will later score them) happens client-side
// against POST /api/assessments/generate so the user gets a real loading /
// error state (AiErrorState) instead of a route that can time out silently.
export default async function NewAssessmentPage() {
  const session = await requireRole("LEARNER");

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-16">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Start your diagnostic</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A short set of questions covering the competencies your role
            depends on most. There is no time pressure — answer at your own
            pace.
          </p>
        </div>
        <StartDiagnostic />
      </div>
    </AppShell>
  );
}
