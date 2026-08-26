import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

// Authorization is checked server-side on every protected route and
// mutation. Never trust a role claimed by the client — always re-derive it
// from the session on the server.

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Insufficient role") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Server Component / Server Action guard.
 * Redirects to sign-in when unauthenticated, or to a role-appropriate
 * landing page when the session role isn't in `roles`.
 */
export async function requireRole(
  roles: UserRole | UserRole[],
): Promise<Session> {
  const session = await auth();
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!allowed.includes(session.user.role)) {
    redirect(defaultRouteForRole(session.user.role));
  }

  return session;
}

/**
 * Route Handler guard — throws typed errors instead of redirecting, so API
 * routes can map them to 401/403 JSON responses.
 */
export async function requireRoleApi(
  roles: UserRole | UserRole[],
): Promise<Session> {
  const session = await auth();
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!session?.user) {
    throw new UnauthorizedError();
  }
  if (!allowed.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}

/** Maps a caught auth error to a NextResponse for use in route handlers. */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}

export function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin/overview";
    case "TRAINER":
      return "/trainer/documents";
    case "LEARNER":
    default:
      return "/dashboard";
  }
}
