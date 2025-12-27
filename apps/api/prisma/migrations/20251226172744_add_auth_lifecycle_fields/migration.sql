/*
  Warnings:

  - Added the required column `updated_at` to the `user_approvals` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_approvals" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT,
ADD COLUMN     "verification_code" TEXT,
ADD COLUMN     "verification_expires_at" TIMESTAMP(3),
ALTER COLUMN "is_active" SET DEFAULT false;
