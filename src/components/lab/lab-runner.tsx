"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LabExercise } from "@/app/(learner)/lab/exercises";

// Virtual lab — runs learner Python (and SQL via Python's sqlite3) entirely
// in the browser with Pyodide, inside a Web Worker so a runaway loop can be
// terminated without freezing the page. Nothing executes on the server.

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const FIRST_RUN_TIMEOUT_MS = 90_000; // includes downloading the Python runtime
const RUN_TIMEOUT_MS = 10_000;

const WORKER_SOURCE = `
importScripts("${PYODIDE_URL}pyodide.js");
let ready = null;
let sqliteLoaded = false;
self.onmessage = async (event) => {
  const { id, language, code, check, fixture } = event.data;
  let out = "";
  try {
    ready ??= loadPyodide({ indexURL: "${PYODIDE_URL}" });
    const py = await ready;
    py.setStdout({ batched: (s) => { out += s + "\\n"; } });
    py.setStderr({ batched: (s) => { out += s + "\\n"; } });
    const ns = py.globals.get("dict")();
    if (language === "sql") {
      if (!sqliteLoaded) { await py.loadPackage("sqlite3"); sqliteLoaded = true; }
      ns.set("_FIXTURE", fixture);
      ns.set("_QUERY", code);
      await py.runPythonAsync(
        "import sqlite3\\n_c = sqlite3.connect(':memory:')\\n_c.executescript(_FIXTURE)\\nresult = [tuple(r) for r in _c.execute(_QUERY).fetchall()]\\nfor _r in result: print(_r)",
        { globals: ns },
      );
    } else {
      await py.runPythonAsync(code, { globals: ns });
    }
    try {
      await py.runPythonAsync(check, { globals: ns });
      self.postMessage({ id, ok: true, output: out });
    } catch (e) {
      const msg = String(e.message || e);
      const assertion = msg.match(/AssertionError:?\\s*(.*)$/m);
      self.postMessage({ id, ok: false, output: out, error: assertion ? "Check failed — " + (assertion[1] || "not quite right yet") : msg.split("\\n").filter(Boolean).slice(-1)[0] });
    }
  } catch (e) {
    const lines = String(e.message || e).split("\\n").filter(Boolean);
    self.postMessage({ id, ok: false, output: out, error: lines.slice(-1)[0] || "Your code raised an error." });
  }
};
`;

interface RunResult {
  ok: boolean;
  output: string;
  error?: string;
}

