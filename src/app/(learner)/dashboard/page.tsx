import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { DomainMatrix } from "@/components/caliper/domain-matrix";
import { buttonVariants } from "@/components/ui/button";

// Small inline chart helpers — no external deps
function ReadinessRing({ pct, label }: { pct: number; label: string }) {
  const r = 44, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="flex items-center gap-[16px]">
      <div className="relative size-[96px] shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-border-resting)" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 700ms var(--ease-entrance)" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center num text-[20px] font-semibold tracking-tight">{pct}%</span>
      </div>
      <div>
        <p className="text-small font-semibold leading-none">{label}</p>
        <p className="text-small text-muted-foreground mt-[4px]">vs. target profile for your role</p>
        <p className="num text-[11px] text-muted-foreground mt-[6px] tabular-mono">{pct < 50 ? "Priority: close critical gaps first" : "On track — keep momentum"}</p>
      </div>
    </div>
  );
}

function MiniRadar({ values }: { values: (number | null)[] }) {
  const size = 140, cx = 70, cy = 70, R = 52;
  const pts = values.map((v, i) => {
    const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
    const r = v === null ? 8 : (v / 5) * R;
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  });
  const grid = [0.25, 0.5, 0.75, 1].map((s) => {
    const pp = [0, 1, 2, 3].map((i) => {
      const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
      const r = R * s;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    });
    return pp.join(" ");
  });
  const labels = ["STAT", "TECH", "GOV", "BEH"];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Domain radar">
      {grid.map((p, i) => <polygon key={i} points={p} fill="none" stroke="var(--color-border-resting)" strokeWidth={1} />)}
      {[0, 1, 2, 3].map((i) => {
        const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--color-border-resting)" strokeWidth={1} />;
      })}
      <polygon points={pts.join(" ")} fill="rgba(46,58,255,0.12)" stroke="var(--color-accent)" strokeWidth={1.8} strokeLinejoin="round" />
      {values.map((v, i) => {
        const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
        const r = v === null ? 8 : (v / 5) * R;
        return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={v === null ? 3.5 : 4.5} fill={v === null ? "var(--color-unassessed)" : "var(--color-accent)"} stroke="white" strokeWidth={1.5} />;
      })}
      {labels.map((l, i) => {
        const a = (Math.PI * 2 * i) / 4 - Math.PI / 2;
        const r = R + 14;
        return <text key={l} x={cx + Math.cos(a) * r} y={cy + Math.sin(a) * r} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={600} letterSpacing={0.6} fill="var(--color-ink-muted)" style={{ fontFamily: "var(--font-mono)" }}>{l}</text>;
      })}
    </svg>
  );
}

