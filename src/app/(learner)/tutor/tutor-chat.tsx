"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Components } from "react-markdown";
import { ArrowRight, ArrowUp, ArrowUpRight, RotateCcw } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { LevelScale } from "@/components/caliper/level-scale";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { cn } from "@/lib/utils";

type TutorMode = "explain" | "guide" | "quiz";
type Language = "en" | "hi";
interface Citation { id: string; documentId: string; chunkIndex: number; content: string; similarity: number; documentTitle?: string; }
type Basis = "material" | "blended" | "general";
interface ChatMessage { role: "user" | "assistant"; content: string; citations?: Citation[]; refused?: boolean; failed?: boolean; basis?: Basis; }
export interface TutorGap { name: string; severity: string; current: number; required: number; }

const MODES: { id: TutorMode; label: string; hint: string; start: string }[] = [
  { id: "explain", label: "Explain", hint: "A short explanation, then a check for understanding", start: "Explain it to me" },
  { id: "guide", label: "Guide me", hint: "Socratic — one question at a time", start: "Guide me through it" },
  { id: "quiz", label: "Quiz me", hint: "One cited question drawn from your material", start: "Quiz me on it" },
];

const STARTERS = [
  "Explain sampling variance with an example from the material.",
  "Walk me through the Price Index formula step by step.",
  "Why does this method matter for my role?",
];

const FOLLOW_UPS = [
  { label: "Show an example", prompt: "Give a concrete example from the material." },
  { label: "Summarise", prompt: "Summarise the key points with citations." },
];

