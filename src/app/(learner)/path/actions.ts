"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { PATH_BUDGET_COOKIE, PATH_BUDGET_OPTIONS } from "./budget";

export async function setWeeklyBudgetAction(hours: number): Promise<void> {
  await requireRole("LEARNER");
  if (!(PATH_BUDGET_OPTIONS as readonly number[]).includes(hours)) return;
  (await cookies()).set(PATH_BUDGET_COOKIE, String(hours), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/path");
}