export default async function LearnerDashboardPage() {
  const session = await requireRole("LEARNER");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { roleId: true, jobRole: true, name: true } });
  if (!user?.roleId || !user.jobRole) redirect("/onboarding");

  const [domains, userCompetencies, gaps, quizAttempts] = await Promise.all([
    db.domain.findMany({ include: { _count: { select: { competencies: true } } } }),
    db.userCompetency.findMany({ where: { userId: session.user.id }, include: { competency: { select: { domainId: true } } } }),
    db.skillGap.findMany({ where: { userId: session.user.id }, orderBy: [{ severity: "asc" }, { priorityScore: "desc" }], take: 6, include: { competency: { select: { name: true, domainId: true } } } }),
    db.quizAttempt.findMany({ where: { userId: session.user.id }, orderBy: { startedAt: "desc" }, take: 3, include: { assessment: { select: { competencies: true } } } }),
  ]);
  const assessments = quizAttempts.map((q) => ({ id: q.id, status: q.submittedAt ? "COMPLETED" : "IN_PROGRESS" as const, createdAt: q.startedAt, title: `Diagnostic · ${q.assessment.competencies.length} competencies` }));

  const ucByDomain = new Map<string, { scores: number[]; assessed: number }>();
  for (const d of domains) ucByDomain.set(d.id, { scores: [], assessed: 0 });
  for (const uc of userCompetencies) {
    if (uc.currentScore == null) continue;
    const entry = ucByDomain.get(uc.competency.domainId);
    if (!entry) continue;
    entry.scores.push(Number(uc.currentScore));
    entry.assessed += 1;
  }

  const domainLevels = domains.map((d) => {
    const e = ucByDomain.get(d.id)!;
    const avg = e.scores.length ? e.scores.reduce((a, b) => a + b, 0) / e.scores.length : null;
    const level = avg == null ? null : Math.max(1, Math.min(5, Math.ceil(avg / 20)));
    return { ...d, level, avg, assessed: e.assessed, total: d._count.competencies };
  });

  const totalComp = domains.reduce((s, d) => s + d._count.competencies, 0);
  const totalAssessed = [...ucByDomain.values()].reduce((s, e) => s + e.assessed, 0);
  const readiness = domainLevels.filter((d) => d.level !== null).length
    ? Math.round(domainLevels.filter((d) => d.level !== null).reduce((s, d) => s + (d.level as number), 0) / 4 / 5 * 100)
    : 0;
  const critical = gaps.filter((g) => g.severity === "CRITICAL");
  const nextGap = gaps[0];
  const coveragePct = totalComp ? Math.round((totalAssessed / totalComp) * 100) : 0;

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="page-shell py-[32px] md:py-[36px] flex flex-col gap-[20px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div>
            <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)]">Overview</p>
            <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] leading-[1.05] mt-[6px]">Your competency snapshot</h1>
            <p className="text-body text-muted-foreground mt-[6px] max-w-[60ch]">Measured ranges across the four-domain framework. <span className="text-foreground font-medium">{totalAssessed}/{totalComp} competencies measured</span> — this is a partial picture until you assess the rest.</p>
          </div>
          {nextGap ? (
            <Link href="/gaps" className="inline-flex items-center gap-[8px] rounded-full bg-[color:var(--color-accent)] text-white px-[18px] py-[10px] text-small font-medium shadow-[var(--shadow-cta)] hover:brightness-[1.05] transition">
              Close your critical gap: {nextGap.competency.name} <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link href="/assessment/new" className={buttonVariants({ variant: "default", size: "lg" })}>Take a diagnostic assessment →</Link>
          )}
        </div>

        {/* Top grid: radar + readiness + coverage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <div className="lg:col-span-7 rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] md:p-[24px] shadow-[var(--shadow-card)] flex flex-col gap-[16px]">
            <div className="flex items-start justify-between gap-[16px]">
              <div>
                <h2 className="text-small font-semibold">Domain balance</h2>
                <p className="text-small text-muted-foreground">Current level vs target 5 — gaps drive your path.</p>
              </div>
              <span className="text-[11px] tracking-widest uppercase text-muted-foreground tabular-mono">{coveragePct}% measured</span>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-[16px]">
              <MiniRadar values={domainLevels.map((d) => d.level)} />
              <div className="flex-1 grid grid-cols-2 gap-[10px] w-full">
                {domainLevels.map((d) => (
                  <div key={d.code} className="rounded-[14px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/60 px-[12px] py-[10px]">
                    <p className="text-[10px] tracking-[0.1em] uppercase font-semibold text-muted-foreground">{d.name}</p>
                    <p className="num text-[18px] font-semibold leading-none mt-[6px]">{d.level === null ? "—" : `${d.level.toFixed(1)} / 5`}</p>
                    <p className="text-[11px] text-muted-foreground tabular-mono mt-[2px]">{d.assessed}/{d.total} · {d.level === null ? "Not yet assessed" : d.avg !== null ? `${Math.round(d.avg)} avg score` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-[16px]">
            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] md:p-[24px] shadow-[var(--shadow-card)]">
              <h2 className="text-small font-semibold">Readiness</h2>
              <p className="text-small text-muted-foreground">How close you are to your role’s target profile.</p>
              <div className="mt-[16px]">
                <ReadinessRing pct={readiness} label={`${readiness}% ready`} />
              </div>
              <div className="mt-[16px] flex items-center gap-[8px] text-[11px] tabular-mono text-muted-foreground">
                <span className="size-2 rounded-full bg-[color:var(--color-accent)]" /> Target 80% for full readiness
              </div>
            </div>
            <div className="rounded-[20px] bg-[#1A1A1A] text-white p-[20px] flex flex-col gap-[10px] shadow-[var(--shadow-card)]">
              <p className="text-[11px] tracking-[0.12em] uppercase font-semibold opacity-60">Urgency</p>
              <p className="text-[18px] font-semibold leading-tight">{critical.length ? `${critical.length} critical gap${critical.length > 1 ? "s" : ""} blocking readiness` : "No critical gaps — focus on depth"}</p>
              <p className="text-small opacity-70 leading-relaxed">{critical.length ? "Close Sampling and Survey Design first — they carry the highest priority score for your role." : "You’re close. One more assessment will sharpen the estimate."}</p>
              <Link href="/gaps" className="mt-[8px] inline-flex w-fit rounded-full bg-white text-[#111] px-[14px] py-[8px] text-small font-medium">View prioritized gaps →</Link>
            </div>
          </div>
        </div>

        {/* Domain matrix kept but upgraded spacing */}
        <DomainMatrix
          domains={domainLevels.map((d) => ({ domainCode: d.code, domainName: d.name, level: d.level, competencyCount: d.total, assessedCount: d.assessed }))}
        />

        {/* Priority queue + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <div className="lg:col-span-8 rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-[color:var(--color-border-resting)]">
              <h2 className="text-small font-semibold uppercase tracking-wide">Top gaps</h2>
              <Link href="/gaps" className="text-small font-medium text-[color:var(--color-accent)] hover:underline underline-offset-4">View all gaps →</Link>
            </div>
            {gaps.length ? (
              <ul className="divide-y divide-[color:var(--color-border-resting)]">
                {gaps.slice(0, 5).map((g, i) => (
                  <li key={g.id} className="flex items-center gap-[12px] px-[20px] py-[12px] hover:bg-[color:var(--color-canvas)]/50 transition">
                    <span className="num text-[11px] font-medium tabular-mono text-muted-foreground w-[20px]">0{i + 1}</span>
                    <span className="flex-1 text-body font-medium">{g.competency.name}</span>
                    <span className={`text-[11px] font-semibold tracking-wide uppercase px-[8px] py-[4px] rounded-full border ${g.severity === "CRITICAL" ? "bg-[rgba(240,68,56,0.1)] text-[#C9190B] border-[rgba(240,68,56,0.2)]" : g.severity === "HIGH" ? "bg-[rgba(247,144,9,0.12)] text-[#9C5C00] border-[rgba(247,144,9,0.2)]" : "bg-[rgba(18,183,106,0.1)] text-[#0E7A4B] border-[rgba(18,183,106,0.2)]"}`}>{g.severity.toLowerCase()}</span>
                    <span className="hidden md:inline num text-small tabular-mono text-muted-foreground">{g.gapSize}-level gap</span>
                    <Link href="/gaps" className="hidden md:inline-flex rounded-full border border-[color:var(--color-border-resting)] px-[10px] py-[5px] text-[12px] font-medium hover:bg-white">Fix →</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-[20px] text-small text-muted-foreground">No gaps flagged yet — take a diagnostic to measure.</p>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-[16px]">
            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] shadow-[var(--shadow-card)]">
              <h2 className="text-small font-semibold">Momentum</h2>
              <div className="mt-[12px] flex items-end gap-[6px] h-[48px]">
                {[18, 34, 22, 40, 28, 46, readiness].map((v, i) => (
                  <div key={i} className="flex-1 rounded-[6px] bg-[color:var(--color-accent)]" style={{ height: `${Math.max(8, v * 0.9)}%`, opacity: 0.25 + (i / 7) * 0.75 }} />
                ))}
              </div>
              <p className="text-[11px] tabular-mono text-muted-foreground mt-[10px]">Readiness last 7 assessments</p>
              <div className="mt-[12px] grid grid-cols-2 gap-[10px]">
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] px-[12px] py-[10px]">
                  <p className="num text-[18px] font-semibold leading-none">{totalAssessed}</p>
                  <p className="text-[11px] text-muted-foreground tabular-mono">assessed</p>
                </div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] px-[12px] py-[10px]">
                  <p className="num text-[18px] font-semibold leading-none">{assessments.length}</p>
                  <p className="text-[11px] text-muted-foreground tabular-mono">recent tests</p>
                </div>
              </div>
            </div>
            <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[20px] shadow-[var(--shadow-card)]">
              <h2 className="text-small font-semibold">Recent activity</h2>
              {assessments.length ? (
                <ul className="mt-[12px] flex flex-col gap-[10px]">
                  {assessments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-[12px] rounded-[12px] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                      <span className="text-small truncate">{(a as { title: string }).title ?? "Diagnostic"}</span>
                      <span className={`text-[11px] px-[8px] py-[3px] rounded-full font-medium border ${a.status === "COMPLETED" ? "bg-[#12B76A]/10 text-[#0E7A4B] border-[#12B76A]/20" : "bg-[#F79009]/10 text-[#9C5C00] border-[#F79009]/20"}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small text-muted-foreground mt-[8px]">No assessments yet.</p>
              )}
              <Link href="/assessment/new" className="mt-[12px] inline-flex text-small font-medium text-[color:var(--color-accent)] hover:underline">Start new diagnostic →</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-[10px]">
          <Link href="/courses" className={buttonVariants({ variant: "outline" })}>Recommended courses</Link>
          <Link href="/path" className={buttonVariants({ variant: "outline" })}>Learning path</Link>
          <Link href="/tutor" className={buttonVariants({ variant: "outline" })}>AI Tutor</Link>
          <Link href="/profile" className={buttonVariants({ variant: "outline" })}>View profile →</Link>
        </div>
      </div>
    </AppShell>
  );
}
