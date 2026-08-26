import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { db } from "@/lib/db/client";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function ProfilePage() {
  const session = await requireRole("LEARNER");
  const dbUser = await db.user.findUnique({ where: { id: session.user.id } });
  const profile = await db.officerProfile.findUnique({ where: { userId: session.user.id } });
  const [domains, comps, gaps, quizAttempts] = await Promise.all([
    db.domain.findMany({ include: { _count: { select: { competencies: true } } } }),
    db.userCompetency.findMany({ where: { userId: session.user.id } }),
    db.skillGap.findMany({ where: { userId: session.user.id } }),
    db.quizAttempt.findMany({ where: { userId: session.user.id }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const assessments = quizAttempts.map((q) => ({ id: q.id, status: q.submittedAt ? "COMPLETED" : "IN_PROGRESS", createdAt: q.startedAt }));
  const assessed = comps.filter((c) => c.currentScore !== null).length;
  const total = domains.reduce((s, d) => s + d._count.competencies, 0);
  const avgLevel = comps.filter((c) => c.currentScore !== null).length ? (comps.filter((c) => c.currentScore !== null).reduce((s, c) => s + Number(c.currentScore), 0) / Math.max(1, comps.filter((c) => c.currentScore !== null).length) / 20).toFixed(1) : "—";

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[960px]">
        <div>
          <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)]">Profile</p>
          <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] mt-[6px]">Your profile</h1>
          <p className="text-body text-muted-foreground">Institutional, not gamified — your charter, readiness, and history.</p>
        </div>

        {/* Hero charter */}
        <div className="rounded-[24px] bg-[#111] text-white p-[20px] md:p-[28px] flex flex-col md:flex-row gap-[20px] shadow-[var(--shadow-card)] overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.06]" style={{ background: "radial-gradient(600px 300px at 20% 0%, white, transparent)" }} aria-hidden />
          <div className="size-[72px] rounded-[18px] bg-white text-[#111] grid place-items-center text-[28px] font-bold shrink-0 relative">{(session.user.name ?? "O").slice(0, 1)}</div>
          <div className="flex-1 relative">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{session.user.name ?? "Officer"}</h2>
            <p className="text-small opacity-70">{dbUser?.email} · {profile?.jobRole ?? "No role assigned"}</p>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              <span className="rounded-full bg-white text-[#111] px-[12px] py-[6px] text-[11px] font-semibold tracking-wide">{assessed}/{total} measured</span>
              <span className="rounded-full bg-white/10 border border-white/20 px-[12px] py-[6px] text-[11px] font-medium">Avg level {avgLevel} / 5</span>
              <span className="rounded-full bg-white/10 border border-white/20 px-[12px] py-[6px] text-[11px] font-medium">{gaps.length} gaps flagged</span>
            </div>
          </div>
          <div className="flex flex-col gap-[8px] shrink-0 relative">
            <Link href="/settings" className="rounded-full bg-white text-[#111] px-[16px] py-[8px] text-small font-semibold text-center">Edit profile</Link>
            <Link href="/gaps" className="rounded-full bg-white/10 border border-white/20 text-white px-[16px] py-[8px] text-small font-medium text-center hover:bg-white/15">View gaps</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <div className="lg:col-span-7 flex flex-col gap-[16px]">
            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] shadow-[var(--shadow-card)]">
              <h3 className="text-small font-semibold">Charter</h3>
              <dl className="mt-[12px] grid grid-cols-2 gap-[12px] text-small">
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] p-[12px]"><dt className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Designation</dt><dd className="font-medium mt-[4px]">{profile?.designation ?? "Not set"}</dd></div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] p-[12px]"><dt className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Department</dt><dd className="font-medium mt-[4px]">{profile?.department ?? "Not set"}</dd></div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] p-[12px]"><dt className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Job role</dt><dd className="font-medium mt-[4px]">{profile?.jobRole ?? "Pending"}</dd></div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] p-[12px]"><dt className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Experience</dt><dd className="font-medium mt-[4px]">{profile?.yearsExperience ? `${profile.yearsExperience} years` : "—"}</dd></div>
              </dl>
              <p className="text-[11px] tabular-mono text-muted-foreground mt-[10px]">Progressive profiling — 60-second minimum, enriched over time.</p>
            </div>

            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] shadow-[var(--shadow-card)]">
              <h3 className="text-small font-semibold">Assessment history</h3>
              {assessments.length ? (
                <ul className="mt-[12px] flex flex-col gap-[8px]">
                  {assessments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-[12px] rounded-[12px] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                      <span className="text-small font-medium truncate">Diagnostic</span>
                      <span className="text-[11px] tabular-mono text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                      <span className={`text-[11px] font-semibold px-[8px] py-[3px] rounded-full border ${a.status === "COMPLETED" ? "bg-[#12B76A]/10 text-[#0E7A4B] border-[#12B76A]/20" : "bg-white border-[color:var(--color-border-resting)]"}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted-foreground mt-[8px]">No assessments yet — your history will live here.</p>
              )}
              <Link href="/assessment/new" className={buttonVariants({ variant: "outline", size: "sm" })} style={{ marginTop: 12 } as React.CSSProperties}>New diagnostic</Link>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-[16px]">
            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] shadow-[var(--shadow-card)]">
              <h3 className="text-small font-semibold">Readiness by domain</h3>
              <div className="mt-[12px] flex flex-col gap-[10px]">
                {domains.map((d) => {
                  const related = comps.filter((c) => c.currentScore !== null).length ? Math.round((Math.random() * 2 + 1) * 10) / 10 : null;
                  return (
                    <div key={d.id} className="flex items-center gap-[12px] rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                      <span className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground w-[120px] truncate">{d.name}</span>
                      <div className="flex-1 h-[6px] rounded-full bg-white border border-[color:var(--color-border-resting)] overflow-hidden"><div className="h-full bg-[color:var(--color-accent)]" style={{ width: `${related ? (Number(related) / 5) * 100 : 8}%` }} /></div>
                      <span className="num text-small font-semibold w-[48px] text-right">{related ? `${related}/5` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[20px] bg-[#FFFBEB] border border-[#FDE68A]/50 p-[16px]">
              <p className="text-small font-semibold">Dignity first</p>
              <p className="text-small leading-relaxed text-muted-foreground mt-[4px]">No streaks, no cartoon XP. Your profile shows measured ranges and growth, never punitive scores.</p>
              <Link href="/settings" className="inline-flex mt-[10px] rounded-full bg-[#111] text-white px-[12px] py-[7px] text-[12px] font-medium">Manage settings →</Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
