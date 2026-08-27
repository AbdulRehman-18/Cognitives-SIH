"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackBar({ backHref, backLabel, nextHref, nextLabel, prevHref, prevLabel }: { backHref?: string; backLabel?: string; nextHref?: string; nextLabel?: string; prevHref?: string; prevLabel?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-[8px] py-[6px] -mx-[2px]">
      {backHref ? (
        <Link href={backHref} className="inline-flex items-center gap-[6px] rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[7px] text-[13px] font-medium hover:border-[#C6C2BA] transition">
          <span aria-hidden>←</span> {backLabel ?? "Back"}
        </Link>
      ) : (
        <button onClick={() => router.back()} className="inline-flex items-center gap-[6px] rounded-full border border-[color:var(--color-border-resting)] bg-[color:var(--color-surface-1)] px-[12px] py-[7px] text-[13px] font-medium hover:border-[#C6C2BA] transition">
          <span aria-hidden>←</span> Back
        </button>
      )}
      <div className="flex-1" />
      {prevHref && (
        <Link href={prevHref} className="hidden sm:inline-flex items-center gap-[5px] rounded-full bg-[color:var(--color-surface-1)] border border-[color:var(--color-border-resting)] px-[12px] py-[7px] text-[12px] font-medium hover:bg-[color:var(--color-surface-1)] transition">
          ← {prevLabel ?? "Previous"}
        </Link>
      )}
      {nextHref && (
        <Link href={nextHref} className="inline-flex items-center gap-[5px] rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-canvas)] px-[12px] py-[7px] text-[12px] font-semibold hover:opacity-90 transition">
          {nextLabel ?? "Next"} →
        </Link>
      )}
    </div>
  );
}
