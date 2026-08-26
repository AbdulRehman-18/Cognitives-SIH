import "server-only";
import { db } from "@/lib/db/client";

export async function logAudit(params: {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? undefined,
        metadataJson: (params.metadata as never) ?? undefined,
      },
    });
  } catch {
    // audit must never break the primary operation
  }
}
