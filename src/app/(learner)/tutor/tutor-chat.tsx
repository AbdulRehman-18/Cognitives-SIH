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
  const pendingRef = useRef("");
  const rafRef = useRef<number | null>(null);
  function flushNow() {
    if (!pendingRef.current) return;
    const chunk = pendingRef.current; pendingRef.current = "";
    setMessages((prev) => { const c = [...prev]; const last = c[c.length-1]; if (last?.role==="assistant") last.content += chunk; return [...c]; });
  }
  function scheduleFlush() {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(()=>{ rafRef.current=null; flushNow(); });
  }

  async function send(content: string) {
    const next = [...messages, { role: "user", content } as ChatMessage];
    setMessages(next); setInput(""); setStreaming(true); setErrorKind(null);
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, mode }) });
      if (!res.ok) { const body = await res.json().catch(() => null); setErrorKind((body?.kind ?? "NETWORK") as AiErrorKind); setStreaming(false); return; }
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
        if (headerParsed && buffer) { const text = buffer; buffer = ""; // batch: mutate via ref + flush on rAF
          pendingRef.current += text; scheduleFlush(); }
       }
       if (buffer) { pendingRef.current += buffer; scheduleFlush(); flushNow(); }
    } catch { setErrorKind("NETWORK"); } finally { setStreaming(false); setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50); }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="grid gap-[16px] lg:grid-cols-[1fr_320px]">
      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] shadow-[var(--shadow-card)]">
        {/* Mode rail — pill */}
        <div className="flex flex-wrap items-center justify-between gap-[12px] border-b border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/60 px-[12px] py-[10px]">
          <div className="flex rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[3px] shadow-sm">
            {(["explain", "guide", "quiz"] as TutorMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded-full px-[14px] py-[7px] text-[12px] font-semibold tracking-wide capitalize transition", mode === m ? "bg-[color:var(--color-accent)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {m === "explain" ? "Explain" : m === "guide" ? "Guide me" : "Quiz me"}
              </button>
            ))}
          </div>
          <span className="hidden sm:inline-flex items-center gap-[8px] text-[11px] tabular-mono text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[color:var(--color-accent)]" />
            {mode === "explain" ? "2–3 steps + check · cites every claim" : mode === "guide" ? "Socratic · one question at a time" : "1 cited MCQ · from your material"}
          </span>
        </div>

        <div ref={listRef} className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[16px] py-[16px] bg-[color:var(--color-surface-1)]/60">
          {messages.length === 0 && (
            <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px] shadow-sm">
              <p className="text-small font-semibold">Start grounded. No guesswork.</p>
              <p className="text-small text-muted-foreground leading-relaxed mt-[4px]">Ask anything covered in trainer-uploaded material. The tutor retrieves first, answers only from those chunks, and cites every claim. Try one:</p>
              <div className="mt-[12px] flex flex-wrap gap-[8px]">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[12px] py-[7px] text-[12px] text-left hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-accent)]/5 text-foreground max-w-full leading-tight">{s}</button>
                ))}
                {initialGaps?.slice(0, 2).map((g) => (
                  <button key={g} onClick={() => send(`Teach me ${g} from the uploaded material — start with fundamentals and keep it calibrated to my gap.`)} className="rounded-full bg-[color:var(--color-accent)] text-white px-[12px] py-[7px] text-[12px] font-medium hover:brightness-105">Teach me: {g} →</button>
                ))}
              </div>
              <div className="mt-[14px] grid grid-cols-3 gap-[8px] text-center">
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)]/50 py-[10px]"><p className="text-[11px] font-semibold tracking-wide">Explain</p><p className="text-[10px] tabular-mono text-muted-foreground">Steps + check</p></div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)]/50 py-[10px]"><p className="text-[11px] font-semibold tracking-wide">Guide</p><p className="text-[10px] tabular-mono text-muted-foreground">Socratic</p></div>
                <div className="rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)]/50 py-[10px]"><p className="text-[11px] font-semibold tracking-wide">Quiz</p><p className="text-[10px] tabular-mono text-muted-foreground">1 MCQ</p></div>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("max-w-[88%] rounded-[16px] px-[14px] py-[12px] text-[14px] leading-relaxed shadow-sm", m.role === "user" ? "self-end bg-[color:var(--color-accent)] text-white rounded-br-[6px]" : "self-start bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] rounded-bl-[6px]")}>
              <p className="whitespace-pre-wrap">{m.content || (streaming && i === messages.length - 1 ? "Calibrating to your gaps…" : "")}</p>
              {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                <div className="mt-[12px] flex flex-col gap-[8px]">
                  <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Cited chunks</p>
                  {m.citations.map((c) => <SourceChunkCard key={c.id} chunkIndex={c.chunkIndex} content={c.content} similarity={c.similarity} />)}
                </div>
              )}
              {m.role === "assistant" && m.refused && <p className="mt-[8px] text-[12px] italic opacity-80 bg-[#FFF4ED] border border-[#FDBA74]/30 rounded-[8px] px-[10px] py-[8px] text-[#9C4221]">Outside uploaded material — the tutor declined to guess. Ask your trainer to add the relevant document.</p>}
            </div>
          ))}
          {streaming && <div className="self-start flex items-center gap-[8px] text-[12px] tabular-mono text-muted-foreground"><span className="size-2 rounded-full bg-[color:var(--color-accent)] animate-pulse" /> Tutor is retrieving & drafting with citations…</div>}
          {errorKind && <AiErrorState kind={errorKind} onRetry={() => setErrorKind(null)} />}
        </div>

        {lastAssistant && !streaming && !lastAssistant.refused && (
          <div className="flex flex-wrap gap-[8px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/50 px-[12px] py-[10px]">
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => send("Give a concrete example from the material.")}>Example</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => send("Summarise the key points with citations.")}>Summarise</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => { setMode("quiz"); send("Quiz me on this topic — one MCQ from the same material, with citations."); }}>Quiz me</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs rounded-full" onClick={() => { setMode("guide"); send("Guide me through this — ask me one question at a time, Socratic."); }}>Guide me</Button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (input.trim() && !streaming) send(input.trim()); }} className="flex gap-[8px] border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[12px]">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "quiz" ? "What topic should I quiz you on?" : mode === "guide" ? "Ask to be guided — I’ll ask one question at a time…" : "Ask about your course material… I’ll retrieve first, then answer with citations."} className="flex-1 rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] px-[16px] py-[10px] text-[14px] outline-none focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/15" disabled={streaming} />
          <Button type="submit" disabled={streaming || !input.trim()} className="rounded-full px-[20px]">{streaming ? "…" : "Send"}</Button>
        </form>
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="rounded-[20px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px] shadow-[var(--shadow-card)]">
          <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">How this tutor earns trust</p>
          <ol className="mt-[12px] space-y-[10px]">
            <li className="flex gap-[10px]"><span className="size-6 rounded-full bg-[color:var(--color-accent)] text-white grid place-items-center text-[11px] font-bold shrink-0">01</span><span className="text-small leading-relaxed"><b>Retrieves first</b> — top chunks from your uploaded material, ranked by similarity.</span></li>
            <li className="flex gap-[10px]"><span className="size-6 rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] grid place-items-center text-[11px] font-bold shrink-0">02</span><span className="text-small leading-relaxed"><b>Refuses if no match</b> — never hallucinates. Out-of-scope is declined.</span></li>
            <li className="flex gap-[10px]"><span className="size-6 rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] grid place-items-center text-[11px] font-bold shrink-0">03</span><span className="text-small leading-relaxed"><b>Answers only from citations</b> — calibrated to your gaps & learning path.</span></li>
          </ol>
          <div className="mt-[14px] rounded-[12px] bg-[#1A1A1A] text-white p-[12px]">
            <p className="text-[11px] tracking-[0.08em] uppercase font-semibold opacity-60">Why it’s goated</p>
            <p className="text-small leading-relaxed mt-[6px] opacity-90">It tracks your gaps and path progress, personalizes tone & depth, and makes you <b>think</b> — Socratic checks and cited quizzes, not passive chat.</p>
          </div>
        </div>
        <div className="rounded-[20px] border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)] text-white p-[16px] shadow-[var(--shadow-cta)]">
          <p className="text-small font-semibold">A tutor, not a chatbot</p>
          <p className="text-small leading-relaxed mt-[6px] opacity-90">Switch to <b>Guide me</b> to be questioned step-by-step, or <b>Quiz me</b> for an instant cited MCQ from the same source chunks. Every answer stays grounded.</p>
          <div className="mt-[12px] flex gap-[8px]">
            <button onClick={() => setMode("guide")} className="flex-1 rounded-full bg-[color:var(--color-surface-1)] text-[color:var(--color-accent)] py-[8px] text-[12px] font-semibold">Try Guide me</button>
            <button onClick={() => setMode("quiz")} className="flex-1 rounded-full bg-[color:var(--color-surface-1)]/15 border border-white/30 text-white py-[8px] text-[12px] font-semibold backdrop-blur">Try Quiz me</button>
          </div>
        </div>
        <div className="rounded-[16px] border border-dashed border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/50 p-[12px]">
          <p className="text-[11px] tracking-[0.08em] uppercase font-semibold text-muted-foreground">Your learning graph sync</p>
          <div className="mt-[8px] flex items-end gap-[4px] h-[32px]">
            {[22, 34, 28, 42, 30, 48, 52].map((v, i) => <div key={i} className="flex-1 rounded-[6px] bg-[color:var(--color-accent)]" style={{ height: `${v}%`, opacity: 0.3 + (i / 7) * 0.7 }} />)}
          </div>
          <p className="text-[11px] tabular-mono text-muted-foreground mt-[6px]">Tutor sees your readiness trend and adapts explanations.</p>
        </div>
      </div>
    </div>
  );
}
