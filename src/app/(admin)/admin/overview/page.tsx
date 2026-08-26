import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminOverviewPage() {
  const session = await requireRole("ADMIN");

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Organization overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Department → role → skill drill-down arrives in Phase 8.
          </p>
        </div>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Workforce readiness</CardTitle>
            <CardDescription>
              Aggregate domain coverage across departments will render here
              once the gap engine (Phase 3) is producing data.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </AppShell>
  );
}
