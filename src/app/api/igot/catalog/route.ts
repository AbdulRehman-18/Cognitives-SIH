import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { requireRoleApi } from "@/lib/auth/rbac";
import { syncCatalog } from "@/lib/igot/sync";
import { igotErrorResponse } from "../errors";

// Admin: pull the iGOT Karmayogi course catalogue into Course and embed new rows.
export const maxDuration = 60;

export async function POST() {
  try {
    const session = await requireRoleApi("ADMIN");
    const result = await syncCatalog();
    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "IGOT_CATALOG_SYNCED",
        resourceType: "Course",
        metadataJson: { added: result.added, updated: result.updated, skipped: result.skipped.length, embedded: result.embedded },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return igotErrorResponse(error);
  }
}
