-- CreateTable
CREATE TABLE "IgotMockEnrolment" (
    "id" TEXT NOT NULL,
    "igotUserId" TEXT NOT NULL,
    "courseExternalId" TEXT NOT NULL,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgotMockEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IgotMockEnrolment_igotUserId_courseExternalId_key" ON "IgotMockEnrolment"("igotUserId", "courseExternalId");

