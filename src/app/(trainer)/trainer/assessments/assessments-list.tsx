"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AssessmentSummary {
  id: string;
  status: string;
  competencyName: string;
  createdAt: string;
  draftCount: number;
  approvedCount: number;
  rejectedCount: number;
}

/**
 * Trainer's generated assessments: shows the review breakdown (draft /
 * approved / rejected question counts) and gates Publish behind at least
 * one approved question — the same rule the publish route enforces
 * server-side, surfaced here so it isn't a confusing 422 in the console.
 */
export function AssessmentsList({ assessments }: { assessments: AssessmentSummary[] }) {
  const router = useRouter();
  const [publishing, setPublishing] = React.useState<string | null>(null);

  const publish = React.useCallback(
    async (id: string) => {
      setPublishing(id);
      try {
        const res = await fetch(`/api/assessments/${id}/publish`, { method: "POST" });
        if (res.ok) router.refresh();
      } finally {
        setPublishing(null);
      }
    },
    [router],
  );

  if (assessments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No generated assessments yet — use the form above to create one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {assessments.map((a) => (
        <Card key={a.id} className="rounded-md">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{a.competencyName}</span>
                <Badge variant={a.status === "PUBLISHED" ? "default" : "secondary"}>{a.status}</Badge>
              </div>
              <span className="tabular-mono text-xs text-muted-foreground">
                {a.approvedCount} approved · {a.draftCount} in review · {a.rejectedCount} rejected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/trainer/questions?assessmentId=${a.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Review questions
              </Link>
              {a.status !== "PUBLISHED" ? (
                <Button
                  size="sm"
                  onClick={() => publish(a.id)}
                  disabled={a.approvedCount === 0 || publishing === a.id}
                  className={cn(a.approvedCount === 0 && "opacity-60")}
                >
                  {publishing === a.id ? "Publishing…" : "Publish"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
