import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { TutorChat } from "./tutor-chat";
import { db } from "@/lib/db/client";

export default async function TutorPage() {
  const session = await requireRole("LEARNER");
  // gap-aware starter context
  let gaps: { name: string; severity: string }[] = [];
  try {
    const rows = await db.skillGap.findMany({
      where: { userId: session.user.id, severity: { in: ["CRITICAL", "HIGH"] } },
      take: 3,
      orderBy: { gapSize: "desc" },
      include: { competency: { select: { name: true } } },
    });
    gaps = rows.map((r) => ({ name: r.competency.name, severity: r.severity }));
  } catch { /* db may be unavailable in preview */ }

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="mx-auto flex max-w-5xl flex-col px-6 py-8">
        {/* Header — Caliper instrument language */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--color-rule)] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-sm bg-[color:var(--color-measure)] text-white">
                <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden><path d="M3 10h14M6 5v10M13 7v6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </span>
              <h1 className="text-[22px] font-semibold tracking-tight">Tutor</h1>
              <span className="rounded-sm bg-[color:var(--color-surface)] border border-[color:var(--color-rule)] px-1.5 py-0.5 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Grounded</span>
            </div>
            <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
              Your measurement-aware tutor. Answers only from trainer-uploaded material, cites every claim, and calibrates to your gaps. Out-of-scope questions are declined, never guessed.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-[color:var(--color-target)]" aria-hidden />
            Retrieval before generation
            <span className="mx-2 h-3 w-px bg-[color:var(--color-rule)]" aria-hidden />
            Citations required
          </div>
        </div>

        {gaps.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">Focus on your gaps:</span>
            {gaps.map((g) => (
              <span key={g.name} className="rounded-full border border-[color:var(--color-gap)]/30 bg-[color:var(--color-gap)]/10 px-2.5 py-1 text-xs font-medium">{g.name} · {g.severity}</span>
            ))}
          </div>
        )}

        <TutorChat initialGaps={gaps.map((g) => g.name)} />
      </div>
    </AppShell>
  );
}