export function LabRunner({ exercises, fixture }: { exercises: LabExercise[]; fixture: string }) {
  const [activeId, setActiveId] = useState(exercises[0]?.id ?? "");
  const [code, setCode] = useState<Record<string, string>>(() => Object.fromEntries(exercises.map((e) => [e.id, e.starter])));
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [running, setRunning] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const runSeq = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const exercise = exercises.find((e) => e.id === activeId) ?? exercises[0];
  const result = results[exercise.id];
  const passedCount = exercises.filter((e) => results[e.id]?.ok).length;

  function getWorker(): Worker {
    if (!workerRef.current) {
      const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      workerRef.current = new Worker(url);
      URL.revokeObjectURL(url);
    }
    return workerRef.current;
  }

  function run() {
    const id = ++runSeq.current;
    const target = exercise;
    setRunning(true);
    const worker = getWorker();
    const timeout = setTimeout(() => {
      // Kill the worker (the only way to stop runaway Python) and start fresh next run.
      worker.terminate();
      workerRef.current = null;
      setRuntimeReady(false);
      setResults((r) => ({ ...r, [target.id]: { ok: false, output: "", error: "Stopped: your code ran too long (possible infinite loop)." } }));
      setRunning(false);
    }, runtimeReady ? RUN_TIMEOUT_MS : FIRST_RUN_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<RunResult & { id: number }>) => {
      if (event.data.id !== id) return;
      clearTimeout(timeout);
      setRuntimeReady(true);
      setResults((r) => ({ ...r, [target.id]: { ok: event.data.ok, output: event.data.output, error: event.data.error } }));
      setRunning(false);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      workerRef.current = null;
      setResults((r) => ({ ...r, [target.id]: { ok: false, output: "", error: "Couldn't start the Python runtime — check your connection and try again." } }));
      setRunning(false);
    };
    worker.postMessage({ id, language: target.language, code: code[target.id], check: target.check, fixture });
  }

  return (
    <div className="grid gap-[16px] lg:grid-cols-[260px_1fr]">
      <nav aria-label="Exercises" className="flex lg:flex-col gap-[6px] overflow-x-auto">
        {exercises.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setActiveId(e.id)}
            aria-current={e.id === exercise.id ? "true" : undefined}
            className={cn(
              "shrink-0 text-left rounded-[12px] border px-[12px] py-[10px] transition",
              e.id === exercise.id ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5" : "border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] hover:border-[color:var(--color-border-hover)]",
            )}
          >
            <span className="flex items-center justify-between gap-[8px] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {e.competency}
              {results[e.id]?.ok && <span className="text-[#0E7A4B]">✓ Passed</span>}
            </span>
            <span className="mt-[2px] block text-[13px] font-medium">{e.title}</span>
          </button>
        ))}
        <p className="hidden lg:block px-[4px] pt-[6px] text-[11px] tabular-mono text-muted-foreground">{passedCount}/{exercises.length} passed this session</p>
      </nav>

      <section className="flex flex-col gap-[12px] rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[16px]">
        <div>
          <h2 className="text-[16px] font-[650]">{exercise.title}</h2>
          <p className="text-[13px] text-muted-foreground mt-[4px]">{exercise.brief}</p>
          {exercise.language === "sql" && <p className="text-[11px] tabular-mono text-muted-foreground mt-[4px]">SQLite · table: households(hh_id, district, sector, hh_size, mpce)</p>}
        </div>
        <textarea
          value={code[exercise.id]}
          onChange={(e) => setCode((c) => ({ ...c, [exercise.id]: e.target.value }))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: s, selectionEnd: end, value } = el;
              const next = `${value.slice(0, s)}    ${value.slice(end)}`;
              setCode((c) => ({ ...c, [exercise.id]: next }));
              requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
            }
          }}
          spellCheck={false}
          aria-label={`${exercise.language === "sql" ? "SQL" : "Python"} code editor`}
          className="min-h-[220px] w-full resize-y rounded-[12px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-canvas)] p-[12px] font-mono text-[13px] leading-[1.55] outline-none focus:border-[color:var(--color-accent)]"
        />
        <div className="flex flex-wrap items-center gap-[10px]">
          <button type="button" onClick={run} disabled={running} className="rounded-full bg-[color:var(--color-accent)] px-[16px] py-[8px] text-[13px] font-semibold text-white disabled:opacity-60">
            {running ? (runtimeReady ? "Running…" : "Loading Python runtime…") : "Run & check"}
          </button>
          <button type="button" onClick={() => setCode((c) => ({ ...c, [exercise.id]: exercise.starter }))} className="rounded-full border border-[color:var(--color-border-resting)] px-[14px] py-[7px] text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Reset code
          </button>
          <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to run · runs in your browser · practice only</span>
        </div>
        {result && (
          <div className="flex flex-col gap-[8px]" role="status">
            <p className={cn("rounded-[10px] border px-[12px] py-[8px] text-[13px] font-medium", result.ok ? "border-[#12B76A]/30 bg-[#12B76A]/10 text-[#0E7A4B]" : "border-[#F04438]/30 bg-[#F04438]/10 text-[#C9190B]")}>
              {result.ok ? "✓ All checks passed" : result.error}
            </p>
            {result.output && <pre className="max-h-[200px] overflow-auto rounded-[10px] bg-[color:var(--color-ink)] p-[12px] text-[12px] text-[color:var(--color-canvas)] whitespace-pre-wrap">{result.output}</pre>}
          </div>
        )}
      </section>
    </div>
  );
}
