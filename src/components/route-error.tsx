"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Shared body for route-segment error.tsx files: keeps the surrounding shell
// on screen and offers a retry instead of a blank page.
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell py-[48px] flex flex-col items-start gap-[12px] max-w-[640px]">
      <h1 className="text-h2 text-foreground">Something went wrong</h1>
      <p className="text-body text-muted-foreground">
        This page failed to load. It may be a temporary problem — try again.
        {error.digest && <span className="block mt-[4px] text-[12px] tabular-mono">Reference: {error.digest}</span>}
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
