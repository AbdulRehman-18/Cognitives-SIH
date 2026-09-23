import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/rbac";
import { IgotError } from "@/lib/igot";

/** Maps auth and iGOT errors to JSON responses; rethrows anything else. */
export function igotErrorResponse(error: unknown): NextResponse {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof IgotError) {
    const status = error.status && error.status < 500 ? error.status : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  throw error;
}
