import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { getDictionary } from "@/i18n/server";

// The shell lives here (not in each page) so the header and nav stay mounted
// across client navigations instead of being torn down and rebuilt per page.
export default async function LearnerLayout({ children }: LayoutProps<"/">) {
  const session = await requireRole("LEARNER");
  // Read the name from the DB rather than the JWT so a rename in Settings
  // shows up without re-signing in.
  const [user, { locale, t }] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    getDictionary(),
  ]);
  return (
    <AppShell
      roleLabel={t.shell.learner}
      userName={user?.name ?? session.user.email ?? "Officer"}
      nav={<LearnerNav labels={t.learnerNav} />}
      locale={locale}
      labels={{ signOut: t.shell.signOut, language: t.shell.language }}
    >
      {children}
    </AppShell>
  );
}
