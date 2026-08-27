import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import Link from "next/link";

function SeverityDonut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const size = 128, r = 46, sw = 14, cx = size / 2, cy = size / 2;
  return (
    <div className="flex items-center gap-[20px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {data.map((d, i) => {
          if (!d.value) return null;
          const frac = d.value / total;
          const start = (acc / total) * 360 - 90;
          const sweep = frac * 360;
          acc += d.value;
          const large = sweep > 180 ? 1 : 0;
          const a0 = (start * Math.PI) / 180, a1 = ((start + sweep) * Math.PI) / 180;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          return <path key={i} d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={d.color} strokeWidth={sw} strokeLinecap="round" />;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={20} fontWeight={700} fill="#141210" style={{ fontFamily: "var(--font-mono)" }}>{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fontWeight={600} letterSpacing={0.08} fill="#6B7280">GAPS</text>
      </svg>
      <div className="flex-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between py-[6px] border-b border-[color:var(--color-border-resting)] last:border-0">
            <span className="flex items-center gap-[8px] text-small"><span className="size-2.5 rounded-full" style={{ background: d.color }} />{d.label}</span>
            <span className="num text-small font-semibold tabular-mono">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeptColumns({ items }: { items: { name: string; gaps: number; crit: number; learners: number; trainers: number }[] }) {
  const max = Math.max(...items.map((i) => i.gaps), 1);
  return (
    <div className="overflow-x-auto -mx-[6px] px-[6px]">
      <div className="flex items-end gap-[12px] min-w-[520px] h-[176px] pb-[6px] pt-[8px]">
        {items.map((it) => {
          const h = (it.gaps / max) * 118 + 22;
          return (
            <div key={it.name} className="flex-1 min-w-[88px] flex flex-col items-center gap-[8px]">
              <span className="num text-[12px] font-semibold tabular-mono leading-none">{it.gaps}</span>
              <div className="w-full relative flex justify-center" style={{ height: h }}>
                <div className="absolute bottom-0 w-full max-w-[64px] rounded-t-[10px] border border-[color:var(--color-border-resting)] bg-white overflow-hidden flex flex-col justify-end">
                  <div className="w-full" style={{ height: `${(it.gaps / max) * 100}%`, background: it.crit ? "linear-gradient(to top, #F04438 0%, #FFD6D0 100%)" : "linear-gradient(to top, #2E3AFF 0%, #E0E3FF 100%)`".replace("`",""), borderTop: it.crit ? "2px solid #F04438" : "2px solid #2E3AFF" }} />
                </div>
              </div>
              <span className="text-[11px] font-medium leading-tight text-center min-h-[28px] flex items-center justify-center max-w-[96px]">{it.name.replace(" Division", "").replace(" & Innovation", "")}</span>
              <span className="text-[10px] tabular-mono text-muted-foreground">{it.learners}L · {it.trainers}T {it.crit ? `· ${it.crit} crit` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const session = await requireRole("ADMIN");
  const [departments, gapsBySeverity, criticalGaps, learnerCount, trainerCount, totalGaps, docCount, assessmentCount] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true } }),
    db.skillGap.groupBy({ by: ["severity"], _count: true }),
    db.skillGap.findMany({ where: { severity: "CRITICAL" }, take: 6, include: { competency: { select: { name: true } }, user: { select: { name: true, email: true } } } }),
    db.user.count({ where: { role: "LEARNER" } }),
    db.user.count({ where: { role: "TRAINER" } }),
    db.skillGap.count(),
    db.document.count(),
    db.assessment.count(),
  ]);

  const severityMap = new Map(gapsBySeverity.map((g) => [g.severity, g._count]));
  const donutData = [
    { label: "Critical", value: severityMap.get("CRITICAL") ?? 0, color: "#F04438" },
    { label: "High", value: severityMap.get("HIGH") ?? 0, color: "#EA6B1A" },
    { label: "Medium", value: severityMap.get("MEDIUM") ?? 0, color: "#E5A100" },
    { label: "Room to grow", value: severityMap.get("LOW") ?? 0, color: "#12B76A" },
  ];

  const deptStats = await Promise.all(
    departments.map(async (d) => {
      const users = await db.user.findMany({ where: { departmentId: d.id }, select: { id: true, role: true } });
      const learnerIds = users.filter((u) => u.role === "LEARNER").map((u) => u.id);
      const trainerIds = users.filter((u) => u.role === "TRAINER").map((u) => u.id);
      const [gapCount, crit] = learnerIds.length ? await Promise.all([db.skillGap.count({ where: { userId: { in: learnerIds } } }), db.skillGap.count({ where: { userId: { in: learnerIds }, severity: "CRITICAL" } })]) : [0, 0];
      return { ...d, gapCount, criticalCount: crit, learnerCount: learnerIds.length, trainerCount: trainerIds.length };
    }),
  );
  const sortedDepts = [...deptStats].sort((a, b) => b.gapCount - a.gapCount);

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto max-w-[1180px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[24px]">
        {/* Header — no kicker, heading carries weight */}
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Workforce intelligence</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">Aggregate view for the Training Manager — not personal scores. Follow the chain <span className="font-medium text-foreground">Organization → department → role → skill</span> to find where to deploy the next NSSTA or iGOT session.</p>
          <p className="text-[13px] text-muted-foreground mt-[8px]"><span className="font-medium text-foreground">{learnerCount} learners</span> and <span className="font-medium text-foreground">{trainerCount} trainers</span> · {docCount} course sources · {assessmentCount} assessments</p>
        </div>

        {/* Metrics ribbon — not cards, inline figures with dividers */}
        <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[color:var(--color-border-resting)] overflow-hidden">
          {[
            { v: learnerCount, l: "Learners", d: "active officers" },
            { v: trainerCount, l: "Trainers", d: `${docCount} docs` },
            { v: totalGaps, l: "Gaps flagged", d: `${(severityMap.get("CRITICAL") ?? 0)} critical` },
            { v: `${departments.length}`, l: "Divisions", d: "tracked" },
          ].map((k) => (
            <div key={k.l} className="flex-1 px-[20px] py-[16px] flex items-baseline justify-between md:flex-col md:items-start gap-[8px]">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">{k.l}</p>
                <p className="num text-[28px] font-[700] leading-none tracking-[-0.02em] mt-[4px]">{k.v}</p>
              </div>
              <p className="text-[12px] text-muted-foreground md:mt-[4px]">{k.d}</p>
            </div>
          ))}
        </div>

        {/* Main 12-col — exposure + severity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <section className="lg:col-span-8 rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
            <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
              <h2 className="text-[16px] font-[650] tracking-[-0.01em]">Exposure by department</h2>
              <Link href="/admin/departments" className="text-[13px] font-medium text-[color:var(--color-accent)] underline underline-offset-4">View all departments</Link>
            </div>
            <p className="text-[13px] text-muted-foreground mt-[4px]">Column height = total gaps; warm cap = critical share. Scroll sideways on mobile.</p>

            <div className="mt-[18px] rounded-[12px] border border-[color:var(--color-border-resting)] bg-[#FFFCF7] p-[12px]">
              <DeptColumns items={sortedDepts.map((d) => ({ name: d.name, gaps: d.gapCount, crit: d.criticalCount, learners: d.learnerCount, trainers: d.trainerCount }))} />
            </div>

            <div className="mt-[14px] flex flex-col gap-[8px]">
              {sortedDepts.slice(0, 4).map((d) => (
                <Link key={d.id} href={`/admin/departments/${d.id}`} className="flex items-center gap-[12px] py-[10px] border-t border-[color:var(--color-border-resting)] first:border-0 group">
                  <span className="flex-1 min-w-0 text-[14px] font-medium truncate group-hover:text-[color:var(--color-accent)]">{d.name}</span>
                  <span className="text-[13px] tabular-mono text-muted-foreground hidden sm:inline">{d.learnerCount} learners · {d.trainerCount} trainers</span>
                  <span className="num text-[13px] font-semibold tabular-mono">{d.gapCount} gaps</span>
                  <span className={`text-[11px] font-bold px-[8px] py-[3px] rounded-full ${d.criticalCount ? "bg-[#FFF1F0] text-[#C9190B] border border-[#FECACA]" : "bg-[#F0FDF4] text-[#0E7A4B] border border-[#BBF7D0]"}`}>{d.criticalCount ? `${d.criticalCount} crit` : "clear"}</span>
                  <span className="hidden md:inline text-muted-foreground group-hover:translate-x-[2px] transition">→</span>
                </Link>
              ))}
            </div>
          </section>

          <div className="lg:col-span-4 flex flex-col gap-[16px]">
            <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
              <h2 className="text-[16px] font-[650]">Severity mix</h2>
              <p className="text-[13px] text-muted-foreground mt-[2px]">Critical needs immediate faculty, Grow is close to target.</p>
              <div className="mt-[16px]">
                <SeverityDonut data={donutData} />
              </div>
              <p className="text-[12px] leading-relaxed mt-[14px] rounded-[10px] bg-[#FFFCF7] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">Trainers carry <b>{docCount}</b> grounded sources to close the <b className="text-[#C9190B]">{severityMap.get("CRITICAL") ?? 0} critical</b> gaps first.</p>
            </section>

            <section className="rounded-[16px] bg-[#141210] text-[#FFF8ED] p-[20px]">
              <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase opacity-70">How to use this page</h2>
              <p className="text-[14px] leading-[1.6] mt-[8px]">This is aggregate intelligence — no personal scores. Use the columns to spot which division needs an NSSTA batch, then drill into department → role → skill.</p>
              <Link href="/admin/shortages" className="mt-[14px] inline-flex rounded-full bg-white text-[#141210] px-[14px] py-[8px] text-[13px] font-semibold">See shortages →</Link>
            </section>
          </div>
        </div>

        <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px]">
          <div className="flex items-baseline justify-between gap-[8px]">
            <h2 className="text-[16px] font-[650]">Critical exposure — who, where</h2>
            <span className="text-[12px] tabular-mono text-muted-foreground">{criticalGaps.length} officers</span>
          </div>
          {criticalGaps.length ? (
            <div className="mt-[14px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[10px]">
              {criticalGaps.map((g) => (
                <div key={g.id} className="rounded-[12px] border border-[#FECACA] bg-[#FFF1F0] px-[14px] py-[12px]">
                  <p className="text-[14px] font-semibold leading-tight truncate">{g.competency.name}</p>
                  <p className="text-[12px] text-[#6B6560] truncate mt-[2px]">{g.user.name ?? g.user.email}</p>
                  <span className="mt-[8px] inline-flex text-[10px] font-bold tracking-[0.06em] uppercase bg-[#F04438] text-white px-[8px] py-[3px] rounded-full">Critical</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground mt-[10px]">No critical exposure — workforce meets targets.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
