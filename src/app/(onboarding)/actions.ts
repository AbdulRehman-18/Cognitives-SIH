"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { onboardingSchema } from "@/lib/validation/onboarding";

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
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
        completeness: 100,
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
        metadataJson: { department: department.name, jobRole: role.name },
      },
    }),
  ]);

  redirect("/dashboard");
}
