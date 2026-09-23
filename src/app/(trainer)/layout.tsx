import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { TrainerNav } from "@/components/trainer-nav";

// The shell lives here (not in each page) so the header and nav stay mounted
// across client navigations instead of being torn down and rebuilt per page.
export default async function TrainerLayout({ children }: LayoutProps<"/">) {
  const session = await requireRole("TRAINER");

  return (
    <AppShell roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"} nav={<TrainerNav />}>
      {children}
    </AppShell>
  );
}
