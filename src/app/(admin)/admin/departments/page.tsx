import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDepartmentsPage() {
  const session = await requireRole("ADMIN");

  const departments = await db.department.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  // Same formula as admin/overview's deptGaps — do not diverge.
  const deptGaps = await Promise.all(
    departments.map(async (d) => {
      const users = await db.user.findMany({ where: { departmentId: d.id }, select: { id: true } });
      const ids = users.map((u) => u.id);
      const count = ids.length ? await db.skillGap.count({ where: { userId: { in: ids } } }) : 0;
      const critical = ids.length ? await db.skillGap.count({ where: { userId: { in: ids }, severity: "CRITICAL" } }) : 0;
      return { ...d, gapCount: count, criticalCount: critical, learnerCount: ids.length };
    }),
  );

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Org → department drill-down. Select a department to see its roles and officers.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>All departments</CardTitle></CardHeader>
          <CardContent>
            {deptGaps.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No departments have been created yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {deptGaps.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/admin/departments/${d.id}`}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.learnerCount} learners</p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-mono text-sm">{d.gapCount} gaps</p>
                        <p className="tabular-mono text-xs text-[color:var(--color-critical)]">{d.criticalCount} critical</p>
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
