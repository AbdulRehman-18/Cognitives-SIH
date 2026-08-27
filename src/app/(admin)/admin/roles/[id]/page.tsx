import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN");
  const { id } = await params;
  const role = await db.role.findUnique({ where: { id }, select: { id: true, name: true, description: true, _count: { select: { users: true } }, roleCompetencies: { select: { requiredLevel: true, weight: true, competency: { select: { name: true, domain: { select: { name: true } } } } } } } });
  if (!role) notFound();
  const byDomain = new Map<string, typeof role.roleCompetencies>();
  for (const rc of role.roleCompetencies) {
    const d = rc.competency.domain.name;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(rc);
  }
  const domains = Array.from(byDomain.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[960px]">
        <div>
          <Link href="/admin/roles" className="inline-flex rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[10px] py-[5px] text-[11px] font-medium hover:bg-white">← All roles</Link>
          <h1 className="mt-[12px] text-[24px] md:text-[28px] font-[650] tracking-[-0.03em]">{role.name}</h1>
          <p className="text-body text-muted-foreground mt-[4px]">{role.description ?? "Target competency vector."} · {role._count.users} officer{role._count.users !== 1 ? "s" : ""} hold this role</p>
          <div className="mt-[10px] flex flex-wrap gap-[8px] text-[11px] tabular-mono">
            <span className="rounded-full bg-[color:var(--color-accent)] text-white px-[10px] py-[5px] font-semibold">{role.roleCompetencies.length} competencies</span>
            <span className="rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[10px] py-[5px]">{domains.length} domains</span>
          </div>
        </div>

        {domains.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[14px] py-[16px] text-center text-small text-muted-foreground">No seeded competencies yet.</div>
        ) : (
          domains.map(([domainName, comps]) => (
            <div key={domainName} className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-[18px] py-[14px] bg-[color:var(--color-canvas)]/50 border-b border-[color:var(--color-border-resting)] flex items-center justify-between">
                <h2 className="text-small font-semibold">{domainName}</h2>
                <span className="rounded-full bg-white border border-[color:var(--color-border-resting)] px-[10px] py-[4px] text-[11px] tabular-mono">{comps.length} competencies</span>
              </div>
              <div className="divide-y divide-[color:var(--color-border-resting)]">
                <div className="hidden md:grid grid-cols-[1fr_140px_90px] gap-[12px] px-[18px] py-[8px] text-[11px] tracking-[0.06em] uppercase font-semibold text-muted-foreground bg-white">
                  <span>Competency</span><span>Required level</span><span className="text-right">Weight</span>
                </div>
                {comps
                  .sort((a, b) => Number(b.weight) - Number(a.weight))
                  .map((rc, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_140px_90px] gap-[8px] px-[18px] py-[12px] items-center hover:bg-white transition">
                      <span className="text-small font-medium">{rc.competency.name}</span>
                      <div className="flex items-center gap-[8px]">
                        <div className="flex gap-[3px]">
                          {[1, 2, 3, 4, 5].map((lv) => (
                            <span key={lv} className={`size-[10px] rounded-full border ${lv <= rc.requiredLevel ? "bg-[color:var(--color-accent)] border-[color:var(--color-accent)]" : "bg-white border-[color:var(--color-border-resting)]"}`} />
                          ))}
                        </div>
                        <span className="num text-[11px] tabular-mono text-muted-foreground">{rc.requiredLevel} / 5</span>
                      </div>
                      <span className="num text-[12px] tabular-mono font-semibold md:text-right"><span className={`inline-flex rounded-full px-[8px] py-[3px] text-[11px] border ${Number(rc.weight) >= 0.85 ? "bg-[color:var(--color-accent)] text-white border-transparent" : Number(rc.weight) >= 0.7 ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border-[color:var(--color-accent)]/20" : "bg-white border-[color:var(--color-border-resting)]"}`}>{Number(rc.weight).toFixed(2)}</span></span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
