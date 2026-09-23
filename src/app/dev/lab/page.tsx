import { LabRunner } from "@/components/lab/lab-runner";
import { EXERCISES, SQL_FIXTURE } from "@/app/(learner)/lab/exercises";

// Dev-only component review for the virtual lab (no auth, like the other /dev pages).
export default function DevLabPage() {
  return (
    <div className="page-shell py-[28px] max-w-[1160px]">
      <LabRunner exercises={EXERCISES} fixture={SQL_FIXTURE} />
    </div>
  );
}
