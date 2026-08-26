import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminOverviewPage() {
  const session = await requireRole("ADMIN");

  const [departments, gapsByDept, criticalGaps, userCount] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true } }),
    db.skillGap.groupBy({ by: ["severity"], _count: true }),
    db.skillGap.findMany({ where: { severity: "CRITICAL" }, take: 10, include: { competency: { select: { name: true } }, user: { select: { name: true, email: true } } } }),
    db.user.count({ where: { role: "LEARNER" } }),
  ]);

  // Dept-level gap counts
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
          <h1 className="text-2xl font-semibold">Workforce intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organization → department → role → skill · Aggregate, visually distinct from personal data.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle className="tabular-mono text-2xl">{userCount}</CardTitle><CardDescription>Learners</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="tabular-mono text-2xl">{gapsByDept.reduce((a, g) => a + g._count, 0)}</CardTitle><CardDescription>Total gaps</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="tabular-mono text-2xl text-[color:var(--color-critical)]">{criticalGaps.length}</CardTitle><CardDescription>Critical gaps</CardDescription></CardHeader></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Department breakdown</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {deptGaps.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                  <div><p className="text-sm font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.learnerCount} learners</p></div>
                  <div className="text-right"><p className="tabular-mono text-sm">{d.gapCount} gaps</p><p className="tabular-mono text-xs text-[color:var(--color-critical)]">{d.criticalCount} critical</p></div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {criticalGaps.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Critical shortages</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1">
                {criticalGaps.map((g) => (
                  <li key={g.id} className="flex justify-between text-sm"><span>{g.user.name ?? g.user.email} — {g.competency.name}</span><span className="text-[color:var(--color-critical)]">CRITICAL</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">Predictive workforce analytics is P2 / out of scope.</p>
      </div>
    </AppShell>
  );
}
