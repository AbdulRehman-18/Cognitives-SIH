import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";

// Backs EvidenceDrawer with real CompetencyEvidence rows for the signed-in
// user (PRD "score displays its evidence" — §4.3). Returns exactly what's
// in the database; never recomputes or paraphrases a score.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRoleApi(["LEARNER", "TRAINER", "ADMIN"]);
    const { id: competencyId } = await params;

    const competency = await db.competency.findUnique({ where: { id: competencyId } });
    if (!competency) {
      return NextResponse.json({ error: "Competency not found" }, { status: 404 });
    }

    const userCompetency = await db.userCompetency.findUnique({
      where: { userId_competencyId: { userId: session.user.id, competencyId } },
      include: { evidence: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({
      competencyName: competency.name,
      currentScore: userCompetency?.currentScore ? Number(userCompetency.currentScore) : null,
      evidence: (userCompetency?.evidence ?? []).map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceLabel: sourceLabelFor(row.sourceType, row.sourceId),
        contribution: Number(row.contribution),
        weight: Number(row.weight),
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}

function sourceLabelFor(sourceType: string, sourceId: string): string {
  switch (sourceType) {
    case "ASSESSMENT":
      return `Assessment attempt ${sourceId.slice(0, 8)}`;
    case "PRIOR_TRAINING":
      return `Prior training record ${sourceId.slice(0, 8)}`;
    case "COURSE_COMPLETION":
      return `Course completion ${sourceId.slice(0, 8)}`;
    default:
      return sourceId;
  }
}
