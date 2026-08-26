import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/auth/rbac";
import type { UserRole } from "@prisma/client";

// Next 16 renames middleware.ts -> proxy.ts and defaults it to the Node.js
// runtime, so this can safely call the same `auth()` used by the rest of the
// app (backed by the Prisma adapter) without the old edge/Node split-config
// workaround. This is an OPTIMISTIC, coarse-grained check (redirect
// unauthenticated/wrong-role traffic away fast); every protected server
// component and mutation additionally re-verifies with `requireRole` /
// `requireRoleApi` server-side — this proxy is not the authorization
// boundary by itself.

const ROLE_PREFIXES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/dashboard", roles: ["LEARNER"] },
  { prefix: "/assessment", roles: ["LEARNER"] },
  { prefix: "/gaps", roles: ["LEARNER"] },
  { prefix: "/path", roles: ["LEARNER"] },
  { prefix: "/tutor", roles: ["LEARNER"] },
  { prefix: "/courses", roles: ["LEARNER"] },
  { prefix: "/onboarding", roles: ["LEARNER"] },
  { prefix: "/trainer", roles: ["TRAINER"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;
  const session = await auth();
  const role = session?.user?.role;

  const match = ROLE_PREFIXES.find((r) => nextUrl.pathname.startsWith(r.prefix));
  if (!match) {
    return NextResponse.next();
  }

  if (!role) {
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!match.roles.includes(role)) {
    return NextResponse.redirect(new URL(defaultRouteForRole(role), nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assessment/:path*",
    "/gaps/:path*",
    "/path/:path*",
    "/tutor/:path*",
    "/courses/:path*",
    "/onboarding/:path*",
    "/trainer/:path*",
    "/admin/:path*",
  ],
};
