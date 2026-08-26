"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SourceChunkCard } from "@/components/caliper/source-chunk-card";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewQuestion {
  id: string;
  stem: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  difficulty: number;
  reviewStatus: "DRAFT" | "APPROVED" | "REJECTED";
  competencyName: string;
  sourceChunk: { chunkIndex: number; content: string } | null;
}

const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * One question in the trainer review queue: edit stem/options/answer/
 * explanation inline, with the originating SourceChunkCard shown right
 * beside it — this is what makes "every question is traceable" (PRD §4.7)
 * a visible fact a trainer can check, not merely a hidden foreign key.
 * Nothing publishes unreviewed: only Approve moves a question toward
 * eligibility for a published assessment.
 */
export function QuestionReviewCard({ question }: { question: ReviewQuestion }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [stem, setStem] = React.useState(question.stem);
  const [options, setOptions] = React.useState(question.options);
  const [correctAnswer, setCorrectAnswer] = React.useState(question.correctAnswer);
  const [explanation, setExplanation] = React.useState(question.explanation ?? "");
  const [saving, setSaving] = React.useState<"save" | "APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const patch = React.useCallback(
    async (body: Record<string, unknown>, kind: "save" | "APPROVED" | "REJECTED") => {
      setSaving(kind);
      setError(null);
      try {
        const res = await fetch(`/api/questions/${question.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not save changes.");
          return;
        }
        if (kind === "save") setEditing(false);
        router.refresh();
      } finally {
        setSaving(null);
      }
    },
    [question.id, router],
  );

  const statusVariant =
    question.reviewStatus === "APPROVED"
      ? "default"
      : question.reviewStatus === "REJECTED"
        ? "destructive"
        : "secondary";

  return (
    <Card className="rounded-md">
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {question.competencyName}
            </span>
            <Badge variant={statusVariant}>{question.reviewStatus}</Badge>
          </div>
          <span className="tabular-mono text-xs text-muted-foreground">
            difficulty {question.difficulty.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            {editing ? (
              <>
                <textarea
                  className={cn(textareaClass, "min-h-16")}
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={correctAnswer === opt}
                        onChange={() => setCorrectAnswer(opt)}
                        aria-label={`Mark option ${i + 1} correct`}
                      />
                      <input
                        className={textareaClass}
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          const wasCorrect = correctAnswer === opt;
                          next[i] = e.target.value;
                          setOptions(next);
                          if (wasCorrect) setCorrectAnswer(e.target.value);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  className={cn(textareaClass, "min-h-12")}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explanation"
                />
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">{question.stem}</p>
                <ul className="flex flex-col gap-1.5">
                  {question.options.map((opt) => (
                    <li
                      key={opt}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-sm",
                        opt === question.correctAnswer
                          ? "border-[color:var(--color-target)] bg-[color-mix(in_oklch,var(--color-target),transparent_92%)] text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {opt}
                      {opt === question.correctAnswer ? (
                        <span className="ml-2 text-[11px] text-[color:var(--color-target)]">correct</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {question.explanation ? (
                  <p className="text-xs text-muted-foreground">{question.explanation}</p>
                ) : null}
              </>
            )}
          </div>

          {question.sourceChunk ? (
            <SourceChunkCard chunkIndex={question.sourceChunk.chunkIndex} content={question.sourceChunk.content} />
          ) : (
            <p className="text-xs text-[color:var(--color-critical)]">
              No source chunk on record — this question should not have been persisted.
            </p>
          )}
        </div>

        {error ? <p className="text-xs text-[color:var(--color-critical)]">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <Button
              size="sm"
              onClick={() => patch({ stem, options, correctAnswer, explanation }, "save")}
              disabled={saving === "save"}
            >
              {saving === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => patch({ reviewStatus: "APPROVED" }, "APPROVED")}
            disabled={saving === "APPROVED" || question.reviewStatus === "APPROVED"}
            className="border-[color:var(--color-target)]/40 text-[color:var(--color-target)] hover:bg-[color-mix(in_oklch,var(--color-target),transparent_92%)]"
          >
            <Check className="size-3.5" aria-hidden />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => patch({ reviewStatus: "REJECTED" }, "REJECTED")}
            disabled={saving === "REJECTED" || question.reviewStatus === "REJECTED"}
            className="border-[color:var(--color-critical)]/40 text-[color:var(--color-critical)] hover:bg-[color-mix(in_oklch,var(--color-critical),transparent_92%)]"
          >
            <X className="size-3.5" aria-hidden />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
