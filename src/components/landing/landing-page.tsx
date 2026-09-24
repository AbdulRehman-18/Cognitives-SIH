/*
 * THESIS: The first viewport is the product measuring — four domain scales
 *   narrow from a role-profile estimate to measured ranges. Refuses the
 *   category default of a feature-card grid under a stock hero.
 * OWN-WORLD: The app's Caliper world: paper / charcoal surfaces, Archivo with
 *   Plex Mono numerals, hairline rules, tick scales, hatched gap bands, one
 *   blue measurement accent that owns the closing field.
 * STORY: An officer sees their gap measured, believes the route is explained
 *   rather than guessed, and starts a diagnostic.
 * FIRST VIEWPORT: Left 5/12: headline, one sentence, primary "Start your
 *   diagnostic" + "Sign in". Right 7/12: the calibration instrument at full
 *   scale, synthetic and labelled.
 * FORM: Live Calibration (surface roll 6c0dc28c, dealt index 1).
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalibrationInstrument } from "./calibration-instrument";
import { ThemeToggle } from "@/components/theme-toggle";

const STEPS = [
  {
    n: "01",
    title: "Measure",
    body: "A short adaptive diagnostic across the competencies your role actually needs. Questions get harder or easier as you answer, and anything you haven't been tested on stays marked as not yet assessed.",
    fragment: <MeasureFragment />,
  },
  {
    n: "02",
    title: "Diagnose",
    body: "Each gap is the distance between your measured level and the level your role requires. Severity and priority are computed from the numbers; the AI only writes the explanation.",
    fragment: <DiagnoseFragment />,
  },
  {
    n: "03",
    title: "Route",
    body: "One iGOT Karmayogi or NSSTA course per gap, ordered so prerequisites come first and paced to the hours you have each week. Every course says which gap it closes.",
    fragment: <RouteFragment />,
  },
  {
    n: "04",
    title: "Re-measure",
    body: "Completing a course on iGOT syncs back as evidence, and your level is recomputed. The gap either closes on the scale or it doesn't. No streaks, no badges.",
    fragment: <RemeasureFragment />,
  },
];

const DIVISIONS = [
  { name: "Survey Design", v: [42, 71, 58, 64] },
  { name: "National Accounts", v: [77, 63, 51, 69] },
  { name: "Price Statistics", v: [68, 49, 55, 72] },
  { name: "Labour Statistics", v: [59, 57, 38, 61] },
  { name: "Agricultural Statistics", v: [51, 44, 47, 66] },
  { name: "Industrial Statistics", v: [73, 66, 62, 58] },
];
const DOMAIN_SHORT = ["Statistical", "Technical", "Digital gov.", "Behavioural"];

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-[color:var(--color-canvas)] text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/85 backdrop-blur-md">
        <nav className="page-shell flex h-[60px] max-w-[1200px] items-center gap-[24px]" aria-label="Main">
          <Link href="/" className="flex items-center gap-[10px] text-[15px] font-semibold tracking-[-0.01em]">
            <Mark />
            SkillForge AI
          </Link>
          <div className="hidden items-center gap-[24px] text-[14px] text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            <a href="#tutor" className="transition-colors hover:text-foreground">Tutor</a>
            <a href="#managers" className="transition-colors hover:text-foreground">For training managers</a>
          </div>
          <div className="ml-auto flex items-center gap-[8px]">
            <ThemeToggle />
            <Link href="/sign-in" className="hidden rounded-[10px] px-[12px] py-[8px] text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
              Sign in
            </Link>
            <Link href="/sign-up" className="inline-flex items-center rounded-[10px] bg-[color:var(--color-ink)] px-[14px] py-[8px] text-[14px] font-medium text-[color:var(--color-canvas)] transition-opacity hover:opacity-90">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex flex-col">
        {/* Hero */}
        <section className="page-shell grid max-w-[1200px] grid-cols-1 items-center gap-x-[56px] gap-y-[48px] pb-[88px] pt-[56px] md:pt-[80px] lg:grid-cols-12 lg:pb-[112px]">
          <div className="flex flex-col gap-[28px] lg:col-span-5">
            <h1 className="text-balance text-[44px] font-[680] leading-[1.02] tracking-[-0.038em] sm:text-[56px] lg:text-[62px]">
              Measure the gap. Route the training. Prove it closed.
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-[1.6] text-muted-foreground">
              SkillForge measures statistical officers against MoSPI’s four-domain competency framework, then routes each gap to the one iGOT Karmayogi or NSSTA course that closes it.
            </p>
            <div className="flex flex-wrap items-center gap-[12px]">
              <Link href="/sign-up" className="group inline-flex items-center gap-[10px] rounded-[12px] bg-[color:var(--color-accent)] px-[20px] py-[13px] text-[15px] font-medium text-white shadow-[var(--shadow-cta)] outline-none transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-canvas)]">
                Start your diagnostic
                <ArrowRight className="size-[16px] transition-transform duration-[var(--duration-standard)] ease-[var(--ease-entrance)] group-hover:translate-x-[3px]" aria-hidden />
              </Link>
              <Link href="/sign-in" className="inline-flex items-center rounded-[12px] border border-[color:var(--color-border-hover)] px-[18px] py-[12px] text-[15px] font-medium transition-colors hover:bg-[color:var(--color-surface-1)]">
                Sign in
              </Link>
            </div>
            <p className="text-[13px] text-muted-foreground">
              For MoSPI officers and NSSTA training managers · Smart India Hackathon 2026, problem statement 26101
            </p>
          </div>
          <div className="lg:col-span-7">
            <CalibrationInstrument />
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-heading" className="scroll-mt-[72px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-sidebar-bg)]">
          <div className="page-shell flex max-w-[1200px] flex-col py-[88px] lg:py-[112px]">
            <div className="flex max-w-[640px] flex-col gap-[14px] pb-[56px]">
              <h2 id="how-heading" className="text-balance text-[34px] font-[650] leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
                One instrument, from first reading to proof.
              </h2>
              <p className="text-[16px] leading-[1.6] text-muted-foreground">
                Catalogue browsing asks officers to guess what they need. SkillForge measures first, and every step after that points back to the measurement.
              </p>
            </div>
            <ol className="flex flex-col border-t border-[color:var(--color-border-hover)]">
              {STEPS.map((s) => (
                <li key={s.n} className="grid grid-cols-1 gap-x-[56px] gap-y-[24px] border-b border-[color:var(--color-border-hover)] py-[40px] lg:grid-cols-12 lg:py-[48px]">
                  <div className="flex flex-col gap-[12px] lg:col-span-5">
                    <p className="num text-[13px] text-[color:var(--color-accent-ink)]">{s.n}</p>
                    <h3 className="text-[26px] font-[640] tracking-[-0.025em]">{s.title}</h3>
                    <p className="max-w-[48ch] text-[15px] leading-[1.65] text-muted-foreground">{s.body}</p>
                  </div>
                  <div className="lg:col-span-7">{s.fragment}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Tutor */}
        <section id="tutor" aria-labelledby="tutor-heading" className="scroll-mt-[72px] border-t border-[color:var(--color-border-resting)]">
          <div className="page-shell grid max-w-[1200px] grid-cols-1 items-center gap-x-[64px] gap-y-[40px] py-[88px] lg:grid-cols-12 lg:py-[112px]">
            <div className="flex flex-col gap-[16px] lg:col-span-5">
              <h2 id="tutor-heading" className="text-balance text-[34px] font-[650] leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
                A tutor that shows its sources.
              </h2>
              <p className="max-w-[46ch] text-[16px] leading-[1.6] text-muted-foreground">
                It answers from your trainers’ documents and your own notes first, and every claim links to the passage behind it. Anything your material doesn’t cover is labelled as general knowledge, and questions outside your coursework are declined.
              </p>
              <ul className="mt-[8px] flex flex-col border-t border-[color:var(--color-border-resting)] text-[14px]">
                {[
                  ["Explain", "a short explanation, then a check for understanding"],
                  ["Guide me", "Socratic, one question at a time"],
                  ["Quiz me", "a question drawn from your own material"],
                ].map(([m, d]) => (
                  <li key={m} className="flex gap-[12px] border-b border-[color:var(--color-border-resting)] py-[12px]">
                    <span className="w-[80px] shrink-0 font-medium">{m}</span>
                    <span className="text-muted-foreground">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <TutorFragment />
            </div>
          </div>
        </section>

        {/* Managers */}
        <section id="managers" aria-labelledby="managers-heading" className="scroll-mt-[72px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-sidebar-bg)]">
          <div className="page-shell grid max-w-[1200px] grid-cols-1 gap-x-[64px] gap-y-[40px] py-[88px] lg:grid-cols-12 lg:py-[112px]">
            <div className="flex flex-col gap-[16px] lg:col-span-4">
              <h2 id="managers-heading" className="text-balance text-[34px] font-[650] leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
                See where every division stands.
              </h2>
              <p className="text-[16px] leading-[1.6] text-muted-foreground">
                Training managers get coverage across the four domains for each division, and whether completed courses actually moved measured levels, without reading anyone’s individual answers.
              </p>
              <p className="text-[16px] leading-[1.6] text-muted-foreground">
                Trainers turn a PDF or slide deck into a reviewed ten-question assessment, with every question traced to the passage it came from.
              </p>
            </div>
            <div className="lg:col-span-8">
              <CoverageFragment />
            </div>
          </div>
        </section>

        {/* Principles */}
        <section aria-label="Principles" className="border-t border-[color:var(--color-border-resting)]">
          <ul className="page-shell grid max-w-[1200px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Ranges, not false precision", "Levels are measured ranges with the unassessed shown as unassessed."],
              ["Numbers are computed", "Scores, gaps and priority come from formulas. The AI writes words, never numbers."],
              ["Every route explains itself", "Each course names the gap it closes and why it comes when it does."],
              ["Treated as professionals", "No streaks, badges or points. Progress is a level that moved."],
            ].map(([t, d], k) => (
              <li key={t} className={`flex flex-col gap-[8px] border-[color:var(--color-border-resting)] py-[36px] sm:px-[24px] ${k > 0 ? "border-t sm:border-t-0 sm:border-l" : ""} ${k === 2 ? "sm:border-l-0 lg:border-l" : ""} ${k >= 2 ? "sm:border-t lg:border-t-0" : ""} first:sm:pl-0`}>
                <p className="text-[15px] font-semibold">{t}</p>
                <p className="text-[14px] leading-[1.6] text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Close */}
        <section aria-labelledby="close-heading" className="landing-close relative overflow-hidden bg-[color:var(--color-accent)] text-white">
          <div className="page-shell relative flex max-w-[1200px] flex-col items-start gap-[28px] py-[96px] lg:py-[128px]">
            <h2 id="close-heading" className="max-w-[16ch] text-balance text-[44px] font-[680] leading-[1.02] tracking-[-0.038em] sm:text-[60px]">
              Your first reading takes minutes.
            </h2>
            <p className="max-w-[52ch] text-[17px] leading-[1.6] text-white/80">
              Sign up with your designation and division, take the diagnostic, and your gaps and learning path are ready when you finish.
            </p>
            <div className="flex flex-wrap gap-[12px]">
              <Link href="/sign-up" className="group inline-flex items-center gap-[10px] rounded-[12px] bg-white px-[20px] py-[13px] text-[15px] font-medium text-[#141210] outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-accent)]">
                Start your diagnostic
                <ArrowRight className="size-[16px] transition-transform duration-[var(--duration-standard)] ease-[var(--ease-entrance)] group-hover:translate-x-[3px]" aria-hidden />
              </Link>
              <Link href="/sign-in" className="inline-flex items-center rounded-[12px] border border-white/35 px-[18px] py-[12px] text-[15px] font-medium text-white transition-colors hover:bg-white/10">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--color-border-resting)]">
        <div className="page-shell flex max-w-[1200px] flex-wrap items-center justify-between gap-[12px] py-[28px] text-[13px] text-muted-foreground">
          <span className="flex items-center gap-[10px] text-foreground"><Mark /> SkillForge AI</span>
          <span>Competency measurement and training routing for India’s Official Statistical System</span>
        </div>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px] text-[color:var(--color-accent-ink)]" aria-hidden>
      <path d="M2 6h16M5 6v5M10 6v9M15 6v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Step fragments: synthetic product excerpts, drawn in the app's own components' language ── */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border-resting)] px-[18px] py-[10px] text-[12px] text-muted-foreground">
        <span>{label}</span>
        <span>Example</span>
      </div>
      <div className="p-[18px] sm:p-[22px]">{children}</div>
    </div>
  );
}

