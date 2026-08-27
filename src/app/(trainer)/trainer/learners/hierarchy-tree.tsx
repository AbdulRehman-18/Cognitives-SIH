"use client";
import { useState } from "react";

type Learner = { name: string; email: string; score: number | null; attempts: number };
type Dept = { name: string; learnerCount: number; learners: Learner[] };

export default function HierarchyTree({ hierarchy, weak }: { hierarchy: Dept[]; weak: { name: string; domain: string; rate: number }[] }) {
  const [openDepts, setOpenDepts] = useState<Set<string>>(() => new Set(hierarchy.slice(0, 2).map((d) => d.name)));
  const toggle = (n: string) => setOpenDepts((s) => { const ns = new Set(s); ns.has(n) ? ns.delete(n) : ns.add(n); return ns; });

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Weak competencies callout */}
      {weak.length > 0 && (
        <div className="rounded-[16px] border border-[#FECACA] bg-[#FFF1F0] p-[16px]">
          <h2 className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#C9190B]">Attention — competencies needing support</h2>
          <div className="mt-[10px] grid grid-cols-1 md:grid-cols-2 gap-[8px]">
            {weak.map((c) => (
              <div key={c.name} className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[#FECACA]/60 px-[12px] py-[10px] flex items-center justify-between gap-[10px]">
                <div>
                  <p className="text-[13px] font-semibold leading-tight">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.domain}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F04438] text-white px-[9px] py-[4px] text-[11px] font-bold tabular-mono">{Math.round(c.rate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
        <div className="flex items-center gap-[10px]">
          <span className="size-[28px] rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] grid place-items-center text-[12px] font-bold">◈</span>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Organization</p>
            <p className="text-[14px] font-[650] leading-none mt-[2px]">MoSPI — all divisions</p>
          </div>
          <span className="ml-auto text-[11px] tabular-mono text-muted-foreground hidden sm:inline">{hierarchy.reduce((s, d) => s + d.learnerCount, 0)} officers</span>
        </div>

        <div className="mt-[16px] relative pl-[14px] border-l border-[color:var(--color-border-resting)] flex flex-col gap-[12px]">
          {hierarchy.map((dept) => {
            const isOpen = openDepts.has(dept.name);
            return (
              <div key={dept.name} className="relative">
                <span className="absolute -left-[19px] top-[18px] size-[10px] rounded-full bg-[color:var(--color-surface-1)] border-2 border-[#2E3AFF] shadow-sm" />
                <button onClick={() => toggle(dept.name)} className="w-full text-left rounded-[12px] border bg-[color:var(--color-surface-1)] hover:bg-[color:var(--color-surface-1)] px-[14px] py-[12px] flex items-center gap-[10px] transition" style={{ borderColor: isOpen ? "#2E3AFF" : "var(--color-border-resting)" }}>
                  <span className={`size-7 rounded-full grid place-items-center text-[12px] font-bold border shrink-0 ${isOpen ? "bg-[#2E3AFF] text-white border-[#2E3AFF]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`}>{isOpen ? "−" : "+"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{dept.name}</p>
                    <p className="text-[11px] tabular-mono text-muted-foreground">{dept.learnerCount} learner{dept.learnerCount !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="hidden sm:inline-flex rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[10px] py-[4px] text-[11px] font-medium">{isOpen ? "Collapse" : "Expand"}</span>
                </button>

                {isOpen && (
                  <div className="mt-[10px] ml-[8px] pl-[18px] border-l border-dashed border-[color:var(--color-border-resting)] flex flex-col gap-[8px]">
                    {dept.learners.map((l) => (
                      <div key={l.email} className="rounded-[12px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[11px] flex items-center gap-[10px] hover:border-[#C6C2BA] transition">
                        <span className="size-8 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] grid place-items-center text-[11px] font-bold shrink-0">{l.name.slice(0, 1).toUpperCase()}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{l.name}</p>
                          <p className="text-[11px] tabular-mono text-muted-foreground truncate">{l.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`num text-[13px] font-semibold tabular-mono ${l.score !== null && l.score < 50 ? "text-[#C9190B]" : "text-[#0E7A4B]"}`}>{l.score !== null ? `${l.score.toFixed(1)} avg` : "—"}</p>
                          <p className="text-[11px] tabular-mono text-muted-foreground">{l.attempts} attempt{l.attempts !== 1 ? "s" : ""}</p>
                        </div>
                        <span className={`hidden sm:inline-flex size-2 rounded-full shrink-0 ${l.score !== null && l.score < 50 ? "bg-[#F04438]" : "bg-[#12B76A]"}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
