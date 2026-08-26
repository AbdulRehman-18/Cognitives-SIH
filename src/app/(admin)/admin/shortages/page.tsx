import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminShortagesPage() {
  const session = await requireRole("ADMIN");

  const criticalGaps = await db.skillGap.findMany({
    where: { severity: "CRITICAL" },
    select: {
      id: true,
      user: { select: { name: true, email: true, department: { select: { name: true } } } },
      competency: { select: { name: true, domain: { select: { name: true } } } },
    },
  });

  // Roll up by competency — the actionable workforce-shortage signal is
  // "which competencies have the most officers critically gapped on them",
  // not the individual gap rows already shown on the overview page.
  const byCompetency = new Map<
    string,
    { name: string; domain: string; count: number; deptCounts: Map<string, number> }
  >();
  for (const g of criticalGaps) {
    const key = g.competency.name;
    if (!byCompetency.has(key)) {
      byCompetency.set(key, { name: g.competency.name, domain: g.competency.domain.name, count: 0, deptCounts: new Map() });
    }
    const entry = byCompetency.get(key)!;
    entry.count += 1;
    const deptName = g.user.department?.name ?? "Unassigned";
    entry.deptCounts.set(deptName, (entry.deptCounts.get(deptName) ?? 0) + 1);
  }
  const shortages = Array.from(byCompetency.values()).sort((a, b) => b.count - a.count);

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold">Workforce shortages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the workforce is most exposed — competencies with the most officers critically gapped, broken down by department.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="tabular-mono text-2xl text-[color:var(--color-critical)]">{criticalGaps.length}</CardTitle>
              <CardDescription>Critical gaps, org-wide</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="tabular-mono text-2xl">{shortages.length}</CardTitle>
              <CardDescription>Distinct competencies affected</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Shortages by competency</CardTitle></CardHeader>
          <CardContent>
            {shortages.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No critical gaps recorded. The workforce is not critically exposed on any tracked competency.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {shortages.map((s) => {
                  const depts = Array.from(s.deptCounts.entries()).sort((a, b) => b[1] - a[1]);
                  return (
                    <li key={s.name} className="rounded-md border border-border px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.domain}</p>
                        </div>
                        <p className="tabular-mono text-sm text-[color:var(--color-critical)]">{s.count} officer{s.count === 1 ? "" : "s"} critical</p>
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {depts.map(([deptName, count]) => (
                          <li key={deptName} className="text-xs text-muted-foreground">
                            {deptName}: <span className="tabular-mono text-foreground">{count}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
