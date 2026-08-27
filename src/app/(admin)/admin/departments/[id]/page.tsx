import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

export default async function AdminDepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("ADMIN");
  const { id } = await params;

  const dept = await db.department.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  });
  if (!dept) notFound();

  // Actual data: learners AND trainers in this department
  const [allUsers, learnerSkillGaps] = await Promise.all([
    db.user.findMany({
      where: { departmentId: id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobRole: { select: { id: true, name: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.skillGap.findMany({
      where: { user: { departmentId: id } },
      select: { severity: true, userId: true },
    }),
  ]);

  const learners = allUsers.filter((u) => u.role === "LEARNER");
  const trainers = allUsers.filter((u) => u.role === "TRAINER");
  const admins = allUsers.filter((u) => u.role === "ADMIN");

  // Fetch detailed skill gaps for learners only
  const userDetails = await db.user.findMany({
    where: { id: { in: learners.map((u) => u.id) } },
    select: {
      id: true,
      name: true,
      email: true,
      jobRole: { select: { id: true, name: true } },
      skillGaps: { select: { severity: true, gapSize: true, competency: { select: { name: true } } } },
      _count: { select: { userCompetencies: true } },
    },
  });

  const totalGaps = learnerSkillGaps.length;
  const totalCritical = learnerSkillGaps.filter((g) => g.severity === "CRITICAL").length;

  // Group learners by role — actual roles, no mock
  const roleMap = new Map<string, typeof userDetails>();
  for (const u of userDetails) {
    const key = u.jobRole?.id ?? "unassigned";
    if (!roleMap.has(key)) roleMap.set(key, []);
    roleMap.get(key)!.push(u);
  }
  // role names lookup
  const roleNames = new Map<string, string>();
  for (const u of userDetails) {
    const k = u.jobRole?.id ?? "unassigned";
    if (!roleNames.has(k)) roleNames.set(k, u.jobRole?.name ?? "No role assigned");
  }
  const roles = Array.from(roleMap.entries())
    .map(([k, users]) => ({ id: k, name: roleNames.get(k) ?? k, users }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="mx-auto max-w-[980px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[20px]">
        <div>
          <Link href="/admin/departments" className="inline-flex items-center gap-[6px] rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[6px] text-[12px] font-medium hover:bg-white transition">
            <span aria-hidden>←</span> All departments
          </Link>
          <h1 className="mt-[14px] text-[28px] md:text-[34px] font-[720] tracking-[-0.03em] leading-[1.05]">{dept.name}</h1>
          {dept.description ? <p className="text-[14px] leading-[1.6] text-muted-foreground mt-[8px] max-w-[720px]">{dept.description}</p> : null}
          <p className="text-[13px] tabular-mono text-muted-foreground mt-[8px]">{allUsers.length} members · {learners.length} learners · {trainers.length} trainers{admins.length ? ` · ${admins.length} admins` : ""}</p>
        </div>

        {/* Actual aggregate strip */}
        <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--color-border-resting)] overflow-hidden">
          <div className="flex-1 px-[18px] py-[14px]">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Learners</p>
            <p className="num text-[24px] font-[700] leading-none mt-[4px]">{learners.length}</p>
            <p className="text-[12px] text-muted-foreground">need gap closure</p>
          </div>
          <div className="flex-1 px-[18px] py-[14px]">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Trainers</p>
            <p className="num text-[24px] font-[700] leading-none mt-[4px]">{trainers.length}</p>
            <p className="text-[12px] text-muted-foreground">deliver faculty</p>
          </div>
          <div className="flex-1 px-[18px] py-[14px]">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Gaps</p>
            <p className="num text-[24px] font-[700] leading-none mt-[4px]">{totalGaps}</p>
            <p className="text-[12px] tabular-mono" style={{ color: totalCritical ? "#C9190B" : "#6B7280" }}>{totalCritical} critical</p>
          </div>
          <div className="flex-1 px-[18px] py-[14px] bg-[#FFFCF7]">
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Faculty load</p>
            <p className="text-[13px] font-medium leading-tight mt-[4px]">{trainers.length ? `${(totalGaps / Math.max(trainers.length, 1)).toFixed(1)} gaps per trainer` : "No faculty assigned"}</p>
            <p className="text-[11px] text-muted-foreground">actual ratio</p>
          </div>
        </div>

        {/* Trainers actual list if any */}
        {trainers.length > 0 && (
          <section className="rounded-[16px] border border-[#FDE68A]/40 bg-[#FFFBEB] p-[16px]">
            <h2 className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[#92400E]">Faculty in this division</h2>
            <div className="mt-[10px] flex flex-wrap gap-[8px]">
              {trainers.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-[8px] rounded-full bg-white border border-[#FDE68A] px-[12px] py-[7px] text-[13px] font-medium shadow-sm">
                  <span className="size-7 rounded-full bg-[#FEF3C7] grid place-items-center text-[11px] font-bold">{(t.name ?? t.email ?? "?").slice(0, 1)}</span>
                  {t.name ?? t.email}
                  {t.jobRole ? <span className="text-[11px] text-muted-foreground">· {t.jobRole.name}</span> : null}
                </span>
              ))}
            </div>
          </section>
        )}

        {roles.length === 0 && learners.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] bg-[#FFFCF7] px-[20px] py-[20px] text-center text-[14px] text-muted-foreground">No learners assigned to this division yet. Assign officers to see actual gaps.</div>
        ) : (
          roles.map((r) => (
            <section key={r.id} className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-[8px] px-[18px] py-[14px] border-b border-[color:var(--color-border-resting)] bg-white">
                <h2 className="text-[15px] font-[650]">{r.name}</h2>
                <span className="text-[12px] tabular-mono text-muted-foreground border border-[color:var(--color-border-resting)] rounded-full px-[10px] py-[4px] bg-[#FFFCF7]">{r.users.length} officer{r.users.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-[color:var(--color-border-resting)]">
                {r.users.map((u) => {
                  const top = [...u.skillGaps].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.gapSize - a.gapSize).slice(0, 3);
                  const crit = u.skillGaps.filter((g) => g.severity === "CRITICAL").length;
                  return (
                    <div key={u.id} className="flex gap-[14px] px-[18px] py-[14px] hover:bg-[#FFFCF7] transition">
                      <div className="size-9 rounded-full bg-white border border-[color:var(--color-border-resting)] grid place-items-center text-[12px] font-bold shrink-0 mt-[2px]">{(u.name ?? u.email ?? "?").slice(0, 1)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-[8px]">
                          <p className="text-[14px] font-semibold truncate">{u.name ?? u.email}</p>
                          <span className={`text-[11px] font-semibold px-[8px] py-[3px] rounded-full border ${crit ? "bg-[#FFF1F0] text-[#C9190B] border-[#FECACA]" : top.length ? "bg-[#F0FDF4] text-[#0E7A4B] border-[#BBF7D0]" : "bg-white text-muted-foreground border-[color:var(--color-border-resting)]"}`}>
                            {crit ? `${crit} critical` : top.length ? `${top.length} gaps` : "no gaps"}
                          </span>
                        </div>
                        {top.length ? (
                          <div className="mt-[8px] flex flex-wrap gap-[6px]">
                            {top.map((g, i) => (
                              <span key={i} className={`inline-flex rounded-full px-[9px] py-[4px] text-[12px] font-medium border ${g.severity === "CRITICAL" ? "bg-[#FFF1F0] text-[#C9190B] border-[#FECACA]" : g.severity === "LOW" ? "bg-[#F0FDF4] text-[#0E7A4B] border-[#BBF7D0]" : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"}`}>
                                {g.competency.name}
                                <span className="ml-[6px] tabular-mono text-[11px] opacity-70">{g.severity.toLowerCase()}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[12px] tabular-mono text-[#0E7A4B] mt-[6px]">Ready — no flagged gaps</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {admins.length > 0 && (
          <p className="text-[11px] tabular-mono text-muted-foreground text-center">{admins.length} admin{admins.length !== 1 ? "s" : ""} also belong to this division — not counted in learner gaps.</p>
        )}
      </div>
    </AppShell>
  );
}
