import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

function ShortageColumns({ items }: { items: { name: string; domain: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="overflow-x-auto -mx-[8px] px-[8px]">
      <div className="flex items-end gap-[12px] min-w-[560px] h-[168px] pb-[8px] pt-[12px]">
        {items.map((it) => {
          const h = (it.count / max) * 108 + 28;
          return (
            <div key={it.name} className="flex-1 min-w-[84px] flex flex-col items-center gap-[6px]">
              <span className="num text-[12px] font-bold tabular-mono">{it.count}</span>
              <div className="w-full relative flex justify-center" style={{ height: h }}>
                <div className="absolute bottom-0 w-full max-w-[56px] rounded-t-[8px] border border-[#FECACA] bg-[#FFF6F5] overflow-hidden">
                  <div className="w-full" style={{ height: "100%", background: "linear-gradient(to top, #F04438, #FFD6D0)" }} />
                </div>
              </div>
              <span className="text-[11px] font-medium leading-tight text-center min-h-[26px] flex items-center justify-center max-w-[88px]">{it.name}</span>
              <span className="text-[10px] tabular-mono text-muted-foreground">{it.domain.split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AdminShortagesPage() {
  const session = await requireRole("ADMIN");
  const criticalGaps = await db.skillGap.findMany({ where: { severity: "CRITICAL" }, select: { id: true, user: { select: { name: true, email: true, department: { select: { name: true } } } }, competency: { select: { name: true, domain: { select: { name: true } } } } } });
  const byComp = new Map<string, { name: string; domain: string; count: number; deptCounts: Map<string, number> }>();
  for (const g of criticalGaps) {
    const k = g.competency.name;
    if (!byComp.has(k)) byComp.set(k, { name: k, domain: g.competency.domain.name, count: 0, deptCounts: new Map() });
    const e = byComp.get(k)!; e.count += 1;
    const dn = g.user.department?.name ?? "Unassigned"; e.deptCounts.set(dn, (e.deptCounts.get(dn) ?? 0) + 1);
  }
  const shortages = Array.from(byComp.values()).sort((a, b) => b.count - a.count);

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Workforce shortages</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">Where the workforce is most exposed — competencies with the most officers critically gapped, each broken down into its department flow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
          <div className="rounded-[16px] border border-[#FECACA] bg-[#FFF1F0] p-[18px] flex flex-col gap-[6px]">
            <p className="num text-[30px] font-[700] leading-none text-[#C9190B]">{criticalGaps.length}</p>
            <p className="text-[12px] font-semibold tracking-[0.06em] uppercase text-[#6B6560]">Critical gaps — org wide</p>
            <div className="flex gap-[3px] mt-[6px]">{Array.from({ length: Math.min(criticalGaps.length, 16) }).map((_, i) => <span key={i} className="size-[8px] rounded-full bg-[#F04438] border border-[#FFD6D0]" />)}</div>
          </div>
          <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
            <p className="num text-[30px] font-[700] leading-none">{shortages.length}</p>
            <p className="text-[12px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Competencies hit</p>
            <p className="text-[13px] text-muted-foreground mt-[4px]">Distinct bottlenecks to schedule.</p>
          </div>
          <div className="rounded-[16px] bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] p-[18px] flex flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-60">Peak exposure</p>
            <p className="text-[16px] font-semibold leading-tight mt-[6px] truncate">{shortages[0]?.name ?? "—"}</p>
            <p className="text-[12px] opacity-70 mt-[2px]">{shortages[0] ? `${shortages[0].count} officers · ${shortages[0].domain}` : "No exposure"}</p>
          </div>
        </div>

        {shortages.length ? (
          <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
            <h2 className="text-[16px] font-[650]">Exposure columns</h2>
            <p className="text-[13px] text-muted-foreground mt-[2px]">Height shows officers critically gapped. Side-scroll on mobile.</p>
            <div className="mt-[16px] rounded-[12px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[10px]">
              <ShortageColumns items={shortages.slice(0, 8).map((s) => ({ name: s.name, domain: s.domain, count: s.count }))} />
            </div>
          </section>
        ) : null}

        <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
          <h2 className="text-[16px] font-[650]">Shortages by competency — department flow</h2>
          {shortages.length === 0 ? (
            <p className="text-[14px] text-muted-foreground mt-[10px] rounded-[12px] border border-dashed px-[14px] py-[16px] text-center bg-[color:var(--color-surface-1)]">No critical gaps recorded.</p>
          ) : (
            <div className="mt-[14px] flex flex-col gap-[10px]">
              {shortages.map((s) => {
                const depts = Array.from(s.deptCounts.entries()).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={s.name} className="rounded-[14px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[14px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
                      <div>
                        <p className="text-[14px] font-semibold">{s.name}</p>
                        <p className="text-[12px] text-muted-foreground">{s.domain}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#F04438] text-white px-[10px] py-[4px] text-[11px] font-bold tracking-wide">{s.count} critical</span>
                    </div>
                    <div className="mt-[12px] flex items-center gap-[8px] overflow-x-auto pb-[2px] scrollbar-thin">
                      <span className="shrink-0 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[12px] py-[6px] text-[12px] font-semibold">{s.name}</span>
                      <span className="shrink-0 text-muted-foreground">→</span>
                      <div className="flex items-center gap-[8px] shrink-0">
                        {depts.map(([dn, c]) => (
                          <span key={dn} className="inline-flex items-center gap-[6px] rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[6px] text-[12px] tabular-mono shadow-sm">
                            <span className="size-2 rounded-full bg-[#F04438]" />{dn}: <b>{c}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
