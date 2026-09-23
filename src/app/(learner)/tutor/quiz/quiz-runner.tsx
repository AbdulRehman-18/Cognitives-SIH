"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { SourceChunkCard } from "@/components/caliper/source-chunk-card";
import { cn } from "@/lib/utils";

interface Citation { chunkIndex: number; content: string; similarity: number; documentTitle?: string }
interface QuizQuestion { id: string; stem: string; options: string[]; correctAnswer: string; explanation: string | null; citation: Citation | null }
interface QuizPayload { assessmentId: string; competencyName: string; questions: QuizQuestion[] }
interface QuizConfig { competencyId: string; topic: string; documentId: string; language: "en" | "hi" }

type GenerateResult = { kind: "quiz"; quiz: QuizPayload } | { kind: "refused"; reason: string };

async function generateQuiz(config: QuizConfig, signal?: AbortSignal): Promise<GenerateResult> {
  const res = await fetch("/api/tutor/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      competencyId: config.competencyId,
      topic: config.topic.trim() || undefined,
      documentId: config.documentId || undefined,
      count: 5,
      language: config.language,
    }),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't generate a quiz. Try again.");
  if (data.refused) return { kind: "refused", reason: data.reason };
  return { kind: "quiz", quiz: data as QuizPayload };
}

const needsMath = (s: string) => s.includes("$") || s.includes("\\");
const Rich = ({ text }: { text: string }) => (needsMath(text) ? <Markdown>{text}</Markdown> : <span>{text}</span>);

