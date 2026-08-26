import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { AppShell } from "@/components/app-shell";
import { DocumentUpload } from "@/app/(trainer)/trainer/documents/document-upload";
import { DocumentList, type DocumentSummary } from "@/app/(trainer)/trainer/documents/document-list";

export default async function TrainerDocumentsPage() {
  const session = await requireRole("TRAINER");

  const documents = await db.document.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      processingStatus: true,
      errorMessage: true,
      chunkCount: true,
      createdAt: true,
    },
  });

  const initialDocuments: DocumentSummary[] = documents.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <AppShell roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload source material for RAG-grounded question generation. Every
            generated question stays traceable to the chunk it came from.
          </p>
        </div>
        <DocumentUpload />
        <DocumentList initialDocuments={initialDocuments} />
      </div>
    </AppShell>
  );
}
