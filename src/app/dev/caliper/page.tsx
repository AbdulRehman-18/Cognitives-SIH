"use client";

import { CaliperGauge } from "@/components/caliper/caliper-gauge";
import { ScoreReadout } from "@/components/caliper/score-readout";
import { DomainMatrix } from "@/components/caliper/domain-matrix";
import { GapCard } from "@/components/caliper/gap-card";
import { EvidenceDrawer } from "@/components/caliper/evidence-drawer";
import { AiErrorState } from "@/components/caliper/ai-error-state";
import { ProcessingState } from "@/components/caliper/processing-state";
import { ThemeToggle } from "@/components/theme-toggle";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-border pb-10">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function CaliperDemoPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            The Caliper — component review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dev-only route. Every Phase 1 primitive, both themes.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section
        title="CaliperGauge"
        description="Horizontal instrument scale: calibration ticks, current-value jaw, target marker, shaded gap band, and a dashed 'Not yet assessed' state."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CaliperGauge label="Survey Design" value={62} target={85} severity="high" unitLabel="of 100" />
          <CaliperGauge label="Sampling" value={78} target={80} severity="low" unitLabel="of 100" />
          <CaliperGauge label="Python" value={40} target={90} severity="critical" unitLabel="of 100" />
          <CaliperGauge label="Cybersecurity" value={null} target={70} unitLabel="of 100" />
        </div>
      </Section>

      <Section title="ScoreReadout" description="Tabular-mono number with confidence range — never a bare percentage headline.">
        <div className="flex flex-wrap gap-8">
          <ScoreReadout label="Data Quality Frameworks" level={3.4} confidenceLabel="± 0.3, based on 4 evidence rows" size="large" />
          <ScoreReadout label="GIS" level={2.1} confidenceLabel="± 0.6, based on 1 evidence row" />
          <ScoreReadout label="Cloud Computing" level={null} />
        </div>
      </Section>

      <Section title="DomainMatrix" description="The 4-domain grid, tint-encoded on the same measure-to-gap ramp used everywhere else.">
        <DomainMatrix
          domains={[
            { domainCode: "STATISTICAL", domainName: "Statistical", level: 3.6, competencyCount: 10, assessedCount: 8 },
            { domainCode: "TECHNICAL", domainName: "Technical", level: 2.4, competencyCount: 12, assessedCount: 5 },
            { domainCode: "DIGITAL_GOVERNANCE", domainName: "Digital Governance", level: null, competencyCount: 5, assessedCount: 0 },
            { domainCode: "BEHAVIOURAL", domainName: "Behavioural", level: 4.1, competencyCount: 6, assessedCount: 6 },
          ]}
        />
      </Section>

      <Section title="GapCard" description="Severity chip, gauge, LLM-authored reason (generated after severity is fixed), and one primary action.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GapCard
            competencyName="Python"
            domainName="Technical"
            currentLevel={1}
            requiredLevel={4}
            severity="CRITICAL"
            reason="This is the largest gap against your role's target profile, and Python underlies several other technical competencies — closing it first will have the broadest downstream effect."
            onPrimaryAction={() => {}}
          />
          <GapCard
            competencyName="Communication"
            domainName="Behavioural"
            currentLevel={3}
            requiredLevel={4}
            severity="LOW"
            reason="You're close to the target range here — a short module would close this comfortably."
            onPrimaryAction={() => {}}
          />
        </div>
      </Section>

      <Section title="EvidenceDrawer" description="The judge-facing feature — opens from any score to show the exact evidence rows and the formula that combined them.">
        <EvidenceDrawer
          competencyName="Survey Design"
          currentScore={3.4}
          evidence={[
            {
              id: "1",
              sourceType: "ASSESSMENT",
              sourceLabel: "Diagnostic assessment, Aug 2026",
              contribution: 3.6,
              weight: 0.6,
              createdAt: "2026-08-20T10:00:00Z",
            },
            {
              id: "2",
              sourceType: "PRIOR_TRAINING",
              sourceLabel: "NSSTA — Survey Methodology (2024)",
              contribution: 3.0,
              weight: 0.25,
              createdAt: "2024-11-02T10:00:00Z",
            },
          ]}
        />
      </Section>

      <Section title="AiErrorState" description="Typed error + retry affordance for every AI surface — never a blank screen or a hung spinner.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AiErrorState kind="RATE_LIMIT" onRetry={() => {}} />
          <AiErrorState kind="TIMEOUT" onRetry={() => {}} />
          <AiErrorState kind="INVALID_RESPONSE" onRetry={() => {}} />
          <AiErrorState kind="NETWORK" onRetry={() => {}} />
        </div>
      </Section>

      <Section title="ProcessingState" description="Real staged progress for document processing, with an explicit failure stage.">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ProcessingState
            stages={[
              { key: "EXTRACTING", label: "Extracting text" },
              { key: "CHUNKING", label: "Chunking" },
              { key: "EMBEDDING", label: "Generating embeddings" },
              { key: "READY", label: "Ready" },
            ]}
            currentStageKey="EMBEDDING"
          />
          <ProcessingState
            stages={[
              { key: "EXTRACTING", label: "Extracting text" },
              { key: "CHUNKING", label: "Chunking" },
              { key: "EMBEDDING", label: "Generating embeddings" },
              { key: "READY", label: "Ready" },
            ]}
            currentStageKey="CHUNKING"
            failed
            errorMessage="Chunking failed: document contains no extractable text (scanned image without OCR layer)."
          />
        </div>
      </Section>
    </div>
  );
}
