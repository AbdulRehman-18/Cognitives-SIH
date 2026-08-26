import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { TutorChat } from "./tutor-chat";

export default async function TutorPage() {
  const session = await requireRole("LEARNER");
  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto flex max-w-3xl flex-col px-6 py-8">
        <h1 className="text-xl font-semibold tracking-tight">AI Tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grounded in your trainers&apos; uploaded course material. Out-of-scope questions are refused — never guessed.
        </p>
        <TutorChat />
      </div>
    </AppShell>
  );
}
