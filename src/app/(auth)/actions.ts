"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

export interface AuthActionState {
  error?: string;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    throw error;
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true, roleId: true, jobRole: true },
  });

  if (user?.role === "LEARNER" && (!user.roleId || !user.jobRole)) {
    redirect("/onboarding");
  }

  redirect(defaultRouteForRole(user?.role ?? "LEARNER"));
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: "LEARNER",
    },
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try signing in manually." };
    }
    throw error;
  }

  redirect("/onboarding");
}
