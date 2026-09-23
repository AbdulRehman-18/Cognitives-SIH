import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

// The shell lives here (not in each page) so the header and nav stay mounted
// across client navigations instead of being torn down and rebuilt per page.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const session = await requireRole("ADMIN");

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      {children}
    </AppShell>
  );
}
