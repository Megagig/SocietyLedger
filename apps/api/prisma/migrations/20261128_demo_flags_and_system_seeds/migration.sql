-- Demo tenants: flagged so billing, notifications and platform analytics can ignore them, and so --reset-demo only ever touches them.
ALTER TABLE "associations" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "associations_is_demo_idx" ON "associations"("is_demo");

-- One row per applied one-time seed version.
CREATE TABLE "system_seeds" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "summary" JSONB,
  CONSTRAINT "system_seeds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "system_seeds_key_version_key" ON "system_seeds"("key", "version");
