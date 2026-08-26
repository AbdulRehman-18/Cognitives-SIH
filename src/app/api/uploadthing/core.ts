import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";

// UploadThing file router — originals (uploaded bytes) are stored by
// UploadThing's object storage and NEVER touch the relational DB
// (PROJECT-SUMMARY.md architecture decisions). Only the UploadThing
// key/URL + extracted text/vectors are persisted, via the Document row
// created in onUploadComplete below.

const f = createUploadthing();

export const uploadRouter = {
  documentUploader: f({
    "application/pdf": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      maxFileSize: "32MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      // Server-side RBAC even for file uploads (PRD rule 9) — never trust a
      // client-claimed role.
      const session = await auth();
      if (!session?.user || session.user.role !== "TRAINER") {
        throw new UploadThingError("Only trainers may upload source documents.");
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Runs server-side after the upload finishes. Creates the Document
      // row immediately (status PENDING) — the client kicks off
      // extraction/chunking/embedding separately via
      // POST /api/documents/[id]/process, so this callback stays fast.
      const document = await db.document.create({
        data: {
          ownerId: metadata.userId,
          uploadThingKey: file.key,
          uploadThingUrl: file.ufsUrl,
          type: file.type,
          processingStatus: "PENDING",
        },
      });

      return { documentId: document.id };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
