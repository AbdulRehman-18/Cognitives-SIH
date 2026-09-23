"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  added: number;
  updated: number;
  skipped: string[];
  embedded: number;
  embedError: string | null;
}

export function IgotSyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/igot/catalog", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Partial<SyncResult> & { error?: string };
      if (!res.ok) {
        setResult(data.error ?? "Catalog sync failed.");
        return;
      }
      const parts = [`${data.added} added`, `${data.updated} updated`, `${data.embedded} embedded`];
      if (data.skipped?.length) parts.push(`${data.skipped.length} skipped (no framework competency)`);
      setResult(data.embedError ? `${parts.join(" · ")} — embedding failed: ${data.embedError}` : parts.join(" · "));
      startTransition(() => router.refresh());
    } catch {
      setResult("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-[8px]">
      <button
        type="button"
        onClick={sync}
        disabled={busy || pending}
        className="rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[14px] py-[8px] text-[13px] font-semibold disabled:opacity-50"
      >
        {busy ? "Syncing catalog…" : "Sync iGOT catalog"}
      </button>
      {result && <p className="text-[12px] text-muted-foreground" role="status">{result}</p>}
    </div>
  );
}
