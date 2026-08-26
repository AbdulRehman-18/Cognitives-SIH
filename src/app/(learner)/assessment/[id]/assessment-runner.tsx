"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { AssessmentResults, type CompetencyResult } from "@/app/(learner)/assessment/[id]/assessment-results";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface RunnerQuestion {
  id: string;
  stem: string;
  options: string[];
  competencyId: string;
  competencyName: string;
  domainName: string;
}

type SubmitStatus = "answering" | "submitting" | "error" | "done";

/**
 * Take-assessment flow: one question at a time, keyboard navigable (1-4 or
 * arrow keys to select, Enter to advance), a progress indicator, and no
 * timer pressure (PRD principle: non-judgmental, no gamification). Submit
 * hands raw answers to the server, where the deterministic Competency
 * Engine — never this component — computes the score.
 */
export function AssessmentRunner({
  assessmentId,
  questions,
}: {
  assessmentId: string;
  questions: RunnerQuestion[];
}) {
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<SubmitStatus>("answering");
  const [errorKind, setErrorKind] = React.useState<AiErrorKind>("NETWORK");
  const [results, setResults] = React.useState<CompetencyResult[] | null>(null);

  const current = questions[index];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const selected = current ? answers[current.id] : undefined;
  const isLast = index === total - 1;

  const selectOption = React.useCallback(
    (option: string) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: option }));
    },
    [current],
  );

  const goNext = React.useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const goPrev = React.useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const submit = React.useCallback(async () => {
    setStatus("submitting");
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({
            questionId,
            selectedAnswer,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKind((body.kind as AiErrorKind) ?? "NETWORK");
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { competencies: CompetencyResult[] };
      setResults(data.competencies);
      setStatus("done");
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
    }
  }, [assessmentId, answers]);

  // Keyboard navigation: digit keys 1-4 select an option, Enter/ArrowRight
  // advances (or submits on the last question), ArrowLeft goes back.
  React.useEffect(() => {
    if (status !== "answering" || !current) return;

    function onKeyDown(e: KeyboardEvent) {
      if (!current) return;
      const digit = Number(e.key);
      if (digit >= 1 && digit <= current.options.length) {
        selectOption(current.options[digit - 1]);
        return;
      }
      const isArrowRight = e.key === "ArrowRight" || e.code === "ArrowRight";
      const isArrowLeft = e.key === "ArrowLeft" || e.code === "ArrowLeft";

      if (isArrowRight || (e.key === "Enter" && answers[current.id])) {
        e.preventDefault();
        if (isLast) {
          if (answeredCount === total) void submit();
        } else if (answers[current.id]) {
          goNext();
        }
      }
      if (isArrowLeft) {
        e.preventDefault();
        goPrev();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, current, answers, answeredCount, total, isLast, selectOption, goNext, goPrev, submit]);

  if (status === "done" && results) {
    return <AssessmentResults results={results} />;
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16">
        <AiErrorState kind={errorKind} onRetry={submit} />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16">
        <p className="text-sm text-muted-foreground">This assessment has no questions.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {current.domainName} · {current.competencyName}
          </span>
          <span className="tabular-mono text-xs text-muted-foreground">
            {index + 1} / {total}
          </span>
        </div>
        <Progress value={((index + 1) / total) * 100} aria-label="Assessment progress">
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </div>

      <Card className="rounded-md">
        <CardContent className="flex flex-col gap-5">
          <fieldset>
            <legend className="text-base font-medium text-foreground">{current.stem}</legend>
            <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
              {current.options.map((option, i) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors",
                      isSelected
                        ? "border-[color:var(--color-measure)] bg-[color-mix(in_oklch,var(--color-measure),transparent_92%)]"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "tabular-mono flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                        isSelected
                          ? "border-[color:var(--color-measure)] bg-[color:var(--color-measure)] text-white"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-foreground">{option}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={goPrev} disabled={index === 0}>
          Back
        </Button>
        <span className="text-xs text-muted-foreground">
          {answeredCount} of {total} answered · use 1-{current.options.length} or click to
          select, arrow keys to move
        </span>
        {isLast ? (
          <Button
            onClick={submit}
            disabled={answeredCount !== total || status === "submitting"}
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Scoring…
              </>
            ) : (
              "Submit"
            )}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!selected}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
