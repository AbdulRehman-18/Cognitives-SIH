-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('SHARED', 'PERSONAL');

-- CreateEnum
CREATE TYPE "PriorTrainingSource" AS ENUM ('SELF_DECLARED', 'IGOT');

-- AlterEnum
ALTER TYPE "AssessmentType" ADD VALUE 'SELF_EVAL';

-- DropForeignKey
ALTER TABLE "LearningPathItem" DROP CONSTRAINT "LearningPathItem_gapId_fkey";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "scope" "DocumentScope" NOT NULL DEFAULT 'SHARED';

-- AlterTable
ALTER TABLE "LearningProgress" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "enrolledAt" TIMESTAMP(3),
ADD COLUMN     "externalEnrolmentId" TEXT;

-- AlterTable
ALTER TABLE "OfficerProfile" ADD COLUMN     "currentAssignment" TEXT,
ADD COLUMN     "igotUserId" TEXT;

-- AlterTable
ALTER TABLE "QuizAnswer" ADD COLUMN     "hintsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PriorTraining" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "competencyIds" TEXT[],
    "source" "PriorTrainingSource" NOT NULL DEFAULT 'SELF_DECLARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapSnapshot" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "competencyId" TEXT NOT NULL,
    "severity" "GapSeverity" NOT NULL,
    "gapSize" INTEGER NOT NULL,

    CONSTRAINT "GapSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriorTraining_userId_idx" ON "PriorTraining"("userId");

-- CreateIndex
CREATE INDEX "GapSnapshot_competencyId_day_idx" ON "GapSnapshot"("competencyId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "GapSnapshot_day_userId_competencyId_key" ON "GapSnapshot"("day", "userId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_externalId_key" ON "Course"("externalId");

-- CreateIndex
CREATE INDEX "Document_ownerId_scope_idx" ON "Document"("ownerId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_userId_courseId_key" ON "LearningProgress"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "LearningPathItem" ADD CONSTRAINT "LearningPathItem_gapId_fkey" FOREIGN KEY ("gapId") REFERENCES "SkillGap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorTraining" ADD CONSTRAINT "PriorTraining_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

