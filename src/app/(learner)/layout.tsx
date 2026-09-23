import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";

// The shell lives here (not in each page) so the header and nav stay mounted
// across client navigations instead of being torn down and rebuilt per page.
export default async function LearnerLayout({ children }: LayoutProps<"/">) {
  const session = await requireRole("LEARNER");
  // Read the name from the DB rather than the JWT so a rename in Settings
  // shows up without re-signing in.
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  return (
    <AppShell roleLabel="Learner" userName={user?.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      {children}
    </AppShell>
  );
}
