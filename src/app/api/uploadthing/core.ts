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

const MAX_PERSONAL_DOCUMENTS = 10;

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
    // Lecture recordings (transcribed) and transcripts/captions.
    audio: { maxFileSize: "32MB", maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    text: { maxFileSize: "2MB", maxFileCount: 1 },
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
          fileName: file.name,
          scope: "SHARED",
          processingStatus: "PENDING",
        },
      });

      return { documentId: document.id };
    }),

  // Learner self-study uploads — PERSONAL scope: retrievable only by the
  // uploading learner (tutor + self-evaluation quiz), never by other
  // learners, and never used for official trainer assessments.
  learnerDocument: f({
    "application/pdf": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxFileSize: "16MB", maxFileCount: 1 },
    audio: { maxFileSize: "16MB", maxFileCount: 1 },
    video: { maxFileSize: "32MB", maxFileCount: 1 },
    text: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user || session.user.role !== "LEARNER") {
        throw new UploadThingError("Only learners may upload personal study material.");
      }
      const personalCount = await db.document.count({ where: { ownerId: session.user.id, scope: "PERSONAL" } });
      if (personalCount >= MAX_PERSONAL_DOCUMENTS) {
        throw new UploadThingError(`You can keep up to ${MAX_PERSONAL_DOCUMENTS} personal documents — delete one first.`);
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const document = await db.document.create({
        data: {
          ownerId: metadata.userId,
          uploadThingKey: file.key,
          uploadThingUrl: file.ufsUrl,
          type: file.type,
          fileName: file.name,
          scope: "PERSONAL",
          processingStatus: "PENDING",
        },
      });
      return { documentId: document.id };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
