"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { priorTrainingInputSchema, profileDetailsSchema } from "@/lib/validation/onboarding";
import {
  addPriorTrainings,
  formatEducation,
  importIgotHistory,
  recomputeForTaggedCompetencies,
  refreshProfileCompleteness,
} from "@/lib/profile/training-records";

export interface ProfileActionResult {
  ok: boolean;
  message: string;
}

export async function updateBackgroundAction(input: unknown): Promise<ProfileActionResult> {
  const session = await requireRole("LEARNER");
  const parsed = profileDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };

  await db.officerProfile.upsert({
    where: { userId: session.user.id },
    update: {
      education: formatEducation(parsed.data.education, parsed.data.educationField),
      yearsExperience: parsed.data.yearsExperience ?? null,
      currentAssignment: parsed.data.currentAssignment ?? null,
    },
    create: {
      userId: session.user.id,
      education: formatEducation(parsed.data.education, parsed.data.educationField),
      yearsExperience: parsed.data.yearsExperience ?? null,
      currentAssignment: parsed.data.currentAssignment ?? null,
    },
  });
  await refreshProfileCompleteness(session.user.id);
  revalidatePath("/profile");
  return { ok: true, message: "Background saved." };
}

export async function addTrainingsAction(input: unknown): Promise<ProfileActionResult> {
  const session = await requireRole("LEARNER");
  const parsed = z.array(priorTrainingInputSchema).min(1).max(15).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Training ${Number(issue?.path[0] ?? 0) + 1}: ${issue?.message ?? "invalid"}` };
  }
  await addPriorTrainings(session.user.id, parsed.data);
  const updated = await recomputeForTaggedCompetencies(session.user.id, parsed.data.flatMap((t) => t.competencyIds));
  await refreshProfileCompleteness(session.user.id);
  revalidatePath("/profile");
  return { ok: true, message: `Saved — ${updated} competency score${updated === 1 ? "" : "s"} recomputed.` };
}

export async function deletePriorTrainingAction(id: string): Promise<ProfileActionResult> {
  const session = await requireRole("LEARNER");
  const training = await db.priorTraining.findUnique({ where: { id } });
  if (!training || training.userId !== session.user.id) return { ok: false, message: "Training not found." };
  await db.priorTraining.delete({ where: { id } });
  await recomputeForTaggedCompetencies(session.user.id, training.competencyIds);
  await refreshProfileCompleteness(session.user.id);
  revalidatePath("/profile");
  return { ok: true, message: "Training removed and scores recomputed." };
}

export async function importIgotAction(): Promise<ProfileActionResult> {
  const session = await requireRole("LEARNER");
  try {
    const result = await importIgotHistory(session.user.id);
    const updated = await recomputeForTaggedCompetencies(session.user.id, result.competencyIds);
    await refreshProfileCompleteness(session.user.id);
    await db.auditLog.create({
      data: { actorId: session.user.id, action: "IGOT_HISTORY_IMPORTED", resourceType: "OfficerProfile", metadataJson: { imported: result.imported, alreadyPresent: result.alreadyPresent } },
    });
    revalidatePath("/profile");
    if (result.imported === 0) {
      return { ok: true, message: result.alreadyPresent ? "Your iGOT history is already up to date." : "No completed iGOT courses found." };
    }
    return { ok: true, message: `Imported ${result.imported} iGOT course${result.imported === 1 ? "" : "s"} — ${updated} score${updated === 1 ? "" : "s"} recomputed.` };
  } catch (error) {
    console.error("[profile] iGOT import failed", error);
    return { ok: false, message: "Couldn't reach iGOT Karmayogi — try again later." };
  }
}
