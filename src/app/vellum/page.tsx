import Link from "next/link";

const stats = [
  { label: "Orders today", value: "1" },
  { label: "Revenue", value: "₹4,086" },
  { label: "Blocked attempts", value: "1" },
  { label: "Average order", value: "₹4,086" },
];

export default function VellumPage() {
  return (
    <div className="min-h-screen flex bg-[color:var(--color-canvas)]">
      {/* Sidebar — warm cream, left rail */}
      <aside className="hidden md:flex w-[280px] shrink-0 flex-col bg-[color:var(--color-sidebar-bg)] border-r border-[color:var(--color-border-resting)] px-[16px] py-[24px]">
        <div className="px-[12px] mb-[24px]">
          <h1 className="text-[22px] font-[650] tracking-[-0.02em] leading-none text-foreground">Vellum</h1>
          <p className="text-eyebrow text-[11px] tracking-[0.14em] text-muted-foreground mt-[6px]">Merchant Desk</p>
        </div>

        <nav className="flex flex-col gap-[4px] flex-1" aria-label="Merchant navigation">
          <a
            href="#"
            aria-current="page"
            className="flex items-center gap-[10px] rounded-full bg-[color:var(--color-accent)] text-white px-[14px] py-[10px] text-small font-medium shadow-[var(--shadow-cta)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            Overview
          </a>
          {[
            { label: "Catalog", icon: "cube" },
            { label: "Policy", icon: "shield" },
            { label: "Audit log", icon: "doc" },
            { label: "Settings", icon: "gear" },
          ].map((item) => (
            <a
              key={item.label}
              href="#"
              className="flex items-center gap-[10px] rounded-full px-[14px] py-[10px] text-small font-medium text-muted-foreground hover:bg-[color:var(--color-surface-1)] hover:text-foreground transition-colors duration-[120ms]"
            >
              {item.icon === "cube" && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 1.5L2.5 4.7v6.6L8 14.5l5.5-3.2V4.7L8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M2.5 4.7L8 8l5.5-3.3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M8 8v6.5" stroke="currentColor" strokeWidth="1.3" /></svg>
              )}
              {item.icon === "shield" && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 1.5l5 2.2v4.1c0 2.7-1.8 4.9-5 5.7-3.2-.8-5-3-5-5.7V3.7l5-2.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
              )}
              {item.icon === "doc" && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 2.5h6l3 3v8H4V2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 2.5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M6 8.5h4M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              )}
              {item.icon === "gear" && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8H3.4M12.6 8H14.2M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              )}
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          href="#"
          className="mt-auto flex items-center gap-[8px] rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[14px] py-[10px] text-small font-medium text-foreground hover:border-[color:var(--color-border-hover)] hover:bg-[color:var(--color-surface-1)] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2.5 6.5L8 2.5l5.5 4v5.2c0 .8-.7 1.5-1.5 1.5H4c-.8 0-1.5-.7-1.5-1.5V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M6 13.2V8.5h4v4.7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          Open buyer chat
        </Link>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 bg-[color:var(--color-canvas)]">
        <div className="max-w-[1120px] mx-auto px-[20px] md:px-[40px] lg:px-[48px] py-[28px] md:py-[36px]">
          {/* Header */}
          <div className="mb-[28px]">
            <p className="text-eyebrow text-[11px] tracking-[0.14em] text-[color:var(--color-accent)] mb-[8px]">Overview</p>
            <h1 className="text-[34px] md:text-[42px] font-[600] tracking-[-0.03em] leading-[1.05] text-foreground">The desk</h1>
          </div>

          {/* Stats — 2x2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] mb-[40px]">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-[22px] bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)]/60 p-[22px] md:p-[24px] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-[200ms]"
              >
                <p className="text-eyebrow text-[11px] tracking-[0.14em] text-muted-foreground mb-[14px]">{s.label}</p>
                <p className="num text-[32px] md:text-[36px] font-[420] tracking-[-0.03em] leading-none text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Recent orders */}
          <div>
            <h2 className="text-[22px] md:text-[24px] font-[550] tracking-[-0.02em] text-foreground mb-[16px]">Recent orders</h2>
            <div className="overflow-hidden rounded-[18px] border border-[color:var(--color-border-resting)] shadow-[var(--shadow-table)] bg-[color:var(--color-surface-1)]">
              {/* Table header — warm tan */}
              <div className="hidden md:grid grid-cols-[1.6fr_0.9fr_0.8fr_1.2fr] gap-[16px] bg-[#EDE2CB] px-[20px] py-[12px] border-b border-[color:var(--color-border-resting)]">
                <span className="text-eyebrow text-[11px] tracking-[0.12em] text-muted-foreground">Created</span>
                <span className="text-eyebrow text-[11px] tracking-[0.12em] text-muted-foreground">Status</span>
                <span className="text-eyebrow text-[11px] tracking-[0.12em] text-muted-foreground">Total</span>
                <span className="text-eyebrow text-[11px] tracking-[0.12em] text-muted-foreground">Idempotency</span>
              </div>
              {/* Row */}
              <div className="grid grid-cols-1 md:grid-cols-[1.6fr_0.9fr_0.8fr_1.2fr] gap-[6px] md:gap-[16px] px-[20px] py-[14px] md:py-[16px] items-center bg-[color:var(--color-surface-1)]">
                <span className="text-body text-[14px] text-foreground md:hidden text-muted-foreground text-eyebrow">Created</span>
                <span className="text-[14px] leading-[20px] text-foreground">26 Aug 2026, 2:37 pm</span>
                <span className="flex items-center gap-[6px] md:hidden text-muted-foreground text-eyebrow mt-[6px]">Status</span>
                <span className="inline-flex">
                  <span className="text-[14px] leading-[20px] text-foreground">Paid</span>
                </span>
                <span className="flex items-center gap-[6px] md:hidden text-muted-foreground text-eyebrow mt-[6px]">Total</span>
                <span className="num text-[14px] font-medium text-foreground">₹4,086</span>
                <span className="flex items-center gap-[6px] md:hidden text-muted-foreground text-eyebrow mt-[6px]">Idempotency</span>
                <span className="num text-[13px] leading-[20px] text-muted-foreground font-mono">seed-order-welcome</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
