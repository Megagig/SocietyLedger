-- AlterTable
ALTER TABLE "member_invites" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_approvals" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "completed_steps" JSONB NOT NULL DEFAULT '[]',
    "profile_completed" BOOLEAN NOT NULL DEFAULT false,
    "team_invited" BOOLEAN NOT NULL DEFAULT false,
    "members_imported" BOOLEAN NOT NULL DEFAULT false,
    "finance_configured" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "skipped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_association_id_key" ON "onboarding_progress"("association_id");
