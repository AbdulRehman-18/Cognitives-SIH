import { requireRole } from "@/lib/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Full progressive-profiling flow (PRD §5.4) lands in a later phase. This
// placeholder exists so the sign-up -> onboarding redirect resolves to a
// real, role-protected page in Phase 1.
export default async function OnboardingPage() {
  await requireRole("LEARNER");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16">
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Welcome to SkillForge AI</CardTitle>
          <CardDescription>
            Onboarding (designation, department, job role) arrives in a later
            build phase. Your account is set up and protected routes are
            working.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
