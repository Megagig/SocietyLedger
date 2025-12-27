-- AlterTable
ALTER TABLE "members" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "emergency_contact_name" TEXT,
ADD COLUMN     "emergency_contact_phone" TEXT,
ADD COLUMN     "emergency_contact_relationship" TEXT,
ADD COLUMN     "gender" TEXT NOT NULL DEFAULT 'male',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "state" TEXT;
