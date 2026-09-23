"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { PriorTrainingsEditor, type CompetencyOption, type TrainingDraft } from "@/components/profile/prior-trainings-editor";
import { EDUCATION_LEVELS } from "@/lib/validation/onboarding";
import { addTrainingsAction, deletePriorTrainingAction, importIgotAction, updateBackgroundAction, type ProfileActionResult } from "./actions";

export interface TrainingRow {
  id: string;
  kind: "PRIOR_SELF" | "PRIOR_IGOT" | "IGOT_COMPLETION";
  title: string;
  detail: string;
  competencies: string[];
  deletable: boolean;
}

const KIND_LABEL: Record<TrainingRow["kind"], string> = {
  PRIOR_SELF: "Self-declared",
  PRIOR_IGOT: "Imported from iGOT",
  IGOT_COMPLETION: "Completed on iGOT",
};

function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ProfileActionResult | null>(null);
  const run = (fn: () => Promise<ProfileActionResult>, onOk?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onOk?.();
    });
  return { pending, result, run };
}

const Feedback = ({ result }: { result: ProfileActionResult | null }) =>
  result ? (
    <p role="status" className={`text-[12px] ${result.ok ? "text-muted-foreground" : "text-[color:var(--color-critical)]"}`}>{result.message}</p>
  ) : null;

export function TrainingRecord({ rows, competencies, maxMonth }: { rows: TrainingRow[]; competencies: CompetencyOption[]; maxMonth: string }) {
  const [drafts, setDrafts] = useState<TrainingDraft[]>([]);
  const { pending, result, run } = useAction();

  return (
    <section className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px] flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-baseline justify-between gap-[8px]">
        <div>
          <h2 className="text-[13px] font-[650]">Training record</h2>
          <p className="text-[12px] text-muted-foreground mt-[2px]">Evidence for your competency scores, weighted by relevance and recency.</p>
        </div>
        <button type="button" disabled={pending} onClick={() => run(importIgotAction)} className="rounded-full border border-[color:var(--color-border-resting)] px-[12px] py-[6px] text-[12px] font-semibold hover:bg-[color:var(--color-canvas)] disabled:opacity-50">
          {pending ? "Working…" : "Import from iGOT"}
        </button>
      </div>

      {rows.length ? (
        <ul className="flex flex-col divide-y divide-[color:var(--color-border-resting)]">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-[10px] py-[8px]">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{row.title}</p>
                <p className="text-[11px] tabular-mono text-muted-foreground">{KIND_LABEL[row.kind]} · {row.detail}</p>
                {row.competencies.length > 0 && <p className="text-[11px] text-muted-foreground mt-[2px]">Covers: {row.competencies.join(", ")}</p>}
              </div>
              {row.deletable && (
                <button type="button" disabled={pending} onClick={() => run(() => deletePriorTrainingAction(row.id))} aria-label={`Remove ${row.title}`} className="rounded-full p-[6px] text-muted-foreground hover:text-foreground disabled:opacity-50">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-foreground">No training on record yet.</p>
      )}

      <PriorTrainingsEditor competencies={competencies} value={drafts} onChange={setDrafts} maxMonth={maxMonth} />
      {drafts.length > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => addTrainingsAction(drafts.map((d) => ({ ...d, provider: d.provider || undefined }))), () => setDrafts([]))}
          className="w-fit rounded-full bg-[color:var(--color-accent)] px-[14px] py-[7px] text-[12px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save ${drafts.length} training${drafts.length === 1 ? "" : "s"}`}
        </button>
      )}
      <Feedback result={result} />
    </section>
  );
}

export function BackgroundForm({ initial }: { initial: { education: string; educationField: string; yearsExperience: string; currentAssignment: string } }) {
  const [values, setValues] = useState(initial);
  const { pending, result, run } = useAction();
  const input = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] outline-none dark:bg-input/30";
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-[10px]"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBackgroundAction(values));
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
        <label className="flex flex-col gap-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Qualification
          <select className={input} value={values.education} onChange={set("education")}>
            <option value="">—</option>
            {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Field of study
          <input className={input} value={values.educationField} onChange={set("educationField")} />
        </label>
        <label className="flex flex-col gap-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Years of service
          <input className={input} type="number" min={0} max={45} value={values.yearsExperience} onChange={set("yearsExperience")} />
        </label>
        <label className="flex flex-col gap-[4px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Current assignment
          <input className={input} value={values.currentAssignment} onChange={set("currentAssignment")} />
        </label>
      </div>
      <div className="flex items-center gap-[10px]">
        <button type="submit" disabled={pending} className="rounded-full bg-[color:var(--color-ink)] px-[14px] py-[7px] text-[12px] font-semibold text-[color:var(--color-canvas)] disabled:opacity-50">{pending ? "Saving…" : "Save background"}</button>
        <Feedback result={result} />
      </div>
    </form>
  );
}
