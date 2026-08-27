import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { LearnerNav } from "@/components/learner-nav";
import { db } from "@/lib/db/client";
import Link from "next/link";

function Toggle({ checked }: { checked?: boolean }) {
  return (
    <span className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full border transition ${checked ? "bg-[#2E3AFF] border-[#2E3AFF]" : "bg-[color:var(--color-surface-1)] border-[color:var(--color-border-resting)]"}`}>
      <span className={`inline-block size-[16px] rounded-full bg-[color:var(--color-surface-1)] shadow-sm transition ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
    </span>
  );
}

export default async function SettingsPage() {
  const session = await requireRole("LEARNER");
  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, createdAt: true } }),
    db.officerProfile.findUnique({ where: { userId: session.user.id } }),
  ]);

  return (
    <AppShell roleLabel="Learner" userName={user?.name ?? session.user.email ?? "Officer"} nav={<LearnerNav />}>
      <div className="mx-auto max-w-[1100px] px-[20px] lg:px-[24px] py-[32px] flex flex-col gap-[18px]">
        <div className="max-w-[720px]">
          <h1 className="text-[34px] md:text-[40px] font-[720] tracking-[-0.03em] leading-[1.05]">Settings</h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground mt-[8px]">Control your charter, learning rhythm, and data. Everything is on-device first — export or clear anytime.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
          {/* nav */}
          <nav className="lg:col-span-3 lg:sticky lg:top-[24px] h-fit rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[8px] flex lg:flex-col gap-[4px] overflow-x-auto">
            {[
              { id: "account", label: "Account", active: true },
              { id: "learning", label: "Learning" },
              { id: "notifications", label: "Notifications" },
              { id: "privacy", label: "Privacy" },
            ].map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`shrink-0 rounded-full px-[14px] py-[8px] text-[13px] font-medium text-center ${s.active ? "bg-[color:var(--color-ink)] text-[color:var(--color-canvas)]" : "text-muted-foreground hover:bg-[color:var(--color-surface-1)] hover:text-foreground"}`}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="lg:col-span-9 flex flex-col gap-[16px]">
            {/* Account */}
            <section id="account" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <div className="flex items-start justify-between gap-[12px]">
                <div>
                  <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Account</h2>
                  <h3 className="text-[16px] font-[650] mt-[4px]">Your charter</h3>
                  <p className="text-[12px] text-muted-foreground">Synced from your progressive profile. Verified email is your sign-in.</p>
                </div>
                <span className="hidden sm:inline-flex rounded-full bg-[#F0FDF4] text-[#0E7A4B] border border-[#BBF7D0] px-[10px] py-[4px] text-[11px] font-semibold">Verified</span>
              </div>
              <div className="mt-[14px] flex gap-[14px] items-center rounded-[14px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[14px]">
                <div className="size-[44px] rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] grid place-items-center text-[16px] font-[700] shrink-0">{(user?.name ?? "O").slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold truncate">{user?.name ?? "—"}</p>
                  <p className="text-[12px] tabular-mono text-muted-foreground truncate">{user?.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-[2px]">{profile?.designation ?? "Not set"} {profile?.department ? `· ${profile.department}` : ""} {profile?.jobRole ? `· ${profile.jobRole}` : ""}</p>
                </div>
                <Link href="/profile" className="shrink-0 rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[14px] py-[7px] text-[12px] font-semibold">View profile</Link>
              </div>
              <div className="mt-[12px] grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <div className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[11px]"><p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Member since</p><p className="text-[13px] font-medium mt-[4px]">{user ? new Date(user.createdAt).toLocaleDateString() : "—"}</p></div>
                <div className="rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[11px]"><p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Auth</p><p className="text-[13px] font-medium mt-[4px]">Email · NextAuth</p></div>
              </div>
            </section>

            {/* Learning */}
            <section id="learning" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Learning</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Your rhythm</h3>
              <div className="mt-[14px] flex flex-col gap-[10px]">
                <div className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px]">
                  <div><p className="text-[13px] font-medium">Weekly study budget</p><p className="text-[11px] text-muted-foreground">Packs your path · institution-appropriate pacing</p></div>
                  <select defaultValue="5" className="rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[7px] text-[13px] font-medium"><option>5h / week</option><option>8h / week</option><option>10h / week</option></select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                  <label className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px] cursor-pointer">
                    <div><p className="text-[13px] font-medium">Reduce motion</p><p className="text-[11px] text-muted-foreground">Respects system setting</p></div>
                    <Toggle />
                  </label>
                  <label className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px] cursor-pointer">
                    <div><p className="text-[13px] font-medium">High contrast</p><p className="text-[11px] text-muted-foreground">For calibration ticks</p></div>
                    <Toggle checked />
                  </label>
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section id="notifications" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Notifications</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Stay in loop, not noisy</h3>
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {[
                  { t: "New critical gap", d: "Diagnostic flags a 4-level gap", on: true },
                  { t: "Weekly path nudge", d: "Gentle reminder for your 5h budget", on: true },
                  { t: "Tutor follow-ups", d: "Socratic + quiz from your gaps", on: true },
                  { t: "Assessment due", d: "When a re-assessment is recommended", on: false },
                ].map((r) => (
                  <label key={r.t} className="flex items-center justify-between gap-[12px] rounded-[12px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[14px] py-[12px] cursor-pointer">
                    <div><p className="text-[13px] font-medium">{r.t}</p><p className="text-[11px] text-muted-foreground">{r.d}</p></div>
                    <Toggle checked={r.on} />
                  </label>
                ))}
              </div>
            </section>

            {/* Privacy */}
            <section id="privacy" className="rounded-[16px] border border-[color:var(--color-border-resting)] bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] p-[18px]">
              <h2 className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-60">Privacy · DPDPA 2023</h2>
              <h3 className="text-[16px] font-[650] mt-[4px]">Your data, measured ranges</h3>
              <p className="text-[13px] leading-[1.6] opacity-70 mt-[6px]">We store calibrated ranges per competency, not punitive scores. Export a JSON or clear history — you own the trace.</p>
              <div className="mt-[14px] flex flex-wrap gap-[8px]">
                <button className="rounded-full bg-[color:var(--color-surface-1)] text-[#141210] px-[14px] py-[8px] text-[13px] font-semibold">Export my data</button>
                <button className="rounded-full border border-white/20 bg-[color:var(--color-surface-1)]/10 px-[14px] py-[8px] text-[13px] font-medium">Delete assessment history</button>
                <button className="rounded-full border border-[#F04438]/30 bg-[#F04438]/20 text-[#FFD6D0] px-[14px] py-[8px] text-[13px] font-medium">Delete account</button>
              </div>
              <p className="text-[11px] tabular-mono opacity-50 mt-[12px]">SkillForge AI · warm paper · v0.1 · No streaks, no XP</p>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
