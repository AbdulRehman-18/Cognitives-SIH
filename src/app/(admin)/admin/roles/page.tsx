import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminRolesPage() {
  const session = await requireRole("ADMIN");

  const roles = await db.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { roleCompetencies: true, users: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seeded target competency vectors per role. Select a role to see its full vector.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>All roles</CardTitle></CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No roles have been seeded yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {roles.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/roles/${r.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        {r.description ? <p className="text-xs text-muted-foreground">{r.description}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="tabular-mono text-sm">{r._count.roleCompetencies} competencies</p>
                        <p className="tabular-mono text-xs text-muted-foreground">{r._count.users} officers</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
