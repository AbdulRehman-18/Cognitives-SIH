"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { AssessmentResults, type CompetencyResult } from "@/app/(learner)/assessment/[id]/assessment-results";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { HintButton } from "@/components/assessment/hint-button";

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
  resultsHref,
}: {
  assessmentId: string;
  questions: RunnerQuestion[];
  /** When set, a successful submit navigates here instead of rendering the
   * generic AssessmentResults screen inline — used by the onboarding
   * diagnostic to route straight to the partial gap report (PRD §5.4). */
  resultsHref?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<SubmitStatus>("answering");
  const [errorKind, setErrorKind] = React.useState<AiErrorKind>("NETWORK");
  const [results, setResults] = React.useState<CompetencyResult[] | null>(null);
  const [hintsUsed, setHintsUsed] = React.useState<Record<string, number>>({});

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
          hintsUsed,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKind((body.kind as AiErrorKind) ?? "NETWORK");
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { competencies: CompetencyResult[] };
      if (resultsHref) {
        router.push(resultsHref);
        return;
      }
      setResults(data.competencies);
      setStatus("done");
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
    }
  }, [assessmentId, answers, resultsHref, router]);

  // Keyboard navigation — use refs to avoid re-subscribing on every answer change.
  const stateRef = React.useRef({ status, current, answers, answeredCount, total, isLast });
  React.useEffect(() => { stateRef.current = { status, current, answers, answeredCount, total, isLast }; });
  const stableSelect = React.useRef(selectOption); React.useEffect(()=>{ stableSelect.current = selectOption; });
  const stableSubmit = React.useRef(submit); React.useEffect(()=>{ stableSubmit.current = submit; });
  const stableGoNext = React.useRef(goNext); React.useEffect(()=>{ stableGoNext.current = goNext; });
  const stableGoPrev = React.useRef(goPrev); React.useEffect(()=>{ stableGoPrev.current = goPrev; });

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { status: s, current: c, answers: a, answeredCount: ac, total: t, isLast: last } = stateRef.current;
      if (s !== "answering" || !c) return;
      const digit = Number(e.key);
      if (digit >= 1 && digit <= c.options.length) { stableSelect.current(c.options[digit - 1]); return; }
      const isArrowRight = e.key === "ArrowRight" || e.code === "ArrowRight";
      const isArrowLeft = e.key === "ArrowLeft" || e.code === "ArrowLeft";
      if (isArrowRight || (e.key === "Enter" && a[c.id])) {
        e.preventDefault();
        if (last) { if (ac === t) void stableSubmit.current(); }
        else if (a[c.id]) stableGoNext.current();
      }
      if (isArrowLeft) { e.preventDefault(); stableGoPrev.current(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
          <div className="pt-3 border-t border-border/60 mt-1">
            <HintButton questionId={current.id} attemptId={assessmentId} onHintUsed={(c)=> setHintsUsed(h=> ({...h, [current.id]: c}))} />
            {hintsUsed[current.id] ? <p className="text-[11px] text-muted-foreground mt-1.5">Hints on this question: {hintsUsed[current.id]} · affects competency score</p> : null}
          </div>
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
