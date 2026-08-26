import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { TutorChat } from "./tutor-chat";
import { db } from "@/lib/db/client";

export default async function TutorPage() {
  const session = await requireRole("LEARNER");
  let gaps: { name: string; severity: string }[] = [];
  let pathWeeks = 0;
  try {
    const [rows, path] = await Promise.all([
      db.skillGap.findMany({ where: { userId: session.user.id, severity: { in: ["CRITICAL", "HIGH"] } }, take: 4, orderBy: { gapSize: "desc" }, include: { competency: { select: { name: true } } } }),
      db.learningPath.findFirst({ where: { userId: session.user.id }, include: { items: true } }),
    ]);
    gaps = rows.map((r) => ({ name: r.competency.name, severity: r.severity }));
    pathWeeks = path ? Math.ceil(path.items.length / 2) : 0;
  } catch {}
  const firstName = session.user.name?.split(" ")[0] ?? "Officer";

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[1160px]">
        <div className="flex flex-wrap items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[10px]">
              <span className="size-8 rounded-[10px] bg-[color:var(--color-accent)] text-white grid place-items-center"> <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M10 3.5l2.2 2.2 3.3-.2-.2 3.3-2.2 2.2-2.2-2.2-.2-3.3 3.3.2-2.2-2.2Z" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="10" cy="14.5" r="1.4" fill="white"/></svg></span>
              <h1 className="text-[24px] font-[650] tracking-[-0.02em]">Tutor</h1>
              <span className="rounded-full bg-[#12B76A]/10 text-[#0E7A4B] border border-[#12B76A]/20 px-[10px] py-[4px] text-[11px] font-semibold tracking-wide">GROUNDED</span>
              <span className="hidden md:inline-flex rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[10px] py-[4px] text-[11px] tabular-mono text-muted-foreground">Synced to {gaps.length} gaps · {pathWeeks ? `${pathWeeks} weeks path` : "no path yet"}</span>
            </div>
            <p className="text-body text-muted-foreground mt-[8px] max-w-[68ch]">Hey {firstName} — your measurement-aware tutor. It retrieves only from trainer-uploaded material, cites every claim, and calibrates to your gaps. <span className="text-foreground font-medium">Out-of-scope = declined, never guessed.</span></p>
          </div>
          <div className="hidden lg:flex items-center gap-[10px] rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[8px] shadow-sm">
            <span className="size-2 rounded-full bg-[#12B76A] animate-pulse" />
            <span className="text-[11px] tabular-mono text-muted-foreground">Retrieval before generation</span>
            <span className="h-3 w-px bg-[color:var(--color-border-resting)]" />
            <span className="text-[11px] tabular-mono text-muted-foreground">Citations required</span>
          </div>
        </div>

        {gaps.length ? (
          <div className="rounded-[16px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[12px] flex flex-wrap items-center gap-[8px]">
            <span className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Calibrated to your gaps:</span>
            {gaps.map((g) => (
              <span key={g.name} className={`rounded-full px-[12px] py-[6px] text-[12px] font-medium border ${g.severity === "CRITICAL" ? "bg-[rgba(240,68,56,0.10)] text-[#C9190B] border-[rgba(240,68,56,0.18)]" : "bg-[rgba(247,144,9,0.12)] text-[#8A4D00] border-[rgba(247,144,9,0.18)]"}`}>{g.name} · {g.severity}</span>
            ))}
            <span className="ml-auto text-[11px] tabular-mono text-muted-foreground hidden md:inline">Tutor personalizes examples & checks to these</span>
          </div>
        ) : null}

        <TutorChat initialGaps={gaps.map((g) => g.name)} />
      </div>
    </AppShell>
  );
}