function MeasureFragment() {
  const opts: React.ReactNode[] = [
    "Proportional to stratum size",
    "Equal allocation across strata",
    <>Proportional to <i className="font-serif">N<sub>h</sub>S<sub>h</sub></i> / √<i className="font-serif">c<sub>h</sub></i></>,
    "Proportional to stratum cost",
  ];
  return (
    <Frame label="Diagnostic · adaptive">
      <p className="text-[12px] text-muted-foreground">Survey Design · Sampling</p>
      <p className="mt-[8px] text-[16px] font-medium leading-[1.5]">
        Stratum sampling costs differ. Which allocation minimises variance for a fixed total cost?
      </p>
      <ul className="mt-[16px] flex flex-col gap-[8px]">
        {opts.map((o, k) => (
          <li key={k} className={`flex items-center gap-[12px] rounded-[10px] border px-[14px] py-[10px] text-[14px] ${k === 2 ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-15)]" : "border-[color:var(--color-border-resting)]"}`}>
            <span className={`num grid size-[22px] shrink-0 place-items-center rounded-[6px] text-[12px] ${k === 2 ? "bg-[color:var(--color-accent)] text-white" : "bg-[color:var(--color-canvas)] text-muted-foreground"}`}>{"ABCD"[k]}</span>
            {o}
          </li>
        ))}
      </ul>
      <p className="mt-[16px] text-[12px] text-muted-foreground">Next question adjusts to this answer.</p>
    </Frame>
  );
}

