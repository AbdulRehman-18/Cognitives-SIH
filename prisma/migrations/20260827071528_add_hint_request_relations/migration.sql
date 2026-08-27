-- DropIndex
DROP INDEX "course_embedding_idx";

-- DropIndex
DROP INDEX "document_chunk_embedding_idx";

-- CreateTable
CREATE TABLE "HintRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "quizAttemptId" TEXT,
    "tier" INTEGER NOT NULL,
    "guideResponseText" TEXT NOT NULL,
    "verifierPassed" BOOLEAN NOT NULL,
    "reasoning" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HintRequest_userId_questionId_idx" ON "HintRequest"("userId", "questionId");

-- CreateIndex
CREATE INDEX "HintRequest_quizAttemptId_idx" ON "HintRequest"("quizAttemptId");

-- AddForeignKey
ALTER TABLE "HintRequest" ADD CONSTRAINT "HintRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintRequest" ADD CONSTRAINT "HintRequest_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintRequest" ADD CONSTRAINT "HintRequest_quizAttemptId_fkey" FOREIGN KEY ("quizAttemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
