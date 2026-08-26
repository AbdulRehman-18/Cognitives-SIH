import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";

export default async function SettingsPage() {
  await requireRole("LEARNER");
  return (
    <AppShell roleLabel="Learner" userName="Officer" nav={<LearnerNav />}>
      <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[840px]">
        <div>
          <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)]">Settings</p>
          <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] mt-[6px]">Settings</h1>
          <p className="text-body text-muted-foreground">Everything a normal platform needs — notifications, privacy, display.</p>
        </div>

        <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[color:var(--color-border-resting)]">
          <section className="p-[20px]">
            <h2 className="text-small font-semibold">Notifications</h2>
            <div className="mt-[12px] flex flex-col gap-[12px]">
              <label className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px]">
                <div><p className="text-small font-medium">New gap detected</p><p className="text-[11px] text-muted-foreground">When a diagnostic flags a critical gap</p></div>
                <input type="checkbox" defaultChecked className="size-4 accent-[var(--color-accent)]" />
              </label>
              <label className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px]">
                <div><p className="text-small font-medium">Weekly path reminder</p><p className="text-[11px] text-muted-foreground">Nudge for your {5}h weekly budget</p></div>
                <input type="checkbox" defaultChecked className="size-4" />
              </label>
              <label className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px]">
                <div><p className="text-small font-medium">Tutor follow-ups</p><p className="text-[11px] text-muted-foreground">Quiz me / Guide me prompts</p></div>
                <input type="checkbox" className="size-4" />
              </label>
            </div>
          </section>

          <section className="p-[20px]">
            <h2 className="text-small font-semibold">Display</h2>
            <div className="mt-[12px] grid grid-cols-1 md:grid-cols-3 gap-[10px]">
              <button className="rounded-[12px] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white px-[12px] py-[12px] text-small font-medium">Warm paper (Vellum)</button>
              <button className="rounded-[12px] border border-[color:var(--color-border-resting)] bg-white px-[12px] py-[12px] text-small font-medium">Light</button>
              <button className="rounded-[12px] border border-[color:var(--color-border-resting)] bg-[#111] text-white px-[12px] py-[12px] text-small font-medium">Dark</button>
            </div>
            <label className="mt-[12px] flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-canvas)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px]">
              <span className="text-small font-medium">Reduce motion</span>
              <input type="checkbox" className="size-4" />
            </label>
          </section>

          <section className="p-[20px]">
            <h2 className="text-small font-semibold">Privacy & data</h2>
            <p className="text-small text-muted-foreground mt-[6px]">Respects DPDPA 2023. Your competencies are measured ranges, stored per role.</p>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              <button className="rounded-full border border-[color:var(--color-border-resting)] bg-white px-[14px] py-[7px] text-small font-medium">Export my data</button>
              <button className="rounded-full border border-[#F04438]/20 bg-[#F04438]/10 text-[#C9190B] px-[14px] py-[7px] text-small font-medium">Delete assessment history</button>
            </div>
          </section>

          <section className="p-[20px] flex flex-wrap items-center gap-[8px]">
            <span className="text-[11px] tabular-mono text-muted-foreground">SkillForge AI · MoSPI DIID · NSSTA</span>
            <span className="ml-auto text-[11px] tabular-mono text-muted-foreground">v0.1 · warm paper theme</span>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