function MiniScale({ current, required, severity, after }: { current: number; required: number; severity: "c" | "h"; after?: number }) {
  const p = (l: number) => ((l - 1) / 4) * 100;
  const color = severity === "c" ? "var(--color-critical)" : "var(--color-moderate)";
  return (
    <div className="relative h-[16px] w-full" aria-hidden>
      <div className="absolute inset-x-0 top-[7px] h-px bg-[color:var(--color-border-hover)]" />
      {[1, 2, 3, 4, 5].map((l) => <span key={l} className="absolute top-[4px] h-[7px] w-px bg-[color:var(--color-ink-faint)]" style={{ left: `${p(l)}%` }} />)}
      <span className="landing-hatch absolute top-[4px] h-[7px]" style={{ left: `${p(after ?? current)}%`, width: `${p(required) - p(after ?? current)}%`, ["--hatch" as string]: color } as React.CSSProperties} />
      {after !== undefined && <span className="absolute top-[5px] h-[5px] rounded-full bg-[color:var(--color-grow)]/60" style={{ left: `${p(current)}%`, width: `${p(after) - p(current)}%` }} />}
      <span className="absolute top-0 h-[16px] w-[2px] -translate-x-1/2 rounded-full bg-[color:var(--color-accent)]" style={{ left: `${p(after ?? current)}%` }} />
      <span className="absolute top-0 h-[16px] -translate-x-1/2 border-l border-dashed border-[color:var(--color-ink)]" style={{ left: `${p(required)}%` }} />
    </div>
  );
}

