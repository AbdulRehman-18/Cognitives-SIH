import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import Link from "next/link";
import { igotMode } from "@/lib/igot";
import { formatDateTime } from "@/lib/format";
import { IgotSyncButton } from "./igot-sync-button";

function Toggle({ checked }: { checked?: boolean }) {
  return <span className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full border transition ${checked ? "bg-[#2E3AFF] border-[#2E3AFF]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`}><span className={`inline-block size-[16px] rounded-full bg-[color:var(--color-surface-1)] shadow-sm transition ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} /></span>;
}

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const [deptCount, roleCount, igotCourseCount, syncedCount, lastSync, enrolmentCount] = await Promise.all([
    db.department.count(),
    db.role.count(),
    db.course.count({ where: { source: "IGOT" } }),
    db.course.count({ where: { source: "IGOT", externalId: { not: null } } }),
    db.course.aggregate({ _max: { lastSyncedAt: true } }),
    db.learningProgress.count({ where: { externalEnrolmentId: { not: null } } }),
  ]);
  const mode = igotMode();
  const lastSyncedAt = lastSync._max.lastSyncedAt;

  return (
    <>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[18px]">
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Admin settings</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[8px]">Tune workforce intelligence — who sees what, when you’re alerted, and how data is retained. Aggregate only.</p>
          <p className="text-[12px] tabular-mono text-muted-foreground mt-[6px]">{deptCount} divisions · {roleCount} roles · MoSPI DIID/NSSTA</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          <nav className="lg:col-span-3 lg:sticky lg:top-[24px] h-fit rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[8px] flex lg:flex-col gap-[4px] overflow-x-auto">
            {[
              { id: "igot", label: "iGOT", active: true },
              { id: "org", label: "Organization" },
              { id: "alerts", label: "Alerts" },
              { id: "access", label: "Access" },
              { id: "data", label: "Data" },
            ].map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`shrink-0 rounded-full px-[14px] py-[8px] text-[13px] font-medium text-center ${s.active ? "bg-[color:var(--color-ink)] text-[color:var(--color-canvas)]" : "text-muted-foreground hover:bg-[color:var(--color-surface-1)] hover:text-foreground"}`}>{s.label}</a>
            ))}
          </nav>

          <div className="lg:col-span-9 flex flex-col gap-[16px]">
            <section id="igot" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-[12px]">
                <div>
                  <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Integrations</h2>
                  <h3 className="text-[16px] font-[650] mt-[4px]">iGOT Karmayogi</h3>
                  <p className="text-[12px] text-muted-foreground mt-[4px] max-w-[60ch]">Course catalogue, enrolments and completions. Completions sync nightly and on demand, and feed competency scores as evidence.</p>
                </div>
                <span className={`rounded-full border px-[10px] py-[4px] text-[11px] font-semibold ${mode === "live" ? "bg-[#F0FDF4] text-[#0E7A4B] border-[#BBF7D0]" : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"}`}>
                  {mode === "live" ? "Live API" : "Mock mode — simulated iGOT"}
                </span>
              </div>
              <div className="mt-[12px] grid grid-cols-3 gap-[10px]">
                {[
                  { k: "iGOT courses", v: `${syncedCount}/${igotCourseCount} synced` },
                  { k: "Last catalog sync", v: lastSyncedAt ? formatDateTime(lastSyncedAt) : "Never" },
                  { k: "Tracked enrolments", v: String(enrolmentCount) },
                ].map((m) => (
                  <div key={m.k} className="rounded-[12px] border border-[color:var(--color-border-resting)] px-[12px] py-[10px]">
                    <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">{m.k}</p>
                    <p className="text-[13px] font-medium mt-[4px] tabular-mono">{m.v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-[12px]">
                <IgotSyncButton />
              </div>
            </section>

            <section id="org" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Organization</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Structure</h3>
              <div className="mt-[12px] grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <Link href="/admin/departments" className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[14px] hover:border-[#C6C2BA] transition">
                  <p className="text-[13px] font-semibold">Manage divisions</p><p className="text-[11px] text-muted-foreground mt-[2px]">{deptCount} divisions · drill to roles & officers</p>
                </Link>
                <Link href="/admin/roles" className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[14px] hover:border-[#C6C2BA] transition">
                  <p className="text-[13px] font-semibold">Manage roles</p><p className="text-[11px] text-muted-foreground mt-[2px]">{roleCount} vectors · required levels + weights</p>
                </Link>
              </div>
            </section>

            <section id="alerts" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Alerts</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Workforce signals</h3>
              <div className="mt-[12px] flex flex-col gap-[10px]">
                {[
                  { t: "New critical shortage", d: "A competency crosses critical threshold org-wide", on: true },
                  { t: "Department spike", d: "Division critical count jumps >2 in a week", on: true },
                  { t: "Trainer inactivity", d: "No document/assessment in 14 days", on: false },
                  { t: "Weekly digest", d: "Monday summary of gaps + exposures", on: true },
                ].map((r) => (
                  <label key={r.t} className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px] cursor-pointer">
                    <div><p className="text-[13px] font-medium">{r.t}</p><p className="text-[11px] text-muted-foreground">{r.d}</p></div>
                    <Toggle checked={r.on} />
                  </label>
                ))}
              </div>
            </section>

            <section id="access" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Access</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Who sees aggregate</h3>
              <div className="mt-[12px] rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[14px] flex items-center justify-between">
                <div><p className="text-[13px] font-medium">Aggregate-only view</p><p className="text-[11px] text-muted-foreground">Admins never see personal diagnostic scores — only gaps</p></div>
                <span className="rounded-full bg-[#F0FDF4] text-[#0E7A4B] border border-[#BBF7D0] px-[10px] py-[4px] text-[11px] font-semibold">Enforced</span>
              </div>
            </section>

            <section id="data" className="rounded-[16px] border border-[#FECACA]/30 bg-[#FFF1F0] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#C9190B]">Data</h2>
              <h3 className="text-[16px] font-[650] mt-[4px] text-foreground">Retention</h3>
              <p className="text-[13px] leading-[1.6] text-[#6B6560] mt-[6px]">Skill gaps are recomputed on each diagnostic. Exports are aggregate CSVs — no PII.</p>
              <div className="mt-[12px] flex flex-wrap gap-[8px]">
                <button className="rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[14px] py-[8px] text-[13px] font-semibold">Export workforce CSV</button>
                <button className="rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[8px] text-[13px] font-medium">Purge stale gaps</button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
