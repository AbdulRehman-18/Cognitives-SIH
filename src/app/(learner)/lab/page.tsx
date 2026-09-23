import { LabRunner } from "@/components/lab/lab-runner";
import { EXERCISES, SQL_FIXTURE } from "./exercises";

export default function LabPage() {
  return (
    <div className="page-shell py-[28px] flex flex-col gap-[16px] max-w-[1160px]">
      <div className="max-w-[720px]">
        <h1 className="text-[24px] font-[650] tracking-[-0.02em]">Virtual lab</h1>
        <p className="text-body text-muted-foreground mt-[6px]">
          Hands-on Python and SQL with official-statistics data — weighted estimates, sample allocation, price indices and survey tables. Code runs in your browser and each exercise is checked automatically. Practice only: it doesn’t change your competency scores.
        </p>
      </div>
      <LabRunner exercises={EXERCISES} fixture={SQL_FIXTURE} />
    </div>
  );
}
