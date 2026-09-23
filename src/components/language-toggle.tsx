"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/dictionaries";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

// Switches the interface language: sets the locale cookie (server action) and re-renders
// server components with the new dictionary. No URL change.
export function LanguageToggle({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={label} className={cn("flex rounded-full border border-[color:var(--color-border-resting)] p-[2px]", pending && "opacity-60")}>
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={cn("rounded-full px-[8px] py-[3px] text-[11px] font-semibold", locale === l ? "bg-[color:var(--color-ink)] text-[color:var(--color-canvas)]" : "text-muted-foreground hover:text-foreground")}
        >
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
