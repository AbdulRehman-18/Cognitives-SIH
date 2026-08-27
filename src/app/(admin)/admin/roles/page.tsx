import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/components/admin-nav";

function Lollipop({ count }: { count: number }) {
  const max = 10;
  return (
    <div className="flex items-end gap-[3px] h-[28px]">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`w-[4px] rounded-full ${i < count ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-border-resting)]"}`} style={{ height: `${i < count ? 10 + i * 1.6 : 6}px` }} />
      ))}
    </div>
  );
}

export default async function AdminRolesPage() {
  const session = await requireRole("ADMIN");
  const roles = await db.role.findMany({ select: { id: true, name: true, description: true, _count: { select: { roleCompetencies: true, users: true } } }, orderBy: { name: "asc" } });
  const trainerCount = await db.user.count({ where: { role: "TRAINER" } });

  return (
    <AppShell roleLabel="Admin" userName={session.user.name ?? session.user.email ?? "Admin"} nav={<AdminNav />}>
      <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[1100px]">
        <div>
          <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)]">Roles</p>
          <h1 className="text-[28px] md:text-[32px] font-[650] tracking-[-0.03em] mt-[6px]">Roles</h1>
          <p className="text-body text-muted-foreground">Target vectors per role — now with trainer coverage context ({trainerCount} trainers org-wide).</p>
        </div>

        <div className="rounded-[20px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] p-[16px] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-small font-semibold">All roles</h2>
            <span className="text-[11px] tabular-mono text-muted-foreground">{roles.length} roles</span>
          </div>
          {roles.length === 0 ? (
            <div className="mt-[12px] rounded-[12px] border border-dashed px-[14px] py-[16px] text-center text-small">No roles.</div>
          ) : (
            <div className="mt-[12px] grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              {roles.map((r) => (
                <Link key={r.id} href={`/admin/roles/${r.id}`} className="group rounded-[18px] border bg-[color:var(--color-surface-1)] p-[14px] hover:shadow-md transition flex flex-col gap-[10px]" style={{ borderColor: "var(--color-border-resting)" }}>
                  <div className="flex items-start justify-between gap-[8px]">
                    <div className="flex-1">
                      <p className="text-small font-semibold group-hover:text-[color:var(--color-accent)]">{r.name}</p>
                      {r.description ? <p className="text-[11px] text-muted-foreground line-clamp-2 mt-[4px]">{r.description}</p> : null}
                    </div>
                    <span className="shrink-0 size-8 rounded-full bg-[color:var(--color-canvas)] border grid place-items-center group-hover:bg-[color:var(--color-accent)] group-hover:text-white transition">→</span>
                  </div>
                  <div className="flex items-center gap-[12px]">
                    <Lollipop count={r._count.roleCompetencies} />
                    <span className="text-[11px] tabular-mono text-muted-foreground">{r._count.roleCompetencies} comps</span>
                    <span className="ml-auto rounded-full bg-[color:var(--color-canvas)] border px-[8px] py-[3px] text-[11px] tabular-mono">{r._count.users} officers</span>
                  </div>
                  <div className="rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A]/40 px-[10px] py-[7px] text-[11px]"><b>{r._count.users}</b> officers aligned · vector defines gaps</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
