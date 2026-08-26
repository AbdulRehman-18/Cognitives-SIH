"use client";

import { useRef, useState } from "react";
import { SourceChunkCard } from "@/components/caliper/source-chunk-card";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TutorMode = "explain" | "guide" | "quiz";

interface Citation { id: string; documentId: string; chunkIndex: number; content: string; similarity: number; }
interface ChatMessage { role: "user" | "assistant"; content: string; citations?: Citation[]; refused?: boolean; }

const STARTERS = [
  "Explain sampling variance with an example from the material.",
  "Walk me through the Price Index formula step by step.",
  "Why does this method matter for my role?",
];

export function TutorChat({ initialGaps }: { initialGaps?: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [streaming, setStreaming] = useState(false);
  const [errorKind, setErrorKind] = useState<AiErrorKind | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(content: string) {
    const next = [...messages, { role: "user", content } as ChatMessage];
    setMessages(next); setInput(""); setStreaming(true); setErrorKind(null);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, mode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorKind((body?.kind ?? "NETWORK") as AiErrorKind); setStreaming(false); return;
      }
      const reader = res.body?.getReader(); if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = ""; let headerParsed = false; let citations: Citation[] = []; let refused = false;
      setMessages((prev) => [...prev, { role: "assistant", content: "", citations: [], refused: false }]);
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!headerParsed) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) continue;
          try { const h = JSON.parse(buffer.slice(0, sep)) as { refused: boolean; citations: Citation[] }; refused = h.refused; citations = h.citations; } catch {}
          buffer = buffer.slice(sep + 2); headerParsed = true;
          setMessages((prev) => { const c = [...prev]; const last = c[c.length - 1]; if (last?.role === "assistant") { last.citations = citations; last.refused = refused; } return c; });
        }
        if (headerParsed && buffer) { const text = buffer; buffer = ""; setMessages((prev) => { const c = [...prev]; const last = c[c.length - 1]; if (last?.role === "assistant") last.content += text; return c; }); }
      }
      if (buffer) setMessages((prev) => { const c = [...prev]; const last = c[c.length - 1]; if (last?.role === "assistant") last.content += buffer; return c; });
    } catch { setErrorKind("NETWORK"); } finally { setStreaming(false); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50); }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
      {/* Main workbench */}
      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]">
        {/* Mode rail — Caliper ticks aesthetic */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-rule)] bg-[color:var(--color-bg)] px-3 py-2">
          <div className="flex rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-surface)] p-0.5">
            {(["explain", "guide", "quiz"] as TutorMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("rounded-sm px-3 py-1.5 text-xs font-medium capitalize tracking-wide transition-colors", mode === m ? "bg-[color:var(--color-measure)] text-white" : "text-muted-foreground hover:text-foreground")}>
                {m === "explain" ? "Explain" : m === "guide" ? "Guide me" : "Quiz me"}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline text-[11px] tabular-mono text-muted-foreground">
            {mode === "explain" ? "2–3 steps + check" : mode === "guide" ? "Socratic · one question/turn" : "1 MCQ · cited"}
          </span>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && (
            <div className="rounded-md border border-dashed border-[color:var(--color-rule)] bg-[color:var(--color-bg)] px-4 py-6">
              <p className="text-sm font-medium">Start grounded. No guesswork.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ask anything covered in your uploaded course material. The tutor retrieves first, answers only from those chunks, and cites every claim.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-[color:var(--color-rule)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs text-left hover:border-[color:var(--color-measure)]/40 hover:bg-[color:var(--color-measure)]/5 text-foreground max-w-full">{s}</button>
                ))}
                {initialGaps?.slice(0, 2).map((g) => (
                  <button key={g} onClick={() => send(`Teach me ${g} from the uploaded material — start with fundamentals.`)} className="rounded-full bg-[color:var(--color-measure)] px-3 py-1.5 text-xs text-white hover:opacity-90">Teach me: {g}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("max-w-[90%] rounded-md px-3.5 py-3 text-sm leading-relaxed", m.role === "user" ? "self-end bg-[color:var(--color-measure)] text-white" : "self-start border border-[color:var(--color-rule)] bg-[color:var(--color-bg)]")}>
              <p className="whitespace-pre-wrap">{m.content || (streaming && i === messages.length - 1 ? "Calibrating…" : "")}</p>
              {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {m.citations.map((c) => <SourceChunkCard key={c.id} chunkIndex={c.chunkIndex} content={c.content} similarity={c.similarity} />)}
                </div>
              )}
              {m.role === "assistant" && m.refused && <p className="mt-2 text-xs italic opacity-70">Outside uploaded material — the tutor declined to guess. Ask your trainer to add the relevant document.</p>}
            </div>
          ))}
          {errorKind && <AiErrorState kind={errorKind} onRetry={() => setErrorKind(null)} />}
        </div>

        {/* Quick actions */}
        {lastAssistant && !streaming && !lastAssistant.refused && (
          <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-rule)] bg-[color:var(--color-bg)] px-3 py-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => send("Give a concrete example from the material.")}>Example</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => send("Summarise the key points.")}>Summarise</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setMode("quiz"); send("Quiz me on this topic — one MCQ from the same material."); }}>Quiz me</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setMode("guide"); send("Guide me through this — ask me one question at a time."); }}>Guide me</Button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (input.trim() && !streaming) send(input.trim()); }} className="flex gap-2 border-t border-[color:var(--color-rule)] bg-[color:var(--color-surface)] p-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "quiz" ? "What topic should I quiz you on?" : mode === "guide" ? "Ask to be guided…" : "Ask about your course material…"} className="flex-1 rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-bg)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-measure)] focus:ring-2 focus:ring-[color:var(--color-measure)]/20" disabled={streaming} />
          <Button type="submit" disabled={streaming || !input.trim()} className="px-5">{streaming ? "…" : "Send"}</Button>
        </form>
      </div>

      {/* Right calibration panel — Operate affordance */}
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-surface)] p-4">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">How this tutor works</p>
          <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <li className="flex gap-2"><span className="tabular-mono text-[color:var(--color-measure)]">01</span> Retrieves top chunks from your uploaded material</li>
            <li className="flex gap-2"><span className="tabular-mono text-[color:var(--color-measure)]">02</span> Refuses if nothing matches — never guesses</li>
            <li className="flex gap-2"><span className="tabular-mono text-[color:var(--color-measure)]">03</span> Answers only from citations, calibrated to your gaps</li>
          </ol>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-[color:var(--color-bg)] py-2"><p className="tabular-mono text-xs font-semibold">Explain</p><p className="text-[10px] text-muted-foreground">Steps + check</p></div>
            <div className="rounded-md bg-[color:var(--color-bg)] py-2"><p className="tabular-mono text-xs font-semibold">Guide</p><p className="text-[10px] text-muted-foreground">Socratic</p></div>
            <div className="rounded-md bg-[color:var(--color-bg)] py-2"><p className="tabular-mono text-xs font-semibold">Quiz</p><p className="text-[10px] text-muted-foreground">1 MCQ</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--color-rule)] bg-[color:var(--color-measure)] p-4 text-white">
          <p className="text-xs font-medium">A tutor, not a chatbot</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">Switch to <strong>Guide me</strong> to be questioned step-by-step, or <strong>Quiz me</strong> for an instant cited MCQ from the same source chunks.</p>
        </div>
      </div>
    </div>
  );
}