function DiagnoseFragment() {
  const gaps = [
    { name: "Survey Design", c: 2, r: 4, s: "c" as const, label: "Critical" },
    { name: "Sampling Methods", c: 2, r: 4, s: "c" as const, label: "Critical" },
    { name: "Python for Data", c: 2, r: 4, s: "h" as const, label: "High" },
    { name: "Data Visualisation", c: 2, r: 3, s: "h" as const, label: "High" },
  ];
  return (
    <Frame label="Gap report">
      <ul className="flex flex-col">
        {gaps.map((g) => (
          <li key={g.name} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-x-[20px] gap-y-[6px] border-b border-[color:var(--color-border-resting)] py-[12px] first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[180px_minmax(0,1fr)_88px]">
            <span className="text-[14px] font-medium">{g.name}</span>
            <span className="order-last col-span-2 sm:order-none sm:col-span-1"><MiniScale current={g.c} required={g.r} severity={g.s} /></span>
            <span className="flex items-center justify-end gap-[6px] text-[12px] text-muted-foreground">
              <span className="size-[6px] rounded-full" style={{ background: g.s === "c" ? "var(--color-critical)" : "var(--color-moderate)" }} />
              <span className="num">L{g.c}→L{g.r}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-[16px] rounded-[10px] bg-[color:var(--color-canvas)]/60 px-[14px] py-[10px] text-[13px] leading-[1.55] text-muted-foreground">
        <span className="text-foreground">Why critical:</span> your role requires level 4 in Survey Design and you measured at 2. Priority = gap size × role weight × division priority.
      </p>
    </Frame>
  );
}

function RouteFragment() {
  const segs = [{ h: 6, s: "done" }, { h: 12, s: "next" }, { h: 8, s: "todo" }, { h: 3, s: "todo" }];
  const rows = [
    ["Nuances of Data Collection", "iGOT · 6h", "Survey Design L1→L4", "done"],
    ["Sampling Techniques & Large Scale Surveys", "NSSTA · 12h", "after Survey Design", "next"],
    ["Python for Official Statistics", "iGOT · 8h", "Python for Data L2→L4", "todo"],
  ];
  return (
    <Frame label="Learning path · 5h a week">
      <div className="flex h-[8px] gap-[2px]">
        {segs.map((s, k) => (
          <span key={k} className={`rounded-[2px] ${s.s === "done" ? "bg-[color:var(--color-grow)]" : "bg-[color:var(--color-border-hover)]"} ${s.s === "next" ? "ring-1 ring-[color:var(--color-accent)] ring-offset-2 ring-offset-[color:var(--color-surface-1)]" : ""}`} style={{ flexGrow: s.h, flexBasis: 0 }} />
        ))}
      </div>
      <div className="num mt-[6px] flex justify-between text-[10px] text-muted-foreground"><span>W1</span><span>W3</span><span>W6</span><span>W8</span></div>
      <ul className="mt-[16px] flex flex-col">
        {rows.map(([t, m, g, s]) => (
          <li key={t} className="flex items-start gap-[12px] border-b border-[color:var(--color-border-resting)] py-[12px] last:border-b-0 last:pb-0">
            <span className={`mt-[3px] grid size-[16px] shrink-0 place-items-center rounded-full ${s === "done" ? "bg-[color:var(--color-grow)]" : s === "next" ? "ring-2 ring-[color:var(--color-accent)]" : "ring-1 ring-[color:var(--color-ink-faint)]"}`} aria-hidden>
              {s === "done" && <svg viewBox="0 0 16 16" className="size-[16px]"><path d="M4.8 8.2l2 2 4.4-4.4" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className={`text-[14px] font-medium ${s === "done" ? "text-muted-foreground" : ""}`}>{t}</span>
              <span className="text-[12px] text-muted-foreground">{m} · {g}</span>
            </div>
            <span className={`shrink-0 text-[12px] ${s === "done" ? "text-[color:var(--color-grow)]" : s === "next" ? "text-[color:var(--color-accent-ink)]" : "text-muted-foreground"}`}>{s === "done" ? "Completed" : s === "next" ? "Up next" : "Week 6"}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function RemeasureFragment() {
  return (
    <Frame label="Survey Design · after iGOT completion">
      <div className="flex flex-col gap-[18px]">
        {[
          { label: "Before", note: "Diagnostic, 2 Sept", c: 2, a: undefined },
          { label: "After", note: "Course completed and synced, 23 Sept", c: 2, a: 3 },
        ].map((r) => (
          <div key={r.label} className="flex flex-col gap-[8px]">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground">{r.note} · <span className="num text-foreground">L{r.a ?? r.c}</span></span>
            </div>
            <MiniScale current={r.c} required={4} severity="c" after={r.a} />
          </div>
        ))}
        <p className="flex items-center gap-[10px] rounded-[10px] bg-[color:var(--color-grow-bg)] px-[14px] py-[10px] text-[13px]">
          <span className="size-[6px] shrink-0 rounded-full bg-[color:var(--color-grow)]" aria-hidden />
          Gap narrowed from two levels to one. Next on your path: Sampling Techniques.
        </p>
      </div>
    </Frame>
  );
}

function TutorFragment() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-1)] shadow-[0_24px_64px_-28px_rgba(20,18,16,0.35)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border-resting)] px-[18px] py-[10px]">
        <div className="flex rounded-[9px] bg-[color:var(--color-canvas)] p-[3px] text-[12px]">
          <span className="rounded-[7px] bg-[color:var(--color-surface-2)] px-[10px] py-[4px] font-medium shadow-[0_0_0_1px_var(--color-border-resting)]">Explain</span>
          <span className="px-[10px] py-[4px] text-muted-foreground">Guide me</span>
          <span className="px-[10px] py-[4px] text-muted-foreground">Quiz me</span>
        </div>
        <span className="text-[12px] text-muted-foreground">Example</span>
      </div>
      <div className="flex flex-col gap-[20px] p-[20px] sm:p-[24px]">
        <p className="ml-auto max-w-[80%] rounded-[14px] rounded-br-[4px] bg-[color:var(--color-canvas)] px-[14px] py-[10px] text-[14px] leading-[1.55]">
          Why is the design effect greater than 1 for cluster samples?
        </p>
        <div className="flex flex-col gap-[10px]">
          <p className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Tutor</span>
            <span className="inline-flex items-center gap-[5px] rounded-[6px] border border-[color:var(--color-border-resting)] px-[6px] py-[1px] text-[11px]"><span className="size-[5px] rounded-full bg-[color:var(--color-grow)]" />Sourced · 2 passages</span>
          </p>
          <p className="text-[15px] leading-[1.7]">
            Units within a cluster tend to resemble each other, so each extra unit adds less new information than an independent draw would <Cite n={1} />. The design effect measures that loss: it is roughly <span className="whitespace-nowrap font-serif italic">1 + (m − 1)ρ</span>, where <i className="font-serif">m</i> is the cluster size and <i className="font-serif">ρ</i> the intra-cluster correlation <Cite n={2} />.
          </p>
          <p className="text-[14px] font-medium">Check: what happens to the design effect if ρ is close to zero?</p>
        </div>
        <ol className="flex flex-col overflow-hidden rounded-[12px] border border-[color:var(--color-border-resting)] text-[13px]">
          {[["NSS Sampling Design Manual.pdf", "passage 14", 86], ["Cluster Sampling — NSSTA notes", "passage 3", 81]].map(([d, p, m], k) => (
            <li key={d as string} className="flex items-center gap-[10px] border-b border-[color:var(--color-border-resting)] px-[12px] py-[9px] last:border-b-0">
              <span className="num grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent-15)] text-[10.5px] text-[color:var(--color-accent-ink)]">{k + 1}</span>
              <span className="min-w-0 flex-1 truncate">{d} <span className="text-muted-foreground">· {p}</span></span>
              <span className="num text-[11px] text-muted-foreground">{m}% match</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Cite({ n }: { n: number }) {
  return (
    <span className="num mx-[1px] inline-grid h-[17px] min-w-[17px] -translate-y-[1px] place-items-center rounded-[5px] border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent-15)] px-[4px] align-baseline text-[10.5px] text-[color:var(--color-accent-ink)]">{n}</span>
  );
}

function CoverageFragment() {
  return (
    <Frame label="Division coverage · share of officers at role level">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-[4px] text-[13px]">
          <thead>
            <tr>
              <th className="pb-[6px] text-left font-normal text-muted-foreground" scope="col"><span className="sr-only">Division</span></th>
              {DOMAIN_SHORT.map((d) => <th key={d} scope="col" className="pb-[6px] text-left text-[12px] font-normal text-muted-foreground">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {DIVISIONS.map((row) => (
              <tr key={row.name}>
                <th scope="row" className="whitespace-nowrap pr-[12px] text-left font-medium">{row.name}</th>
                {row.v.map((v, k) => (
                  <td key={k} className="relative h-[40px] overflow-hidden rounded-[6px] bg-[color:var(--color-canvas)]">
                    <span className="absolute inset-y-0 left-0 rounded-[6px]" style={{ width: `${v}%`, background: v < 50 ? "var(--color-moderate-bg)" : "var(--color-accent-15)" }} />
                    <span className={`num relative pl-[10px] text-[12px] ${v < 50 ? "text-[color:var(--color-moderate)]" : "text-foreground"}`}>{v}%</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-[12px] text-[12px] text-muted-foreground">Example figures. Cells under 50% shown in amber.</p>
    </Frame>
  );
}
