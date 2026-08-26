"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SourceChunkCard } from "@/components/caliper/source-chunk-card";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { Button } from "@/components/ui/button";

interface Citation {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  refused?: boolean;
}

const FOLLOW_UPS = [
  { label: "Give an example", prompt: "Give a concrete example from the material that illustrates this." },
  { label: "Summarise this", prompt: "Summarise the key points of what you just explained." },
  { label: "Quiz me", prompt: "Quiz me on this topic — ask one MCQ." },
] as const;

export function TutorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errorKind, setErrorKind] = useState<AiErrorKind | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(content: string) {
    const userMessage: ChatMessage = { role: "user", content };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setErrorKind(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const kind: AiErrorKind = body?.kind ?? "NETWORK";
        setErrorKind(kind);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = "";
      let headerParsed = false;
      // eslint-disable-next-line react-hooks/immutability
      let citations: Citation[] = [];
      // eslint-disable-next-line react-hooks/immutability
      let refused = false;

      // Seed assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "", citations: [], refused: false }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!headerParsed) {
          const sep = buffer.indexOf("\n\n");
          if (sep !== -1) {
            const headerJson = buffer.slice(0, sep);
            try {
              const h = JSON.parse(headerJson) as { refused: boolean; citations: Citation[] };
              refused = h.refused;
              citations = h.citations;
            } catch { /* ignore */ }
            buffer = buffer.slice(sep + 2);
            headerParsed = true;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                last.citations = citations;
                last.refused = refused;
              }
              return copy;
            });
          } else {
            continue;
          }
        }
        if (headerParsed && buffer) {
          const text = buffer;
          buffer = "";
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") last.content += text;
            return copy;
          });
        }
      }
      // Flush remaining
      if (buffer) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") last.content += buffer;
          return copy;
        });
      }
    } catch {
      setErrorKind("NETWORK");
    } finally {
      setStreaming(false);
      // scroll
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div ref={listRef} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-md border border-border p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask a question about your course material to get started.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end max-w-[85%] rounded-md bg-[color:var(--color-measure)] px-3 py-2 text-sm text-white" : "self-start max-w-[92%] rounded-md border border-border bg-card px-3 py-2 text-sm"}>
            <p className="whitespace-pre-wrap">{m.content || (streaming && i === messages.length - 1 ? "…" : "")}</p>
            {m.role === "assistant" && m.citations && m.citations.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {m.citations.map((c) => (
                  <SourceChunkCard key={c.id} chunkIndex={c.chunkIndex} content={c.content} similarity={c.similarity} />
                ))}
              </div>
            )}
            {m.role === "assistant" && m.refused && (
              <p className="mt-2 text-xs italic text-muted-foreground">Asked outside the uploaded material — the tutor declined to guess.</p>
            )}
          </div>
        ))}
        {errorKind && <AiErrorState kind={errorKind} onRetry={() => setErrorKind(null)} />}
      </div>

      {lastAssistant && !streaming && !lastAssistant.refused && (
        <div className="flex flex-wrap gap-2">
          {FOLLOW_UPS.map((f) =>
            f.label === "Quiz me" ? (
              <Link key={f.label} href="/assessment/new" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                {f.label}
              </Link>
            ) : (
              <Button key={f.label} variant="outline" size="sm" onClick={() => send(f.prompt)} disabled={streaming}>
                {f.label}
              </Button>
            ),
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() && !streaming) send(input.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your course material…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[color:var(--color-measure)]"
          disabled={streaming}
        />
        <Button type="submit" disabled={streaming || !input.trim()}>
          {streaming ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
