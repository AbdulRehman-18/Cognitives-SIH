"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// KNOWN ISSUE (next-themes + Next.js 16.2+ / React 19): next-themes injects
// its no-FOUC theme-detection script via React.createElement("script", ...)
// so it lands in the SSR HTML before hydration. React 19 now warns that
// script tags rendered by a component "are never executed on the client" —
// true in general, irrelevant here because the script only needs to run
// once, synchronously, during the initial HTML parse (before React
// hydrates), which it does correctly. This is a confirmed false positive
// (see pacocoursey/next-themes#385, #387; shadcn-ui/ui#10104, #10200) with
// no upstream fix as of this writing. We filter only this exact message so
// real hydration mismatches are never silently hidden.
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError(...args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
