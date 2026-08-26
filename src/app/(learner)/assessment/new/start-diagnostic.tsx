"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { Loader2 } from "lucide-react";

type Status = "idle" | "generating" | "error";

export function StartDiagnostic() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("idle");
  const [errorKind, setErrorKind] = React.useState<AiErrorKind>("NETWORK");

  const handleStart = React.useCallback(async () => {
    setStatus("generating");
    try {
      const res = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionsPerCompetency: 2 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKind((body.kind as AiErrorKind) ?? "NETWORK");
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { assessmentId: string };
      router.push(`/assessment/${data.assessmentId}`);
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
    }
  }, [router]);

  if (status === "error") {
    return <AiErrorState kind={errorKind} onRetry={handleStart} />;
  }

  return (
    <Card className="rounded-md">
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Questions are generated for the competencies your role weighs most
          heavily. Scoring is computed by a fixed formula from your answers —
          never by the AI.
        </p>
        <Button onClick={handleStart} disabled={status === "generating"} className="w-fit">
          {status === "generating" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Preparing your diagnostic…
            </>
          ) : (
            "Begin diagnostic"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
