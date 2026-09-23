"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { onboardingSchema, parsePriorTrainingsField } from "@/lib/validation/onboarding";
import {
  addPriorTrainings,
  formatEducation,
  importIgotHistory,
  recomputeForTaggedCompetencies,
  refreshProfileCompleteness,
} from "@/lib/profile/training-records";


export interface OnboardingActionState {
  error?: string;
}

export async function completeOnboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const session = await requireRole("LEARNER");

  const parsed = onboardingSchema.safeParse({
    designation: formData.get("designation"),
    departmentId: formData.get("departmentId"),
    roleId: formData.get("roleId"),
    education: formData.get("education") ?? "",
    educationField: formData.get("educationField") ?? "",
    yearsExperience: formData.get("yearsExperience") ?? "",
    currentAssignment: formData.get("currentAssignment") ?? "",
    priorTrainings: parsePriorTrainingsField(formData.get("priorTrainings")),
    importIgot: formData.get("importIgot") === "on",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === "priorTrainings" ? `Training ${Number(issue.path[1] ?? 0) + 1}: ` : "";
    return { error: `${where}${issue?.message ?? "Invalid input"}` };
  }

  const [department, role] = await Promise.all([
    db.department.findUnique({ where: { id: parsed.data.departmentId } }),
    db.role.findUnique({ where: { id: parsed.data.roleId } }),
  ]);

  if (!department || !role) {
    return { error: "Selected division or job role is no longer available. Please choose again." };
  }

  const profile = await db.officerProfile.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id, completeness: 0 },
    include: { history: true },
  });

  const changes: Array<{ field: string; oldValue?: string | null; newValue?: string | null }> = [];
  if (profile.designation !== parsed.data.designation) {
    changes.push({ field: "designation", oldValue: profile.designation, newValue: parsed.data.designation });
  }
  if (profile.department !== department.name) {
    changes.push({ field: "department", oldValue: profile.department, newValue: department.name });
  }
  if (profile.jobRole !== role.name) {
    changes.push({ field: "jobRole", oldValue: profile.jobRole, newValue: role.name });
  }

  // Minimum viable profile complete -> full completeness for the MVP fields.
  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: { departmentId: department.id, roleId: role.id },
    }),
    db.officerProfile.update({
      where: { userId: session.user.id },
      data: {
        designation: parsed.data.designation,
        department: department.name,
        jobRole: role.name,
        education: formatEducation(parsed.data.education, parsed.data.educationField),
        yearsExperience: parsed.data.yearsExperience ?? null,
        currentAssignment: parsed.data.currentAssignment ?? null,
        history: {
          create: changes.map(({ field, oldValue, newValue }) => ({
            field,
            oldValue: oldValue ?? null,
            newValue: newValue ?? null,
          })),
        },
      },
    }),
    db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ONBOARDING_COMPLETED",
        resourceType: "OfficerProfile",
        resourceId: profile.id,
        metadataJson: {
          department: department.name,
          jobRole: role.name,
          priorTrainings: parsed.data.priorTrainings.length,
          igotImport: parsed.data.importIgot,
        },
      },
    }),
  ]);

  // Training history feeds the Competency Engine's priorTraining term. The
  // iGOT import needs the role saved above (the mock derives history from it).
  await addPriorTrainings(session.user.id, parsed.data.priorTrainings);
  const tagged = parsed.data.priorTrainings.flatMap((t) => t.competencyIds);
  if (parsed.data.importIgot) {
    try {
      tagged.push(...(await importIgotHistory(session.user.id)).competencyIds);
    } catch (error) {
      // iGOT being unreachable must not block onboarding — the officer can
      // import later from their profile.
      console.error("[onboarding] iGOT history import failed", error);
    }
  }
  await recomputeForTaggedCompetencies(session.user.id, tagged);
  await refreshProfileCompleteness(session.user.id);

  // PRD §5.4: onboarding is diagnostic, not a dead-end form. Route straight
  // into the single-domain diagnostic instead of a full dashboard so the
  // officer gets immediate measured value before ever seeing dashboard chrome.
  redirect("/onboarding/diagnostic");
}
