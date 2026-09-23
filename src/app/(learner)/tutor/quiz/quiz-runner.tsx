"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

interface Q { question:string; A:string;B:string;C:string;D:string; answer:string; why:string; }

async function fetchQuiz(topic: string, signal?: AbortSignal): Promise<Q[]> {
  const res = await fetch("/api/tutor/quiz", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ topic, count:5 }), signal });
  const j = await res.json();
  if(!res.ok) throw new Error(j.error || "Failed");
  return j.questions;
}

export default function QuizRunner({ initialTopic }: { initialTopic: string }) {
  const [topic, setTopic] = useState(initialTopic);
  // Start in the loading state when a topic was passed in, so the mount
  // effect below never has to set state synchronously.
  const [loading, setLoading] = useState(!!initialTopic.trim());
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string|null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>([]);
  const [error, setError] = useState("");

  function start(t: string) {
    if(!t.trim()) return;
    setLoading(true); setError(""); setQs([]); setIdx(0); setPicked(null); setScore(0); setAnswered([]);
    fetchQuiz(t)
      .then((questions) => setQs(questions))
      .catch((e: unknown) => setError((e instanceof Error && e.message) || "Failed to generate quiz. Try again."))
      .finally(() => setLoading(false));
  }

  // Abort on cleanup so Strict Mode's mount/unmount/remount (and leaving the
  // page) doesn't fire two quiz generations that race each other.
  useEffect(()=>{
    if(!initialTopic.trim()) return;
    const ac = new AbortController();
    fetchQuiz(initialTopic, ac.signal)
      .then((questions) => setQs(questions))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError((e instanceof Error && e.message) || "Failed to generate quiz. Try again.");
      })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  },[initialTopic]);

  const q = qs[idx];
  const correct = picked === q?.answer;
  const done = qs.length>0 && answered.filter(Boolean).length===qs.length;
  const isLast = idx === qs.length - 1 && !!picked;

  if(!qs.length && !loading) return (
    <div className="rounded-2xl border bg-[color:var(--color-surface-1)] p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Start a quiz</h1>
      <p className="text-sm text-muted-foreground mt-1">5 predefined MCQs — fast, no uploads needed.</p>
      {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>}
      <div className="mt-4 flex gap-2">
        <input value={topic} onChange={e=>setTopic(e.target.value)} onKeyDown={e=>e.key==="Enter"&&start(topic)} placeholder="e.g. Sampling variance" className="flex-1 rounded-full border px-4 py-2 text-sm outline-none focus:border-[color:var(--color-accent)]" />
        <Button onClick={()=>start(topic)} className="rounded-full">Generate 5 Qs</Button>
      </div>
      <Link href="/tutor" className="text-xs underline mt-3 inline-block">← Back to tutor</Link>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Quiz — {topic} {qs.length?`· ${idx+1}/${qs.length}`:""}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full h-7" onClick={()=>{setQs([]); setTopic("");}}>New topic</Button>
          <Link href="/tutor" className="text-xs border rounded-full px-3 py-1.5 bg-[color:var(--color-surface-1)]">Back</Link>
        </div>
      </div>
      {loading && <p className="text-sm animate-pulse text-muted-foreground">Generating quizes</p>}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm">{error} <Button size="sm" variant="outline" className="ml-2 rounded-full" onClick={()=>start(topic)}>Retry</Button></div>}
      {q && (
        <div className="rounded-2xl border bg-[color:var(--color-surface-1)] p-5 shadow-sm">
          <div className="flex gap-1 mb-3">{qs.map((_,i)=><div key={i} className={cn("h-1.5 flex-1 rounded-full", i<idx?"bg-green-500": i===idx?"bg-[color:var(--color-accent)]": "bg-muted", answered[i]!==undefined && i!==idx && "opacity-60")} />)}</div>
          <div className="font-medium text-[14px]">{q.question.includes("$")||q.question.includes("\\") ? <Markdown>{q.question}</Markdown> : <p>{q.question}</p>}</div>
          <div className="mt-4 grid gap-2">
            {(["A","B","C","D"] as const).map(k=>{
              const isPicked=picked===k, isCorrect=k===q.answer;
              const needsMath = q[k].includes("$") || q[k].includes("\\");
              return <button key={k} disabled={!!picked} onClick={()=>{ setPicked(k); const ok=k===q.answer; if(ok) setScore(s=>s+1); setAnswered(a=>{ const n=[...a]; n[idx]=true; return n; }); }} className={cn("text-left rounded-xl border px-4 py-3 text-sm bg-[color:var(--color-surface-1)]", !picked&&"hover:border-[color:var(--color-accent)]", picked&&isCorrect&&"border-green-500 bg-green-50", picked&&isPicked&&!isCorrect&&"border-red-400 bg-red-50")}>
                <span className="font-bold mr-2">{k})</span>{needsMath ? <Markdown>{q[k]}</Markdown> : <span>{q[k]}</span>}
              </button>
            })}
          </div>
          {picked && <div className={cn("mt-4 rounded-xl px-4 py-3 text-sm border", correct?"bg-green-50 border-green-200":"bg-red-50 border-red-200")}><p className="font-semibold">{correct?"Correct!":`Incorrect — answer ${q.answer}`}</p><div className="mt-2"><Markdown>{q.why}</Markdown></div></div>}
          {picked && (
            <div className="mt-4 flex gap-2">
              {idx < qs.length-1 ? <Button onClick={()=>{ setIdx(i=>i+1); setPicked(null); }} className="rounded-full">Next →</Button> : null}
            </div>
          )}
        </div>
      )}
      {(done || isLast) && (
        <div className="rounded-2xl bg-[#1A1A1A] text-white p-5 animate-in fade-in">
          <p className="font-semibold">Final score: {score} / {qs.length}</p>
          <p className="text-sm opacity-80 mt-1">{score>=4?"Strong — ready for next topic.": score>=3?"Good — review missed concepts.":"Review material and retry."}</p>
          <div className="mt-3 flex gap-2"><Button onClick={()=>start(topic)} className="rounded-full bg-[color:var(--color-surface-1)] text-black">Retry same topic</Button><Button variant="outline" onClick={()=>{setQs([]);}} className="rounded-full border-white/30 text-white">New topic</Button></div>
        </div>
      )}

    </div>
  );
}
