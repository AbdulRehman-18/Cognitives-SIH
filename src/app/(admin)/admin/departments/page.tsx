import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminDepartmentsPage() {
  const session = await requireRole("ADMIN");

  const departments = await db.department.findMany({
    select: { id: true, name: true, description: true, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  const deptStats = await Promise.all(
    departments.map(async (d) => {
      const users = await db.user.findMany({
        where: { departmentId: d.id },
        select: { id: true, role: true, name: true },
      });
      const learnerIds = users.filter((u) => u.role === "LEARNER").map((u) => u.id);
      const trainerIds = users.filter((u) => u.role === "TRAINER").map((u) => u.id);
      const [gaps, crit, roles, assessed] = learnerIds.length
        ? await Promise.all([
            db.skillGap.count({ where: { userId: { in: learnerIds } } }),
            db.skillGap.count({ where: { userId: { in: learnerIds }, severity: "CRITICAL" } }),
            db.user.groupBy({ by: ["roleId"], where: { departmentId: d.id }, _count: true }),
            db.userCompetency.count({ where: { userId: { in: learnerIds }, currentScore: { not: null } } }),
          ])
        : [0, 0, [], 0];

      // actual gap split for tiny chart
      const bySeverity = learnerIds.length
        ? await db.skillGap.groupBy({ by: ["severity"], where: { userId: { in: learnerIds } }, _count: true })
        : [];

      return {
        ...d,
        learners: learnerIds.length,
        trainers: trainerIds.length,
        gaps,
        crit,
        roleCount: roles.length,
        assessed,
        bySeverity: new Map(bySeverity.map((s) => [s.severity, s._count])),
        totalUsers: users.length,
      };
    }),
  );

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Departments</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[10px]">Every division with its actual officers and gaps — learners who need closure, trainers who deliver it. Tap a division to see its roles and people.</p>
          <p className="text-[13px] tabular-mono text-muted-foreground mt-[6px]">{departments.length} divisions · {deptStats.reduce((s, d) => s + d.learners, 0)} learners · {deptStats.reduce((s, d) => s + d.trainers, 0)} trainers in system</p>
        </div>

        {deptStats.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] bg-[#FFFCF7] px-[20px] py-[24px] text-center text-[14px] text-muted-foreground">No divisions seeded. Create departments in Prisma seed.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {deptStats.map((d) => {
              const hasGaps = d.gaps > 0;
              const critPct = d.gaps ? Math.round((d.crit / d.gaps) * 100) : 0;
              return (
                <Link
                  key={d.id}
                  href={`/admin/departments/${d.id}`}
                  className="group relative rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px] flex flex-col gap-[14px] hover:border-[#C6C2BA] hover:bg-white transition-colors"
                >
                  <div className="flex items-start justify-between gap-[12px]">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[15px] font-[650] leading-tight tracking-[-0.01em] group-hover:text-[color:var(--color-accent)] transition-colors line-clamp-2">{d.name}</h2>
                      {d.description ? (
                        <p className="text-[12px] leading-[1.5] text-muted-foreground mt-[4px] line-clamp-2">{d.description}</p>
                      ) : (
                        <p className="text-[12px] text-muted-foreground mt-[4px]">{d.roleCount} roles represented · {d.assessed} competencies assessed</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-[10px] py-[5px] text-[11px] font-semibold border ${d.crit ? "bg-[#FFF1F0] text-[#C9190B] border-[#FECACA]" : hasGaps ? "bg-[#F0FDF4] text-[#0E7A4B] border-[#BBF7D0]" : "bg-[#FFFCF7] text-muted-foreground border-[color:var(--color-border-resting)]"}`}>
                      {d.crit ? `${d.crit} critical` : hasGaps ? "No critical" : "No gaps"}
                    </span>
                  </div>

                  {/* Actual data row — no mock, no donut, just readable figures */}
                  <div className="grid grid-cols-3 gap-[10px] rounded-[12px] bg-[#FFFCF7] border border-[color:var(--color-border-resting)] p-[12px]">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Learners</p>
                      <p className="num text-[22px] font-[700] leading-none mt-[4px]">{d.learners}</p>
                      <p className="text-[11px] text-muted-foreground mt-[2px]">officers</p>
                    </div>
                    <div className="min-w-0 border-x border-[color:var(--color-border-resting)] px-[12px]">
                      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Trainers</p>
                      <p className="num text-[22px] font-[700] leading-none mt-[4px]">{d.trainers}</p>
                      <p className="text-[11px] text-muted-foreground mt-[2px]">faculty</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground">Gaps</p>
                      <p className="num text-[22px] font-[700] leading-none mt-[4px]">{d.gaps}</p>
                      <p className="text-[11px] tabular-mono mt-[2px]" style={{ color: d.crit ? "#C9190B" : "#6B7280" }}>{d.crit} critical · {critPct}%</p>
                    </div>
                  </div>

                  {/* Tiny severity split — dots, not progress bar */}
                  {hasGaps && (
                    <div className="flex items-center gap-[6px] flex-wrap">
                      <span className="text-[11px] font-medium text-muted-foreground">Split:</span>
                      {[
                        { k: "CRITICAL", c: "#F04438" },
                        { k: "HIGH", c: "#EA6B1A" },
                        { k: "MEDIUM", c: "#E5A100" },
                        { k: "LOW", c: "#12B76A" },
                      ].map((sev) => {
                        const v = d.bySeverity.get(sev.k as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") ?? 0;
                        if (!v) return null;
                        return (
                          <span key={sev.k} className="inline-flex items-center gap-[6px] rounded-full bg-white border border-[color:var(--color-border-resting)] px-[8px] py-[4px] text-[11px] tabular-mono">
                            <span className="size-2 rounded-full" style={{ background: sev.c }} />{sev.k.toLowerCase()} {v}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-[2px] border-t border-[color:var(--color-border-resting)]">
                    <span className="text-[12px] font-medium text-muted-foreground">{d.totalUsers} total members in division</span>
                    <span className="text-[13px] font-medium text-[color:var(--color-accent)] group-hover:gap-[6px] flex items-center gap-[4px] transition-all">Open division <span aria-hidden>→</span></span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
