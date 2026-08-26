"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiErrorState, type AiErrorKind } from "@/components/caliper/ai-error-state";
import { Loader2 } from "lucide-react";

type Status = "idle" | "generating" | "error";

/**
 * PRD §5.4 step 2: one diagnostic, one domain, scoped to the officer's
 * single highest-weighted competency — reuses the exact same generation
 * endpoint (`POST /api/assessments/generate`) as the full/standalone
 * diagnostic (Priority 1 execution note: "reuse the existing
 * diagnostic-generation logic ... rather than writing new generation
 * logic"), just called with one competencyId and 5-8 questions instead of
 * up to six competencies at 1-2 questions each.
 */
export function StartOnboardingDiagnostic({
  competencyId,
  competencyName,
  domainName,
}: {
  competencyId: string;
  competencyName: string;
  domainName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("idle");
  const [errorKind, setErrorKind] = React.useState<AiErrorKind>("NETWORK");

  const handleStart = React.useCallback(async () => {
    setStatus("generating");
    try {
      const res = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencyIds: [competencyId], questionsPerCompetency: 7 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorKind((body.kind as AiErrorKind) ?? "NETWORK");
        setStatus("error");
        return;
      }

      const data = (await res.json()) as { assessmentId: string };
      // context=onboarding tells the runner to route to the partial gap
      // report afterward instead of the generic results screen.
      router.push(`/assessment/${data.assessmentId}?context=onboarding`);
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
    }
  }, [competencyId, router]);

  if (status === "error") {
    return <AiErrorState kind={errorKind} onRetry={handleStart} />;
  }

  return (
    <Card className="w-full max-w-md rounded-md">
      <CardHeader>
        <CardTitle className="text-xl">One quick diagnostic</CardTitle>
        <CardDescription>
          Your role weighs <span className="font-medium text-foreground">{competencyName}</span> (
          {domainName}) most heavily. A handful of questions — one at a time,
          no timer — measures where you stand on it right now. Everything
          else is marked &ldquo;not yet assessed&rdquo; until you diagnose it too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleStart} disabled={status === "generating"} className="w-full">
          {status === "generating" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Preparing your questions…
            </>
          ) : (
            "Begin"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
