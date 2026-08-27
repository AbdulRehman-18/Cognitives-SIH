import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";
import { db } from "@/lib/db/client";
import Link from "next/link";

export default async function AdminProfilePage() {
  const session = await requireRole("ADMIN");
  const [user, deptCount, roleCount, learnerCount, trainerCount, gaps, depts, recentGaps] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { email: true, name: true, createdAt: true } }),
    db.department.count(),
    db.role.count(),
    db.user.count({ where: { role: "LEARNER" } }),
    db.user.count({ where: { role: "TRAINER" } }),
    db.skillGap.count(),
    db.department.findMany({ select: { id: true, name: true, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    db.skillGap.findMany({ take: 4, orderBy: { createdAt: "desc" }, include: { competency: { select: { name: true } }, user: { select: { name: true } } } }),
  ]);
  const critical = await db.skillGap.count({ where: { severity: "CRITICAL" } });

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[16px]">
        <div>
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Admin profile</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">Your remit as Training Manager / DIID Coordinator — people and systems you steward, not a personal score.</p>
        </div>

        <div className="rounded-[20px] border border-[color:var(--color-border-resting)] bg-[#141210] text-[#FFF8ED] p-[22px] flex flex-col md:flex-row gap-[18px]">
          <div className="size-[68px] rounded-[16px] bg-white text-[#141210] grid place-items-center text-[26px] font-[750] shrink-0">{(session.user.name ?? "A").slice(0, 1)}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[22px] font-[650] leading-none">{session.user.name ?? "Admin"}</h2>
            <p className="text-[13px] opacity-70 mt-[6px] truncate">{user?.email} · ADMIN · MoSPI · since {user ? new Date(user.createdAt).toLocaleDateString() : "—"}</p>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              <span className="rounded-full bg-white text-[#141210] px-[12px] py-[6px] text-[11px] font-semibold">{deptCount} divisions</span>
              <span className="rounded-full bg-white/10 border border-white/15 px-[12px] py-[6px] text-[11px] font-medium">{roleCount} roles</span>
              <span className="rounded-full bg-white/10 border border-white/15 px-[12px] py-[6px] text-[11px] tabular-mono">{learnerCount} learners · {trainerCount} trainers</span>
            </div>
          </div>
          <div className="flex flex-row md:flex-col gap-[8px] shrink-0">
            <Link href="/admin/settings" className="rounded-full bg-white text-[#141210] px-[16px] py-[8px] text-[13px] font-semibold text-center">Settings</Link>
            <Link href="/admin/overview" className="rounded-full bg-white/10 border border-white/20 text-white px-[16px] py-[8px] text-[13px] font-medium text-center">Intelligence →</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <section className="lg:col-span-7 rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Remit — divisions in scope</h2>
            <div className="mt-[12px] grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
              {depts.map((d) => (
                <div key={d.id} className="rounded-[12px] border border-[color:var(--color-border-resting)] bg-[#FFFCF7] px-[12px] py-[11px] flex items-center justify-between">
                  <span className="text-[13px] font-medium truncate pr-[8px]">{d.name}</span>
                  <span className="num text-[11px] tabular-mono font-semibold shrink-0 border rounded-full px-[8px] py-[3px] bg-white">{d._count.users}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px] flex flex-col gap-[12px]">
            <div>
              <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Org snapshot — actual</h2>
              <div className="mt-[12px] grid grid-cols-3 gap-[8px]">
                <div className="rounded-[12px] bg-[#141210] text-white p-[12px] text-center"><p className="num text-[22px] font-[700] leading-none">{gaps}</p><p className="text-[11px] opacity-70 mt-[4px]">total gaps</p></div>
                <div className="rounded-[12px] bg-[#FFF1F0] border border-[#FECACA] p-[12px] text-center"><p className="num text-[22px] font-[700] leading-none text-[#C9190B]">{critical}</p><p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#6B7280]">critical</p></div>
                <div className="rounded-[12px] bg-white border border-[color:var(--color-border-resting)] p-[12px] text-center"><p className="num text-[22px] font-[700] leading-none">{learnerCount + trainerCount}</p><p className="text-[11px] text-muted-foreground">people</p></div>
              </div>
            </div>
            <div className="rounded-[12px] bg-[#FFFCF7] border border-[color:var(--color-border-resting)] p-[12px]">
              <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Latest flags</p>
              <div className="mt-[8px] flex flex-col gap-[6px]">
                {recentGaps.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-[8px] text-[12px]">
                    <span className="truncate">{g.competency.name} · {g.user.name ?? "officer"}</span>
                    <span className="shrink-0 rounded-full bg-[#F04438]/10 text-[#C9190B] border border-[#FECACA] px-[7px] py-[2px] text-[10px] font-bold">NEW</span>
                  </div>
                ))}
              </div>
              <Link href="/admin/shortages" className="mt-[10px] inline-flex text-[12px] font-medium text-[#2E3AFF] underline underline-offset-4">View shortages →</Link>
            </div>
          </section>
        </div>

        <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[#FFFBEB] p-[16px] flex flex-wrap items-center gap-[12px]">
          <span className="text-[13px] font-medium">Need to shape taxonomy?</span>
          <span className="text-[12px] text-muted-foreground">Roles and framework are seeded from the four-domain competency matrix (Statistical 10, Technical 12, Digital Governance 5, Behavioural 6).</span>
          <Link href="/admin/roles" className="ml-auto rounded-full bg-[#141210] text-white px-[14px] py-[7px] text-[12px] font-semibold">Manage roles →</Link>
        </div>
      </div>
    </AppShell>
  );
}
