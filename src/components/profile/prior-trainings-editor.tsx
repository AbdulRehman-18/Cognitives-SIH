"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompetencyOption {
  id: string;
  name: string;
  domainName: string;
}

export interface TrainingDraft {
  title: string;
  provider: string;
  completedMonth: string;
  competencyIds: string[];
}

const emptyDraft = (): TrainingDraft => ({ title: "", provider: "", completedMonth: "", competencyIds: [] });

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Repeater for previous trainings. Controlled: the parent owns the list and
 * submits it (onboarding serialises it into a hidden JSON field). Each entry
 * is tagged with framework competencies, which is what lets the Competency
 * Engine compute its relevance deterministically.
 */
export function PriorTrainingsEditor({
  competencies,
  value,
  onChange,
  maxMonth,
}: {
  competencies: CompetencyOption[];
  value: TrainingDraft[];
  onChange: (next: TrainingDraft[]) => void;
  /** "YYYY-MM" upper bound for the month picker (today's month). */
  maxMonth: string;
}) {
  const [pickerValue, setPickerValue] = useState<Record<number, string>>({});
  const nameById = new Map(competencies.map((c) => [c.id, c.name]));
  const domains = [...new Set(competencies.map((c) => c.domainName))];

  const update = (index: number, patch: Partial<TrainingDraft>) =>
    onChange(value.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <div className="flex flex-col gap-3">
      {value.map((training, index) => (
        <div key={index} className="relative flex flex-col gap-2 rounded-lg border border-[color:var(--color-border-resting)] p-3">
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            aria-label={`Remove training ${index + 1}`}
          >
            <X className="size-4" aria-hidden />
          </button>
          <input
            className={cn(fieldClass, "pr-8")}
            placeholder="Training title, e.g. Advanced Sampling Techniques"
            value={training.title}
            onChange={(e) => update(index, { title: e.target.value })}
            aria-label={`Training ${index + 1} title`}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={fieldClass}
              placeholder="Provider (optional)"
              value={training.provider}
              onChange={(e) => update(index, { provider: e.target.value })}
              aria-label={`Training ${index + 1} provider`}
            />
            <input
              type="month"
              className={fieldClass}
              max={maxMonth}
              value={training.completedMonth}
              onChange={(e) => update(index, { completedMonth: e.target.value })}
              aria-label={`Training ${index + 1} completion month`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {training.competencyIds.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--color-accent)]">
                {nameById.get(id) ?? id}
                <button
                  type="button"
                  onClick={() => update(index, { competencyIds: training.competencyIds.filter((c) => c !== id) })}
                  aria-label={`Untag ${nameById.get(id) ?? "competency"}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
            <select
              className="h-7 rounded-full border border-input bg-transparent px-2 text-xs dark:bg-input/30"
              value={pickerValue[index] ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id && !training.competencyIds.includes(id)) update(index, { competencyIds: [...training.competencyIds, id] });
                setPickerValue((p) => ({ ...p, [index]: "" }));
              }}
              aria-label={`Tag a competency for training ${index + 1}`}
            >
              <option value="">+ Tag competency covered</option>
              {domains.map((domain) => (
                <optgroup key={domain} label={domain}>
                  {competencies
                    .filter((c) => c.domainName === domain && !training.competencyIds.includes(c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, emptyDraft()])}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-[color:var(--color-border-resting)] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" aria-hidden /> Add a previous training
      </button>
    </div>
  );
}
