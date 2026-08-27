"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles, Loader2 } from "lucide-react";

export function HintButton({ questionId, attemptId, onHintUsed }: { questionId: string; attemptId?: string; onHintUsed?: (count: number)=>void }) {
  const [tier, setTier] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  async function requestHint(useStream = true) {
    setLoading(true);
    setStreamingText("");
    try {
      if (useStream) {
        const res = await fetch("/api/assessment/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, attemptId, stream: true }) });
        if (!res.body) throw new Error("no body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let finalTier: number | null = null;
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const data = JSON.parse(line.slice(5).trim());
            if (data.token) { acc += data.token; setStreamingText(acc); if (data.tier) finalTier = data.tier; }
            if (data.fallback) { acc = data.fallback; setStreamingText(acc); }
            if (data.done) { finalTier = data.tier; }
          }
        }
        setHint(acc); setTier(finalTier);
        if (finalTier) onHintUsed?.(finalTier);
      } else {
        const res = await fetch("/api/assessment/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, attemptId }) });
        const data = await res.json();
        setTier(data.tier); setHint(data.hintText);
        if (data.tier) onHintUsed?.(data.tier);
      }
    } catch {
      const res = await fetch("/api/assessment/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, attemptId }) });
      const data = await res.json().catch(()=>null);
      if (data) { setTier(data.tier); setHint(data.hintText); }
    } finally { setLoading(false); setStreamingText(""); }
  }

  const displayText = loading && streamingText ? streamingText : hint;
  const showHint = !!displayText;

  return (
    <div className="space-y-3">
      {showHint && (
        <div className="relative overflow-hidden rounded-[14px] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-amber-200 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-700 shadow-sm">
              <Lightbulb className="size-3" /> Hint {tier} of 4
            </span>
            <span className="flex gap-1">
              {[1,2,3,4].map(i=> <span key={i} className={"size-1.5 rounded-full transition-colors "+(tier && i<=tier ? "bg-amber-500" : "bg-amber-200")} />)}
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-zinc-700">{displayText}{loading && streamingText ? <span className="inline-block size-2 ml-1 bg-amber-400 rounded-full animate-pulse" /> : null}</p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant={showHint ? "outline" : "secondary"} size="sm" onClick={()=>requestHint(true)} disabled={loading || tier===4} className={"rounded-full gap-1.5 "+(showHint?"":"bg-amber-500 hover:bg-amber-600 text-white border-0")}>
          {loading ? <><Loader2 className="size-3.5 animate-spin" /> Thinking…</> : tier===4 ? "No more hints" : showHint ? <><Sparkles className="size-3.5" /> Another hint</> : <><Lightbulb className="size-3.5" /> Need a hint?</>}
        </Button>
        {tier && <span className="text-xs text-muted-foreground tabular-mono">{tier}/4 used — score multiplier {(Math.max(0.6, 1-0.1*tier)).toFixed(1)}×</span>}
      </div>
    </div>
  );
}
