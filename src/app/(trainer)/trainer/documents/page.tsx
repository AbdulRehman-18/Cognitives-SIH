import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function TrainerDocumentsPage() {
  const session = await requireRole("TRAINER");

  return (
    <AppShell roleLabel="Trainer" userName={session.user.name ?? session.user.email ?? "Trainer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload source material for RAG-grounded question generation.
            Arrives in Phase 4.
          </p>
        </div>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>No documents yet</CardTitle>
            <CardDescription>
              The upload pipeline (UploadThing → extract → chunk → embed)
              is built in Phase 4.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </AppShell>
  );
}
