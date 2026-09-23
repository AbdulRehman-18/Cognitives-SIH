import { requireRole } from "@/lib/auth/rbac";
import QuizRunner from "./quiz-runner";

export default async function TutorQuizPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  await requireRole("LEARNER");
  const { topic } = await searchParams;
  return (
    <>
      <div className="page-shell py-6 max-w-[720px]">
        <QuizRunner initialTopic={topic ?? ""} />
      </div>
    </>
  );
}
