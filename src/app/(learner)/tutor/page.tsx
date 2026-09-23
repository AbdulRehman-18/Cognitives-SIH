import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { TutorChat, type TutorGap } from "./tutor-chat";
import { db } from "@/lib/db/client";
import { MyMaterials } from "@/components/learner/my-materials";
import { LevelScale } from "@/components/caliper/level-scale";
import { getDictionary } from "@/i18n/server";

const PIPELINE = [
  { title: "Retrieve", body: "Your material is searched before a word is written." },
  { title: "Cite", body: "Claims taken from it carry a marker back to the passage." },
  { title: "Label", body: "Anything your material doesn’t cover is marked as general knowledge." },
  { title: "Decline", body: "Questions outside your coursework are turned down." },
]

export default async function TutorPage() {
  const session = await requireRole("LEARNER");
  let gaps: TutorGap[] = [];
  try {
    const rows = await db.skillGap.findMany({
      where: { userId: session.user.id, severity: { in: ["CRITICAL", "HIGH"] } },
      take: 4,
      orderBy: [{ severity: "asc" }, { gapSize: "desc" }],
      include: { competency: { select: { name: true } } },
    });
    gaps = rows.map((r) => ({ name: r.competency.name, severity: r.severity, current: r.currentLevel, required: r.requiredLevel }));
  } catch {}
  const personalDocuments = await db.document.findMany({
    where: { ownerId: session.user.id, scope: "PERSONAL" },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, processingStatus: true, chunkCount: true, createdAt: true },
  });
  const { locale, t } = await getDictionary();

  return (
    <div className="page-shell flex max-w-[1200px] flex-col gap-[20px] py-[24px] md:py-[28px]">
      <header className="flex flex-wrap items-baseline gap-x-[16px] gap-y-[4px]">
        <h1 className="text-[26px] font-[650] leading-[1.1] tracking-[-0.025em]">{t.tutor.title}</h1>
        <p className="text-[14px] leading-[1.5] text-muted-foreground">{t.tutor.intro}</p>
      </header>

      <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[minmax(0,1fr)_264px] lg:gap-[36px]">
        <TutorChat gaps={gaps} initialLanguage={locale === "hi" ? "hi" : "en"} />

        <aside className="flex flex-col gap-[28px] lg:pt-[2px]">
          <RailSection title="Focus areas" note="From your last assessment.">
            {gaps.length ? (
              <ul className="flex flex-col">
                {gaps.map((g) => (
                  <li key={g.name} className="flex flex-col gap-[6px] border-b border-[color:var(--color-border-resting)] py-[10px] first:pt-[2px] last:border-b-0">
                    <div className="flex items-baseline justify-between gap-[10px]">
                      <span className="text-[13px] leading-[1.4] text-foreground">{g.name}</span>
                      <span className="num shrink-0 text-[11px] text-muted-foreground">L{g.current}→L{g.required}</span>
                    </div>
                    <LevelScale current={g.current} required={g.required} severity={g.severity} label={g.name} width={260} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-[1.5] text-muted-foreground">
                No gaps measured yet.{" "}
                <Link href="/assessment/new" className="font-medium text-foreground underline decoration-[color:var(--color-border-hover)] underline-offset-4 hover:decoration-[color:var(--color-accent)]">
                  Take a diagnostic
                </Link>{" "}
                so sessions can start from your level.
              </p>
            )}
          </RailSection>

          <MyMaterials initialDocuments={personalDocuments.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />

          <RailSection title="How answers are sourced">
            <ol className="relative flex flex-col gap-[14px] pl-[18px]">
              <span className="absolute bottom-[8px] left-[3.5px] top-[8px] w-px bg-[color:var(--color-border-hover)]" aria-hidden />
              {PIPELINE.map((step) => (
                <li key={step.title} className="relative flex flex-col gap-[2px]">
                  <span className="absolute left-[-18px] top-[7px] h-px w-[8px] bg-[color:var(--color-ink-faint)]" aria-hidden />
                  <span className="text-[13px] font-medium text-foreground">{step.title}</span>
                  <span className="text-[12px] leading-[1.5] text-muted-foreground">{step.body}</span>
                </li>
              ))}
            </ol>
          </RailSection>
        </aside>
      </div>
    </div>
  );
}

function RailSection({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[12px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}
