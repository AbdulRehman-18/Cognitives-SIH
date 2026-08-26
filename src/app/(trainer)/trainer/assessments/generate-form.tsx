"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { Loader2 } from "lucide-react";

export interface DocumentOption {
  id: string;
  label: string;
}

export interface CompetencyOption {
  id: string;
  label: string;
}

/**
 * Trainer-facing form: pick a READY document + competency, choose count and
 * difficulty, and kick off RAG-grounded generation. Retrieval happens first
 * on the server (from the chosen document's own chunks), then generation —
 * never free-form from the model's general knowledge (RestPlan.md Phase 5).
 */
export function GenerateMcqForm({
  documents,
  competencies,
}: {
  documents: DocumentOption[];
  competencies: CompetencyOption[];
}) {
  const router = useRouter();
  const [documentId, setDocumentId] = React.useState(documents[0]?.id ?? "");
  const [competencyId, setCompetencyId] = React.useState(competencies[0]?.id ?? "");
  const [count, setCount] = React.useState(5);
  const [difficulty, setDifficulty] = React.useState<string>("");
  const [topic, setTopic] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "generating" | "error">("idle");
  const [errorKind, setErrorKind] = React.useState<AiErrorKind>("NETWORK");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const submit = React.useCallback(async () => {
    if (!documentId || !competencyId) return;
    setStatus("generating");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          competencyId,
          count,
          ...(difficulty ? { difficulty } : {}),
          ...(topic ? { topic } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKind((body.kind as AiErrorKind) ?? "NETWORK");
        setErrorMessage(body.error ?? null);
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { assessmentId: string };
      setStatus("idle");
      router.push(`/trainer/questions?assessmentId=${data.assessmentId}`);
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
    }
  }, [documentId, competencyId, count, difficulty, topic, router]);

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Upload and process a document first — RAG-grounded generation needs
        at least one document in <span className="text-foreground">READY</span> status.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document">Source document</Label>
          <Select value={documentId} onValueChange={(v) => setDocumentId(v ?? "")}>
            <SelectTrigger id="document">
              <SelectValue placeholder="Choose a document" />
            </SelectTrigger>
            <SelectContent>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="competency">Competency</Label>
          <Select value={competencyId} onValueChange={(v) => setCompetencyId(v ?? "")}>
            <SelectTrigger id="competency">
              <SelectValue placeholder="Choose a competency" />
            </SelectTrigger>
            <SelectContent>
              {competencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="count">Question count</Label>
          <Input
            id="count"
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="difficulty">Difficulty (optional)</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v ?? "")}>
            <SelectTrigger id="difficulty">
              <SelectValue placeholder="Vary naturally" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="topic">Focus topic (optional)</Label>
          <Input
            id="topic"
            placeholder="e.g. sampling error correction"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
      </div>

      {status === "error" ? (
        <AiErrorState kind={errorKind} onRetry={submit} />
      ) : errorMessage ? (
        <p className="text-xs text-[color:var(--color-critical)]">{errorMessage}</p>
      ) : null}

      <Button onClick={submit} disabled={status === "generating" || !documentId || !competencyId} className="self-start">
        {status === "generating" ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Generating…
          </>
        ) : (
          "Generate questions"
        )}
      </Button>
    </div>
  );
}