export default function QuizRunner({
  initialTopic,
  competencies,
  documents,
  sharedDocumentCount,
}: {
  initialTopic: string;
  competencies: { id: string; name: string; note: string | null }[];
  documents: { id: string; label: string }[];
  sharedDocumentCount: number;
}) {
  const [config, setConfig] = useState<QuizConfig>({ competencyId: competencies[0]?.id ?? "", topic: initialTopic, documentId: "", language: "en" });
  // Start loading immediately when arriving from the tutor's "Quiz me" with a topic.
  const autoStart = Boolean(initialTopic.trim() && competencies.length);
  const [loading, setLoading] = useState(autoStart);
  const [error, setError] = useState("");
  const [refusal, setRefusal] = useState("");
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function apply(result: GenerateResult) {
    if (result.kind === "refused") setRefusal(result.reason);
    else setQuiz(result.quiz);
  }

  // Abort on cleanup so Strict Mode's remount doesn't fire two generations.
  useEffect(() => {
    if (!autoStart) return;
    const ac = new AbortController();
    generateQuiz({ competencyId: competencies[0].id, topic: initialTopic, documentId: "", language: "en" }, ac.signal)
      .then(apply)
      .catch((e: unknown) => { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't generate a quiz."); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [autoStart, competencies, initialTopic]);

  function start() {
    if (!config.competencyId) return;
    setLoading(true); setError(""); setRefusal(""); setQuiz(null); setIdx(0); setPicks({}); setSaved(false);
    generateQuiz(config)
      .then(apply)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't generate a quiz."))
      .finally(() => setLoading(false));
  }

  const total = quiz?.questions.length ?? 0;
  const answeredCount = Object.keys(picks).length;
  const finished = total > 0 && answeredCount === total;
  const correctCount = quiz ? quiz.questions.filter((q) => picks[q.id] === q.correctAnswer).length : 0;

  // Record the finished attempt once, for the learner's own history.
  useEffect(() => {
    if (!finished || saved || !quiz) return;
    const ac = new AbortController();
    fetch(`/api/tutor/quiz/${quiz.assessmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: Object.entries(picks).map(([questionId, selectedAnswer]) => ({ questionId, selectedAnswer })) }),
      signal: ac.signal,
    })
      .then(() => setSaved(true))
      .catch(() => {});
    return () => ac.abort();
  }, [finished, saved, quiz, picks]);

  if (!quiz) {
    const noMaterial = sharedDocumentCount === 0 && documents.length === 0;
    return (
      <div className="rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[24px] shadow-sm flex flex-col gap-[16px]">
        <div>
          <h1 className="text-[20px] font-semibold">Self-evaluation quiz</h1>
          <p className="text-[13px] text-muted-foreground mt-[4px]">Five questions written only from your course material and your own uploads — each one cites its source. Practice only: it never changes your official competency scores.</p>
        </div>

        {noMaterial && (
          <p className="rounded-[12px] border border-dashed border-[color:var(--color-border-resting)] px-[12px] py-[10px] text-[13px] text-muted-foreground">
            No material is available yet. <Link href="/tutor" className="underline text-[color:var(--color-accent)]">Upload your notes on the Tutor page</Link> first.
          </p>
        )}

        <div className="grid gap-[12px] sm:grid-cols-2">
          <label className="flex flex-col gap-[6px] text-[12px] font-medium">
            Competency
            <select value={config.competencyId} onChange={(e) => setConfig((c) => ({ ...c, competencyId: e.target.value }))} className="rounded-[10px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[10px] py-[8px] text-[13px] font-normal">
              {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.note ? ` — ${c.note}` : ""}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-[6px] text-[12px] font-medium">
            Source
            <select value={config.documentId} onChange={(e) => setConfig((c) => ({ ...c, documentId: e.target.value }))} className="rounded-[10px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[10px] py-[8px] text-[13px] font-normal">
              <option value="">All material available to me</option>
              {documents.map((d) => <option key={d.id} value={d.id}>My upload: {d.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-[6px] text-[12px] font-medium">
            Language
            <select value={config.language} onChange={(e) => setConfig((c) => ({ ...c, language: e.target.value as "en" | "hi" }))} className="rounded-[10px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[10px] py-[8px] text-[13px] font-normal">
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </label>
          <label className="flex flex-col gap-[6px] text-[12px] font-medium">
            Topic <span className="font-normal text-muted-foreground">(optional — narrows the questions)</span>
            <input value={config.topic} onChange={(e) => setConfig((c) => ({ ...c, topic: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && start()} placeholder="e.g. Sampling variance" className="rounded-[10px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[10px] py-[8px] text-[13px] font-normal outline-none focus:border-[color:var(--color-accent)]" />
          </label>
        </div>

        {refusal && <p className="rounded-[12px] border border-[#FDBA74]/40 bg-[#FFF4ED] px-[12px] py-[10px] text-[13px] text-[#9C4221]" role="status">{refusal}</p>}
        {error && <p className="rounded-[12px] border border-[rgba(240,68,56,0.25)] bg-[rgba(240,68,56,0.08)] px-[12px] py-[10px] text-[13px] text-[#C9190B]" role="alert">{error}</p>}

        <div className="flex items-center gap-[12px]">
          <Button onClick={start} disabled={loading || !config.competencyId || noMaterial} className="rounded-full">
            {loading ? "Writing questions from your material…" : "Generate 5 questions"}
          </Button>
          <Link href="/tutor" className="text-[12px] underline text-muted-foreground">← Back to tutor</Link>
        </div>
      </div>
    );
  }

  const q = quiz.questions[idx];
  const picked = picks[q.id];

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        <h1 className="text-[18px] font-semibold">{quiz.competencyName}{config.topic ? ` · ${config.topic}` : ""} <span className="text-muted-foreground font-normal tabular-mono text-[14px]">· {idx + 1}/{total}</span></h1>
        <div className="flex gap-[8px]">
          <Button variant="outline" size="sm" className="rounded-full h-7" onClick={() => setQuiz(null)}>New quiz</Button>
          <Link href="/tutor" className="text-[12px] border border-[color:var(--color-border-resting)] rounded-full px-[12px] py-[5px] bg-[color:var(--color-surface-1)]">Back</Link>
        </div>
      </div>

      <div className="rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[20px] shadow-sm">
        <div className="flex gap-[4px] mb-[14px]" aria-hidden>
          {quiz.questions.map((qq, i) => (
            <div key={qq.id} className={cn("h-[6px] flex-1 rounded-full", picks[qq.id] ? (picks[qq.id] === qq.correctAnswer ? "bg-[#12B76A]" : "bg-[#F04438]") : i === idx ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-border-resting)]")} />
          ))}
        </div>
        <div className="font-medium text-[14px]"><Rich text={q.stem} /></div>
        <div className="mt-[16px] grid gap-[8px]">
          {q.options.map((option, i) => {
            const isPicked = picked === option;
            const isCorrect = option === q.correctAnswer;
            return (
              <button
                key={option}
                disabled={Boolean(picked)}
                onClick={() => setPicks((p) => ({ ...p, [q.id]: option }))}
                className={cn(
                  "text-left rounded-[12px] border px-[14px] py-[10px] text-[13px] bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]",
                  !picked && "hover:border-[color:var(--color-accent)]",
                  picked && isCorrect && "border-[#12B76A] bg-[#12B76A]/10",
                  picked && isPicked && !isCorrect && "border-[#F04438] bg-[#F04438]/10",
                )}
              >
                <span className="font-semibold mr-[8px]">{String.fromCharCode(65 + i)})</span><Rich text={option} />
              </button>
            );
          })}
        </div>

        {picked && (
          <div className="mt-[16px] flex flex-col gap-[10px]">
            <div className={cn("rounded-[12px] border px-[14px] py-[10px] text-[13px]", picked === q.correctAnswer ? "border-[#12B76A]/30 bg-[#12B76A]/10" : "border-[#F04438]/30 bg-[#F04438]/10")}>
              <p className="font-semibold">{picked === q.correctAnswer ? "Correct" : `Not quite — the answer is “${q.correctAnswer}”`}</p>
              {q.explanation && <div className="mt-[6px]"><Markdown>{q.explanation}</Markdown></div>}
            </div>
            {q.citation && <SourceChunkCard chunkIndex={q.citation.chunkIndex} content={q.citation.content} similarity={q.citation.similarity} documentTitle={q.citation.documentTitle} />}
            {idx < total - 1 && <Button onClick={() => setIdx((i) => i + 1)} className="rounded-full w-fit">Next question →</Button>}
          </div>
        )}
      </div>

      {finished && (
        <div className="rounded-[20px] bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] p-[20px]">
          <p className="font-semibold text-[16px]">You got {correctCount} of {total}</p>
          <p className="text-[13px] opacity-80 mt-[4px]">
            {correctCount === total ? "Solid command of this material." : correctCount >= total * 0.6 ? "Good — revisit the questions you missed below." : "Worth another pass through the source material before retrying."}
            {" "}Practice only — your official scores are unchanged.
          </p>
          {correctCount < total && (
            <ul className="mt-[12px] flex flex-col gap-[6px] text-[13px]">
              {quiz.questions.filter((qq) => picks[qq.id] !== qq.correctAnswer).map((qq) => (
                <li key={qq.id} className="flex flex-wrap items-baseline gap-x-[8px]">
                  <span className="opacity-90">Revisit: {qq.stem.length > 90 ? `${qq.stem.slice(0, 90)}…` : qq.stem}</span>
                  <Link href={`/tutor`} className="underline opacity-80 text-[12px]">Ask the tutor</Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-[14px] flex gap-[8px]">
            <Button onClick={start} className="rounded-full bg-[color:var(--color-canvas)] text-foreground hover:bg-[color:var(--color-canvas)]/90">New questions, same settings</Button>
            <Button variant="outline" onClick={() => setQuiz(null)} className="rounded-full border-white/30 bg-transparent text-[color:var(--color-canvas)]">Change settings</Button>
          </div>
        </div>
      )}
    </div>
  );
}
