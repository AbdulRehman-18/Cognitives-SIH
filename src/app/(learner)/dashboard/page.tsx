import Link from "next/link";
import { requireRole } from "@/lib/auth/rbac";
import { AppShell } from "@/components/app-shell";
import { DomainMatrix } from "@/components/caliper/domain-matrix";
import { buttonVariants } from "@/components/ui/button";

export default async function LearnerDashboardPage() {
  const session = await requireRole("LEARNER");

  return (
    <AppShell roleLabel="Learner" userName={session.user.name ?? session.user.email ?? "Officer"}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Your competency snapshot</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Measured ranges across the four-domain framework.
            </p>
          </div>
          <Link href="/gaps" className={buttonVariants({ variant: "default" })}>
            View prioritized gaps
          </Link>
        </div>
        <DomainMatrix
          domains={[
            { domainCode: "STATISTICAL", domainName: "Statistical", level: null, competencyCount: 10, assessedCount: 0 },
            { domainCode: "TECHNICAL", domainName: "Technical", level: null, competencyCount: 12, assessedCount: 0 },
            { domainCode: "DIGITAL_GOVERNANCE", domainName: "Digital Governance", level: null, competencyCount: 5, assessedCount: 0 },
            { domainCode: "BEHAVIOURAL", domainName: "Behavioural", level: null, competencyCount: 6, assessedCount: 0 },
          ]}
        />
      </div>
    </AppShell>
  );
}
