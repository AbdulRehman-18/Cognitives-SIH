import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export default async function AdminDepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("ADMIN");
  const { id } = await params;

  const department = await db.department.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });
  if (!department) notFound();

  const users = await db.user.findMany({
    where: { departmentId: id, role: "LEARNER" },
    select: {
      id: true,
      name: true,
      email: true,
      jobRole: { select: { id: true, name: true } },
      skillGaps: {
        select: { severity: true, gapSize: true, competency: { select: { name: true } } },
      },
    },
  });

  // Department → role → users → top flagged gaps.
  const roleMap = new Map<
    string,
    { id: string; name: string; users: typeof users }
  >();
  for (const u of users) {
    const roleKey = u.jobRole?.id ?? "unassigned";
    const roleName = u.jobRole?.name ?? "No role assigned";
    if (!roleMap.has(roleKey)) roleMap.set(roleKey, { id: roleKey, name: roleName, users: [] });
    roleMap.get(roleKey)!.users.push(u);
  }
  const roles = Array.from(roleMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <Link href="/admin/departments" className="text-xs text-muted-foreground hover:text-foreground">← All departments</Link>
          <h1 className="mt-1 text-2xl font-semibold">{department.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {department.description ?? "Department → role → skill drill-down."} · {users.length} learners
          </p>
        </div>

        {roles.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No learners are assigned to this department yet.
          </div>
        ) : (
          roles.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.name}</CardTitle>
                <CardDescription>{r.users.length} officer{r.users.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {r.users.map((u) => {
                    const topGaps = [...u.skillGaps]
                      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.gapSize - a.gapSize)
                      .slice(0, 3);
                    return (
                      <li key={u.id} className="rounded-md border border-border px-4 py-3">
                        <p className="text-sm font-medium">{u.name ?? u.email}</p>
                        {topGaps.length === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">No flagged gaps.</p>
                        ) : (
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {topGaps.map((g, i) => (
                              <li key={i} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{g.competency.name}</span>
                                <span className={g.severity === "CRITICAL" ? "tabular-mono text-[color:var(--color-critical)]" : "tabular-mono text-muted-foreground"}>
                                  {g.severity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