export function TutorChat({ gaps = [], initialLanguage = "en" }: { gaps?: TutorGap[]; initialLanguage?: Language }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TutorMode>("explain");
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [streaming, setStreaming] = useState(false);
  const [errorKind, setErrorKind] = useState<AiErrorKind | null>(null);
  const [selectedGap, setSelectedGap] = useState(0);
  const [focus, setFocus] = useState<TutorGap | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const pendingRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const router = useRouter();
  const openQuiz = (topic: string) => router.push(`/tutor/quiz?topic=${encodeURIComponent(topic)}`);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  // On desktop the workspace fills the rest of the viewport, whatever the
  // header above it measures, so the composer is always in view.
  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth < 1024) { el.style.height = ""; return; }
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(560, window.innerHeight - top - 24)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Follow the stream only while the reader is already at the bottom, so
  // scrolling up to re-read an earlier answer isn't yanked away.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, errorKind]);

  // Grow the composer with its content, up to a cap.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Updaters must stay pure (Strict Mode runs them twice), so the last
  // assistant message is replaced, never mutated in place.
  function patchLastAssistant(patch: (m: ChatMessage) => Partial<ChatMessage>) {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, ...patch(last) }];
    });
  }
  function flushNow() {
    if (!pendingRef.current) return;
    const chunk = pendingRef.current; pendingRef.current = "";
    patchLastAssistant((m) => ({ content: m.content + chunk }));
  }
  function scheduleFlush() {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; flushNow(); });
  }

  async function send(content: string, sendMode: TutorMode = mode, history: ChatMessage[] = messages) {
    if (sendMode === "quiz") { openQuiz(content); return; }
    // Failed turns carry no answer, so they are never sent back as context.
    const next = [...history.filter((m) => !m.failed && (m.role === "user" || m.content)), { role: "user", content } as ChatMessage];
    stickToBottom.current = true;
    setMessages(next); setInput(""); setStreaming(true); setErrorKind(null);
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, mode: sendMode, language }) });
      if (!res.ok) { const body = await res.json().catch(() => null); setErrorKind((body?.kind ?? "NETWORK") as AiErrorKind); return; }
      const reader = res.body?.getReader(); if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = ""; let headerParsed = false;
      setMessages((prev) => [...prev, { role: "assistant", content: "", citations: [], refused: false }]);
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!headerParsed) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) continue;
          let header: { refused: boolean; citations: Citation[]; basis?: Basis } = { refused: false, citations: [] };
          try { header = JSON.parse(buffer.slice(0, sep)); } catch {}
          buffer = buffer.slice(sep + 2); headerParsed = true;
          patchLastAssistant(() => ({ citations: header.citations, refused: header.refused, basis: header.basis ?? "material" }));
        }
        // Batch: accumulate in a ref and flush once per animation frame.
        if (headerParsed && buffer) { pendingRef.current += buffer; buffer = ""; scheduleFlush(); }
      }
      if (buffer) pendingRef.current += buffer;
      flushNow();
      // A stream that closes without text must never render as a blank answer.
      patchLastAssistant((m) => (m.refused || m.content.trim() ? {} : { failed: true }));
    } catch { setErrorKind("NETWORK"); } finally { setStreaming(false); inputRef.current?.focus(); }
  }

  function startSession(gap: TutorGap) {
    if (mode === "quiz") { openQuiz(gap.name); return; }
    setFocus(gap);
    void send(
      mode === "guide"
        ? `Guide me through ${gap.name} using the uploaded material. I'm at level ${gap.current} of 5 and my role needs level ${gap.required} — ask one question at a time.`
        : `Teach me ${gap.name} from the uploaded material. I'm at level ${gap.current} of 5 and my role needs level ${gap.required} — start from fundamentals and build up.`,
    );
  }

  function retry() {
    const idx = messages.map((m) => m.role).lastIndexOf("user");
    if (idx === -1 || streaming) return;
    void send(messages[idx].content, mode, messages.slice(0, idx));
  }

  function submit() {
    const text = input.trim();
    if (text && !streaming) void send(text);
  }

  function reset() {
    setMessages([]); setErrorKind(null); setInput(""); setFocus(null);
    inputRef.current?.focus();
  }

  const activeMode = MODES.find((m) => m.id === mode)!;
  const lastIndex = messages.length - 1;
  const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <section
      ref={sectionRef}
      aria-label="Tutor workspace"
      className="flex h-[80dvh] min-h-[540px] flex-col overflow-hidden rounded-[18px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] shadow-[var(--shadow-card)]"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-[12px] border-b border-[color:var(--color-border-resting)] px-[12px] py-[10px] sm:px-[16px]">
        <div role="group" aria-label="Tutor mode" className="flex shrink-0 rounded-[10px] bg-[color:var(--color-canvas)] p-[3px]">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-[8px] px-[12px] py-[6px] text-[13px] font-medium outline-none transition-[color,background-color,box-shadow] duration-[var(--duration-micro)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60",
                mode === m.id
                  ? "bg-[color:var(--color-surface-2)] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_1px_var(--color-border-resting)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {focus && (
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-[12px] md:flex">
            <span className="truncate text-[13px] text-muted-foreground">
              Session on <span className="font-medium text-foreground">{focus.name}</span>
            </span>
            <LevelScale current={focus.current} required={focus.required} severity={focus.severity} label={focus.name} width={96} className="w-[96px] shrink-0" />
            <span className="num shrink-0 text-[12px] text-muted-foreground">L{focus.current}→L{focus.required}</span>
          </div>
        )}

        <div className="ml-auto flex items-center">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              disabled={streaming}
              className="inline-flex items-center gap-[6px] rounded-[8px] px-[8px] py-[6px] text-[12px] font-medium text-muted-foreground outline-none transition-colors hover:bg-[color:var(--color-canvas)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 disabled:opacity-40"
            >
              <RotateCcw className="size-[13px]" aria-hidden />
              <span className="hidden sm:inline">New session</span>
            </button>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="tutor-scroll flex-1 overflow-y-auto overflow-x-hidden"
        aria-live="polite"
        aria-busy={streaming}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col px-[16px] py-[28px] sm:px-[32px]">
          {messages.length === 0 ? (
            <EmptyState
              mode={activeMode}
              gaps={gaps}
              selected={selectedGap}
              onSelect={setSelectedGap}
              onStart={startSession}
              onAsk={(text) => (mode === "quiz" ? openQuiz(text) : void send(text))}
            />
          ) : (
            <ol className="flex flex-col gap-[32px]">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <li key={i} className="tutor-enter flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-[color:var(--color-canvas)] px-[14px] py-[10px] text-[15px] leading-[1.55] text-foreground">
                      {m.content}
                    </p>
                  </li>
                ) : (
                  <li key={i} className="tutor-enter flex flex-col gap-[12px]">
                    <div className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
                      <CaliperMark />
                      <span className="font-medium text-foreground">Tutor</span>
                      {!m.refused && !m.failed && m.basis && <BasisTag basis={m.basis} sources={m.citations?.length ?? 0} />}
                    </div>

                    {m.refused ? (
                      <OutOfRange />
                    ) : m.failed ? (
                      <NoAnswer passages={m.citations?.length ?? 0} onRetry={i === lastIndex && !streaming ? retry : undefined} />
                    ) : m.content ? (
                      <Answer
                        content={m.content}
                        citations={m.citations ?? []}
                        messageIndex={i}
                        streaming={streaming && i === lastIndex}
                      />
                    ) : streaming && i === lastIndex ? (
                      <Searching />
                    ) : null}

                    {!m.refused && !m.failed && m.content && m.basis === "general" && (
                      <BasisNote>
                        <span className="font-medium text-foreground">Not in your material.</span> This is a general explanation, so there are no sources to check it against. Upload notes on this topic for an answer grounded in them.
                      </BasisNote>
                    )}

                    {!m.refused && !m.failed && m.content && m.basis === "blended" && !streaming && (
                      <BasisNote>
                        <span className="font-medium text-foreground">Partly from your material.</span> Numbered claims come from the sources below; anything under “Beyond your material” is general explanation.
                      </BasisNote>
                    )}

                    {!m.refused && m.citations && m.citations.length > 0 && <Sources citations={m.citations} messageIndex={i} />}

                    {i === lastIndex && !streaming && !m.refused && !m.failed && m.content && (
                      <div className="flex flex-wrap gap-[6px] pt-[2px]">
                        {FOLLOW_UPS.map((f) => (
                          <FollowUp key={f.label} onClick={() => void send(f.prompt)}>{f.label}</FollowUp>
                        ))}
                        <FollowUp onClick={() => openQuiz(focus?.name ?? lastUserPrompt ?? "current topic")}>Quiz me on this</FollowUp>
                        {mode !== "guide" && (
                          <FollowUp onClick={() => { setMode("guide"); void send("Guide me through this — ask me one question at a time.", "guide"); }}>Guide me through it</FollowUp>
                        )}
                      </div>
                    )}
                  </li>
                ),
              )}
              {streaming && messages[lastIndex]?.role === "user" && (
                <li className="tutor-enter flex flex-col gap-[12px]">
                  <div className="flex items-center gap-[8px] text-[12px]"><CaliperMark /><span className="font-medium text-foreground">Tutor</span></div>
                  <Searching />
                </li>
              )}
            </ol>
          )}
          {errorKind && <AiErrorState kind={errorKind} onRetry={() => setErrorKind(null)} className="mt-[24px]" />}
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="px-[12px] pb-[12px] pt-[4px] sm:px-[16px] sm:pb-[16px]">
        <div className="mx-auto max-w-[720px] rounded-[14px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-2)] transition-[border-color,box-shadow] duration-[var(--duration-standard)] focus-within:border-[color:var(--color-accent)]/60 focus-within:shadow-[0_0_0_3px_var(--color-accent-15)]">
          <label htmlFor="tutor-input" className="sr-only">Message the tutor</label>
          <textarea
            id="tutor-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            }}
            placeholder={mode === "quiz" ? "Name a topic to be quizzed on…" : mode === "guide" ? "What would you like to reason through?" : "Ask anything about your course material…"}
            className="block max-h-[160px] w-full resize-none bg-transparent px-[14px] pb-[4px] pt-[12px] text-[15px] leading-[1.5] text-foreground outline-none placeholder:text-[color:var(--color-ink-muted)]"
          />
          <div className="flex items-center gap-[10px] px-[10px] pb-[10px] pl-[14px]">
            <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{activeMode.hint}</p>
            <div role="group" aria-label="Answer language" className="flex shrink-0 items-center rounded-[8px] border border-[color:var(--color-border-resting)] p-[2px] text-[11px] font-medium">
              {(["en", "hi"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  aria-pressed={language === l}
                  title={l === "en" ? "Answer in English" : "हिंदी में उत्तर"}
                  className={cn(
                    "rounded-[6px] px-[7px] py-[3px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60",
                    language === l ? "bg-[color:var(--color-canvas)] text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l === "en" ? "EN" : "हिं"}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label={mode === "quiz" ? "Start quiz" : "Send"}
              className="grid size-[32px] shrink-0 place-items-center rounded-[9px] bg-[color:var(--color-accent)] text-white outline-none transition-[opacity,transform,filter] duration-[var(--duration-micro)] hover:brightness-110 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-2)] disabled:opacity-30 disabled:hover:brightness-100"
            >
              <ArrowUp className="size-[16px]" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function EmptyState({
  mode, gaps, selected, onSelect, onStart, onAsk,
}: {
  mode: (typeof MODES)[number];
  gaps: TutorGap[];
  selected: number;
  onSelect: (i: number) => void;
  onStart: (gap: TutorGap) => void;
  onAsk: (text: string) => void;
}) {
  const gap = gaps[selected];

  return (
    <div className="my-auto flex flex-col gap-[28px]">
      {gap ? (
        <div className="flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[6px]">
            <h2 className="text-[22px] font-[640] leading-[1.2] tracking-[-0.02em] text-foreground">Pick up where your assessment left off.</h2>
            <p className="max-w-[56ch] text-[14px] leading-[1.55] text-muted-foreground">
              Sessions start from what was measured, so explanations are pitched at your level and aimed at the one your role needs.
            </p>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-canvas)]/35">
            {gaps.length > 1 && (
              <div role="tablist" aria-label="Your gaps" className="flex gap-[4px] overflow-x-auto border-b border-[color:var(--color-border-resting)] px-[8px] pt-[6px]">
                {gaps.map((g, i) => (
                  <button
                    key={g.name}
                    role="tab"
                    type="button"
                    aria-selected={i === selected}
                    onClick={() => onSelect(i)}
                    className={cn(
                      "-mb-px flex shrink-0 items-center gap-[7px] border-b-[1.5px] px-[10px] pb-[9px] pt-[6px] text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60",
                      i === selected ? "border-[color:var(--color-ink)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <SeverityDot severity={g.severity} />
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            <div key={gap.name} className="tutor-enter flex flex-col gap-[20px] p-[20px] sm:p-[24px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[4px]">
                <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">{gap.name}</h3>
                <p className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
                  <SeverityDot severity={gap.severity} />
                  {gap.severity === "CRITICAL" ? "Critical gap" : "High-priority gap"}
                  <span aria-hidden>·</span>
                  <span className="num text-foreground">{gap.required - gap.current} {gap.required - gap.current === 1 ? "level" : "levels"} to close</span>
                </p>
              </div>

              <LevelScale size="lg" current={gap.current} required={gap.required} severity={gap.severity} label={gap.name} />

              <div className="flex flex-wrap items-center gap-[10px]">
                <button
                  type="button"
                  onClick={() => onStart(gap)}
                  className="group inline-flex items-center gap-[8px] rounded-[10px] bg-[color:var(--color-accent)] px-[16px] py-[9px] text-[14px] font-medium text-white shadow-[var(--shadow-cta)] outline-none transition-[filter,transform] duration-[var(--duration-micro)] hover:brightness-110 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)]"
                >
                  {mode.start}
                  <ArrowRight className="size-[15px] transition-transform duration-[var(--duration-standard)] ease-[var(--ease-entrance)] group-hover:translate-x-[2px]" aria-hidden />
                </button>
                <span className="text-[12px] text-muted-foreground">
                  {mode.id === "quiz" ? "Opens a cited question on this topic" : `${mode.label} mode · change it above`}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[6px]">
          <h2 className="text-[22px] font-[640] leading-[1.2] tracking-[-0.02em] text-foreground">What would you like to understand?</h2>
          <p className="max-w-[56ch] text-[14px] leading-[1.55] text-muted-foreground">
            Answers draw on your course documents and notes first, with a source for each claim they support.
          </p>
        </div>
      )}

      {mode.id !== "quiz" && (
        <div className="flex flex-col gap-[4px]">
          <p className="text-[12px] font-medium text-muted-foreground">{gap ? "Or ask about anything in your material" : "Try one of these"}</p>
          <ul className="flex flex-col">
            {STARTERS.map((s) => (
              <li key={s} className="border-b border-[color:var(--color-border-resting)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => onAsk(s)}
                  className="group flex w-full items-center gap-[12px] rounded-[6px] py-[11px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
                >
                  <span className="flex-1 text-[14px] leading-[1.45] text-muted-foreground transition-colors group-hover:text-foreground">{s}</span>
                  <ArrowUpRight className="size-[15px] shrink-0 text-[color:var(--color-ink-faint)] transition-[color,transform] duration-[var(--duration-standard)] ease-[var(--ease-entrance)] group-hover:-translate-y-[1px] group-hover:translate-x-[1px] group-hover:text-[color:var(--color-accent-ink)]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The tutor cites passages as [1], [2] or [1, 2]; turn each into a link the
// renderer can recognise and draw as an inline source marker.
function linkCitations(text: string) {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_, nums: string) =>
    nums.split(/\s*,\s*/).map((n) => `[${n}](#cite-${n})`).join(""),
  );
}

function openSource(messageIndex: number, n: number) {
  const el = document.getElementById(`src-${messageIndex}-${n}`) as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  el.classList.remove("tutor-flash");
  void el.offsetWidth;
  el.classList.add("tutor-flash");
}

function Answer({ content, citations, messageIndex, streaming }: { content: string; citations: Citation[]; messageIndex: number; streaming: boolean }) {
  const components = useMemo<Components>(() => ({
    h2({ children }) {
      const text = String(Array.isArray(children) ? children.join("") : children ?? "");
      if (!/beyond your material/i.test(text)) return <h2>{children}</h2>;
      return (
        <div className="not-prose mb-[10px] mt-[28px] flex items-center gap-[10px] border-t border-dashed border-[color:var(--color-border-hover)] pt-[16px]">
          <span className="text-[13px] font-semibold text-foreground">Beyond your material</span>
          <span className="rounded-[6px] border border-[color:var(--color-moderate)]/30 px-[6px] py-[1px] text-[11px] text-[color:var(--color-moderate)]">General knowledge</span>
        </div>
      );
    },
    a({ href, children }) {
      const match = href?.match(/^#cite-(\d+)$/);
      if (!match) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
      const n = Number(match[1]);
      const c = citations[n - 1];
      if (!c) return <span className="num text-muted-foreground">[{n}]</span>;
      return (
        <span className="group/cite relative inline-block align-baseline">
          <button
            type="button"
            onClick={() => openSource(messageIndex, n)}
            aria-label={`Source ${n}: ${c.documentTitle ?? "course material"}, passage ${c.chunkIndex}`}
            className="num mx-[1px] inline-grid h-[17px] min-w-[17px] -translate-y-[1px] place-items-center rounded-[5px] border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent-15)] px-[4px] text-[10.5px] font-medium leading-none text-[color:var(--color-accent-ink)] no-underline outline-none transition-colors hover:bg-[color:var(--color-accent-20)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
          >
            {n}
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 block w-[300px] -translate-x-1/2 translate-y-[-4px] rounded-[12px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-surface-2)] p-[12px] text-left opacity-0 shadow-[var(--shadow-card-hover)] transition-[opacity,transform] duration-[var(--duration-standard)] ease-[var(--ease-entrance)] group-hover/cite:translate-y-0 group-hover/cite:opacity-100 group-focus-within/cite:translate-y-0 group-focus-within/cite:opacity-100"
          >
            <span className="block truncate text-[12px] font-semibold text-foreground">{c.documentTitle ?? "Course material"}</span>
            <span className="num mt-[2px] block text-[11px] text-muted-foreground">passage {c.chunkIndex} · {Math.round(c.similarity * 100)}% match</span>
            <span className="mt-[8px] line-clamp-4 block text-[12.5px] font-normal leading-[1.55] text-foreground/85">{c.content}</span>
          </span>
        </span>
      );
    },
  }), [citations, messageIndex]);

  return (
    <div className={cn("text-[15px] leading-[1.7] text-foreground [&_.prose]:text-[15px] [&_.prose]:leading-[1.7]", streaming && "tutor-caret")}>
      <Markdown components={components}>{linkCitations(content)}</Markdown>
    </div>
  );
}

function Sources({ citations, messageIndex }: { citations: Citation[]; messageIndex: number }) {
  return (
    <div className="flex flex-col gap-[8px]">
      <p className="text-[12px] font-medium text-muted-foreground">Sources</p>
      <ol className="flex flex-col overflow-hidden rounded-[12px] border border-[color:var(--color-border-resting)]">
        {citations.map((c, k) => (
          <li key={c.id} className="border-b border-[color:var(--color-border-resting)] last:border-b-0">
            <details id={`src-${messageIndex}-${k + 1}`} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-[10px] px-[12px] py-[9px] text-[13px] outline-none transition-colors hover:bg-[color:var(--color-canvas)]/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-accent)]/60 [&::-webkit-details-marker]:hidden">
                <span className="num grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-[5px] border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent-15)] px-[4px] text-[10.5px] font-medium text-[color:var(--color-accent-ink)]">{k + 1}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {c.documentTitle ?? "Course material"}
                  <span className="num text-muted-foreground"> · passage {c.chunkIndex}</span>
                </span>
                <MatchMeter value={c.similarity} />
                <svg viewBox="0 0 12 12" className="size-[10px] shrink-0 text-muted-foreground transition-transform duration-[var(--duration-standard)] group-open:rotate-90" aria-hidden>
                  <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="max-h-[220px] overflow-y-auto whitespace-pre-wrap border-t border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)]/40 px-[14px] py-[12px] text-[13px] leading-[1.65] text-foreground/85">
                {c.content}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Retrieval similarity as a ten-tick reading. */
function MatchMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const lit = Math.round(pct / 10);
  return (
    <span className="hidden shrink-0 items-center gap-[8px] sm:flex" title="Similarity to your question">
      <span className="flex h-[10px] items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("w-[2px] rounded-full", i < lit ? "bg-[color:var(--color-accent-ink)]" : "bg-[color:var(--color-border-hover)]")} style={{ height: i % 5 === 4 ? 10 : 7 }} />
        ))}
      </span>
      <span className="num w-[30px] text-right text-[11px] text-muted-foreground">{pct}%</span>
    </span>
  );
}

function OutOfRange() {
  return (
    <div className="flex gap-[14px] rounded-[12px] border border-dashed border-[color:var(--color-border-hover)] px-[16px] py-[14px]">
      <svg viewBox="0 0 40 20" className="mt-[2px] h-[20px] w-[40px] shrink-0 text-[color:var(--color-moderate)]" aria-hidden>
        <path d="M2 14h36" stroke="var(--color-border-hover)" strokeWidth="1" />
        {[2, 11, 20, 29, 38].map((x) => <path key={x} d={`M${x} 10v8`} stroke="var(--color-ink-faint)" strokeWidth="1" />)}
        <path d="M38 3v16" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        <path d="M34 6l4-3 4 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex flex-col gap-[4px]">
        <p className="text-[14px] font-semibold text-foreground">Outside the tutor’s scope</p>
        <p className="text-[13px] leading-[1.55] text-muted-foreground">
          The tutor sticks to your coursework and competency areas: statistics, data and technology, digital governance, and professional skills. Try asking about one of those.
        </p>
      </div>
    </div>
  );
}

function NoAnswer({ passages, onRetry }: { passages: number; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-start gap-x-[14px] gap-y-[12px] rounded-[12px] border border-[color:var(--color-border-hover)] bg-[color:var(--color-canvas)]/40 px-[16px] py-[14px]">
      <div className="flex min-w-[240px] flex-1 flex-col gap-[4px]">
        <p className="text-[14px] font-semibold text-foreground">No answer came back</p>
        <p className="text-[13px] leading-[1.55] text-muted-foreground">
          {passages
            ? `The tutor found ${passages} relevant ${passages === 1 ? "passage" : "passages"}, but the AI service returned an empty response. This is usually temporary. You can read the ${passages === 1 ? "passage" : "passages"} below in the meantime.`
            : "The AI service returned an empty response. This is usually temporary."}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-[6px] rounded-[8px] border border-[color:var(--color-border-hover)] px-[12px] py-[6px] text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-[color:var(--color-surface-2)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
        >
          <RotateCcw className="size-[13px]" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

function BasisTag({ basis, sources }: { basis: Basis; sources: number }) {
  const label =
    basis === "general" ? "General knowledge" : `${basis === "blended" ? "Partly sourced" : "Sourced"} · ${sources} ${sources === 1 ? "passage" : "passages"}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px] rounded-[6px] border px-[7px] py-[2px] text-[11px]",
        basis === "general"
          ? "border-[color:var(--color-moderate)]/30 text-[color:var(--color-moderate)]"
          : "border-[color:var(--color-border-resting)] text-muted-foreground",
      )}
    >
      <span
        className="size-[5px] rounded-full"
        style={{ background: basis === "material" ? "var(--color-grow)" : "var(--color-moderate)" }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function BasisNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-[10px] rounded-[10px] bg-[color:var(--color-moderate-bg)] px-[12px] py-[9px] text-[13px] leading-[1.55] text-muted-foreground">
      <span className="mt-[7px] size-[6px] shrink-0 rounded-full bg-[color:var(--color-moderate)]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function FollowUp({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] border border-[color:var(--color-border-resting)] px-[10px] py-[5px] text-[13px] text-muted-foreground outline-none transition-colors hover:border-[color:var(--color-border-hover)] hover:bg-[color:var(--color-canvas)]/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/60"
    >
      {children}
    </button>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className="size-[6px] shrink-0 rounded-full"
      style={{ background: severity === "CRITICAL" ? "var(--color-critical)" : "var(--color-moderate)" }}
      aria-hidden
    />
  );
}

/** Retrieval in progress: a caliper scale whose ticks sweep while passages are ranked. */
function Searching() {
  return (
    <div className="flex items-center gap-[10px] text-[13px] text-muted-foreground" role="status">
      <span className="tutor-ticks flex h-[12px] items-end gap-[3px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="w-[2px] rounded-full bg-[color:var(--color-accent-ink)]" style={{ height: i === 2 ? 12 : i % 2 ? 7 : 9, ["--i" as string]: i } as React.CSSProperties} />
        ))}
      </span>
      Searching your material…
    </div>
  );
}

function CaliperMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[14px] text-[color:var(--color-accent-ink)]" aria-hidden>
      <path d="M2 4h12M4 4v4M8 4v8M12 4v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
