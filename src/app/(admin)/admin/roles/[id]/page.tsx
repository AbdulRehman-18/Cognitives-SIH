import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AdminRoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("ADMIN");
  const { id } = await params;

  const role = await db.role.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { users: true } },
      roleCompetencies: {
        select: {
          requiredLevel: true,
          weight: true,
          competency: { select: { name: true, domain: { select: { name: true } } } },
        },
      },
    },
  });
  if (!role) notFound();

  // Group the target vector by domain, matching the org → department →
  // role → skill drill-down structure used elsewhere.
  const byDomain = new Map<string, typeof role.roleCompetencies>();
  for (const rc of role.roleCompetencies) {
    const domainName = rc.competency.domain.name;
    if (!byDomain.has(domainName)) byDomain.set(domainName, []);
    byDomain.get(domainName)!.push(rc);
  }
  const domains = Array.from(byDomain.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <Link href="/admin/roles" className="text-xs text-muted-foreground hover:text-foreground">← All roles</Link>
          <h1 className="mt-1 text-2xl font-semibold">{role.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role.description ?? "Target competency vector."} · {role._count.users} officers hold this role
          </p>
        </div>

        {domains.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            This role has no seeded target competencies yet.
          </div>
        ) : (
          domains.map(([domainName, competencies]) => (
            <Card key={domainName}>
              <CardHeader><CardTitle>{domainName}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 font-medium">Competency</th>
                      <th className="py-2 font-medium">Required level</th>
                      <th className="py-2 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competencies.map((rc, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2">{rc.competency.name}</td>
                        <td className="tabular-mono py-2">{rc.requiredLevel} / 5</td>
                        <td className="tabular-mono py-2">{Number(rc.weight).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
