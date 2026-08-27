import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { db } from "@/lib/db/client";
import Link from "next/link";

function DomainTicks({ level }: { level: number | null }) {
  return (
    <div className="flex items-center gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`size-[8px] rounded-full border ${level !== null && i <= Math.round(level) ? "bg-[#2E3AFF] border-[#2E3AFF]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`} />
      ))}
    </div>
  );
}

export default async function ProfilePage() {
  const session = await requireRole("LEARNER");
  const [dbUser, profile, domains, comps, gaps, quizAttempts, userCompetencies] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { email: true, name: true, department: { select: { name: true } }, role: true } }),
    db.officerProfile.findUnique({ where: { userId: session.user.id } }),
    db.domain.findMany({ include: { _count: { select: { competencies: true } } } }),
    db.userCompetency.findMany({ where: { userId: session.user.id }, include: { competency: { select: { domainId: true } } } }),
    db.skillGap.findMany({ where: { userId: session.user.id }, include: { competency: { select: { name: true } } } }),
    db.quizAttempt.findMany({ where: { userId: session.user.id }, orderBy: { startedAt: "desc" }, take: 6, include: { assessment: { select: { competencies: true } } } }),
    db.userCompetency.findMany({ where: { userId: session.user.id, currentScore: { not: null } }, select: { currentScore: true, competency: { select: { domainId: true } } } }),
  ]);

  const assessed = comps.filter((c) => c.currentScore !== null).length;
  const total = domains.reduce((s, d) => s + d._count.competencies, 0);
  const avgLevel = assessed
    ? (comps.filter((c) => c.currentScore !== null).reduce((s, c) => s + Number(c.currentScore!), 0) / assessed / 20).toFixed(1)
    : "—";

  // Actual per-domain level
  const perDomain = domains.map((d) => {
    const scores = userCompetencies.filter((uc) => uc.competency.domainId === d.id).map((uc) => Number(uc.currentScore!));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const level = avg === null ? null : Math.max(1, Math.min(5, avg / 20));
    return { ...d, level, count: scores.length };
  });

  const completeness = profile?.completeness ?? Math.round((assessed / Math.max(total, 1)) * 60 + (profile ? 20 : 0));

  // Gap split actual
  const gapBySeverity = {
    CRITICAL: gaps.filter((g) => g.severity === "CRITICAL").length,
    OTHER: gaps.filter((g) => g.severity !== "CRITICAL").length,
  };

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[18px]">
        {/* Hero — advanced, not just avatar + 3 pills */}
        <div className="rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ background: "radial-gradient(800px 400px at 18% 0%, white, transparent)" }} />
          <div className="relative p-[22px] md:p-[28px] flex flex-col lg:flex-row gap-[20px]">
            <div className="flex gap-[16px] flex-1 min-w-0">
              <div className="size-[72px] rounded-[16px] bg-[color:var(--color-surface-1)] text-[#141210] grid place-items-center text-[26px] font-[750] shrink-0">{(session.user.name ?? "O").slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] md:text-[28px] font-[720] tracking-[-0.02em] leading-none">{session.user.name ?? "Officer"}</h1>
                <p className="text-[13px] opacity-70 mt-[6px] truncate">{dbUser?.email} · {profile?.jobRole ?? "No role assigned"} {dbUser?.department ? `· ${dbUser.department.name}` : ""}</p>
                <div className="mt-[12px] flex flex-wrap gap-[8px]">
                  <span className="rounded-full bg-[color:var(--color-surface-1)] text-[#141210] px-[12px] py-[6px] text-[11px] font-semibold">{assessed}/{total} measured</span>
                  <span className="rounded-full bg-[color:var(--color-surface-1)]/10 border border-white/15 px-[12px] py-[6px] text-[11px] font-medium">Avg {avgLevel} / 5</span>
                  <span className={`rounded-full px-[12px] py-[6px] text-[11px] font-bold border ${gapBySeverity.CRITICAL ? "bg-[#F04438] border-[#F04438] text-white" : "bg-[color:var(--color-surface-1)]/10 border-white/20"}`}>{gapBySeverity.CRITICAL ? `${gapBySeverity.CRITICAL} critical` : "No critical"}</span>
                </div>
              </div>
            </div>
            <div className="lg:w-[340px] shrink-0 flex flex-col gap-[12px]">
              <div className="rounded-[14px] bg-[color:var(--color-surface-1)]/10 border border-white/15 p-[14px] flex items-center gap-[14px]">
                <div className="size-[56px] rounded-full border-[5px] border-white/20 relative grid place-items-center shrink-0" style={{ background: `conic-gradient(white ${completeness}%, transparent ${completeness}%)` }}>
                  <div className="absolute inset-[5px] rounded-full bg-[color:var(--color-ink)] grid place-items-center"><span className="num text-[13px] font-bold">{completeness}%</span></div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-60">Profile completeness</p>
                  <p className="text-[13px] font-medium leading-tight mt-[2px]">Progressive profiling — enrich to 100% for sharper gaps.</p>
                </div>
              </div>
              <div className="flex gap-[8px]">
                <Link href="/settings" className="flex-1 rounded-full bg-[color:var(--color-surface-1)] text-[#141210] px-[14px] py-[8px] text-[13px] font-semibold text-center">Edit profile</Link>
                <Link href="/gaps" className="flex-1 rounded-full bg-[color:var(--color-surface-1)]/10 border border-white/20 text-white px-[14px] py-[8px] text-[13px] font-medium text-center">View gaps</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          {/* Charter */}
          <div className="lg:col-span-5 flex flex-col gap-[16px]">
            <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Charter</h2>
              <div className="mt-[12px] grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                {[
                  { k: "Designation", v: profile?.designation ?? "Not set" },
                  { k: "Department", v: profile?.department ?? dbUser?.department?.name ?? "Not set" },
                  { k: "Job role", v: profile?.jobRole ?? "Pending" },
                  { k: "Experience", v: profile?.yearsExperience ? `${profile.yearsExperience} years` : "—" },
                  { k: "Education", v: profile?.education ?? "—" },
                  { k: "Member since", v: profile ? new Date(profile.createdAt).toLocaleDateString() : "—" },
                ].map((f) => (
                  <div key={f.k} className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[11px]">
                    <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">{f.k}</p>
                    <p className="text-[13px] font-medium mt-[4px] truncate">{f.v}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[13px] font-[650]">Readiness by domain — actual</h2>
              <p className="text-[12px] text-muted-foreground mt-[2px]">Measured, not mocked. Dots = level / 5.</p>
              <div className="mt-[14px] flex flex-col gap-[12px]">
                {perDomain.map((d) => (
                  <div key={d.id} className="flex items-center gap-[12px] rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[11px]">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold leading-none truncate" title={d.name}>{d.name}</p>
                      <p className="text-[11px] tabular-mono text-muted-foreground mt-[4px]">{d.count}/{d._count.competencies} assessed</p>
                    </div>
                    <DomainTicks level={d.level} />
                    <span className="num text-[13px] font-semibold tabular-mono w-[44px] text-right">{d.level === null ? "—" : `${d.level.toFixed(1)}`}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* History + gaps */}
          <div className="lg:col-span-7 flex flex-col gap-[16px]">
            <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <div className="flex items-baseline justify-between gap-[8px]">
                <h2 className="text-[13px] font-[650]">Assessment journey</h2>
                <span className="text-[11px] tabular-mono text-muted-foreground">{quizAttempts.length} attempts</span>
              </div>
              {quizAttempts.length ? (
                <ol className="mt-[14px] relative flex flex-col gap-[0px] before:absolute before:left-[11px] before:top-[8px] before:bottom-[16px] before:w-px before:bg-[color:var(--color-border-resting)]">
                  {quizAttempts.map((q) => (
                    <li key={q.id} className="relative flex gap-[12px] pl-[28px] py-[10px]">
                      <span className={`absolute left-0 top-[14px] size-[10px] rounded-full border-2 ${q.submittedAt ? "bg-[#12B76A] border-[#12B76A]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`} />
                      <div className="flex-1 min-w-0 rounded-[12px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[10px] flex items-center gap-[10px]">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">Diagnostic · {q.assessment.competencies.length} competencies</p>
                          <p className="text-[11px] tabular-mono text-muted-foreground">{new Date(q.startedAt).toLocaleDateString()} · {q.submittedAt ? `Score ${Number(q.score ?? 0).toFixed(0)}/100` : "In progress"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-[8px] py-[3px] text-[11px] font-semibold border ${q.submittedAt ? "bg-[#F0FDF4] text-[#0E7A4B] border-[#BBF7D0]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`}>{q.submittedAt ? "Completed" : "Ongoing"}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-muted-foreground mt-[8px]">No assessments yet — start a diagnostic to build your trajectory.</p>
              )}
              <Link href="/assessment/new" className="mt-[12px] inline-flex rounded-full bg-[#2E3AFF] text-white px-[14px] py-[8px] text-[13px] font-semibold">Start new diagnostic →</Link>
            </section>

            <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[13px] font-[650]">Open gaps</h2>
              {gaps.length ? (
                <div className="mt-[12px] flex flex-col gap-[8px]">
                  {gaps.slice(0, 5).map((g) => (
                    <div key={g.id} className="flex items-center gap-[10px] rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                      <span className={`size-2 rounded-full shrink-0 ${g.severity === "CRITICAL" ? "bg-[#F04438]" : g.severity === "LOW" ? "bg-[#12B76A]" : "bg-[#E5A100]"}`} />
                      <span className="text-[13px] font-medium flex-1 truncate">{g.competency.name}</span>
                      <span className="text-[11px] tabular-mono text-muted-foreground">Lv {g.currentLevel} → {g.requiredLevel}</span>
                      <span className={`text-[10px] font-bold tracking-wide px-[7px] py-[3px] rounded-full border ${g.severity === "CRITICAL" ? "bg-[#FFF1F0] text-[#C9190B] border-[#FECACA]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`}>{g.severity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground mt-[8px]">No open gaps — well calibrated.</p>
              )}
              <Link href="/gaps" className="mt-[12px] inline-flex text-[13px] font-medium text-[#2E3AFF] underline underline-offset-4">View full gap report →</Link>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
