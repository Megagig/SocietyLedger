-- Dynamic plans: versioned commercial terms, add-ons, subscription terms and plan migrations.
-- Existing plans become version 1 (prices copied, the owner's launch prices applied only when the plan still has the old untouched
-- defaults), existing subscriptions point at that version, and the old per-plan price/feature columns are dropped once copied.

-- CreateEnum
CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('ONBOARDING', 'PURCHASE', 'MANUAL', 'COMPLIMENTARY');

-- CreateEnum
CREATE TYPE "SubscriptionTermKind" AS ENUM ('ONBOARDING', 'PURCHASE', 'RENEWAL', 'PLAN_CHANGE', 'MANUAL', 'EXTENSION', 'MIGRATION');

-- CreateEnum
CREATE TYPE "TenantAddonStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PlanMigrationStatus" AS ENUM ('SCHEDULED', 'APPLIED', 'CANCELLED');

-- New plan presentation columns (additive)
ALTER TABLE "plans"
  ADD COLUMN "badge_label" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN "highlights" JSONB,
  ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "is_recommended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Subscription columns (plan_version_id is made NOT NULL after the backfill below)
ALTER TABLE "subscriptions"
  ADD COLUMN "plan_version_id" INTEGER,
  ADD COLUMN "source" "SubscriptionSource" NOT NULL DEFAULT 'PURCHASE';

-- AlterTable
ALTER TABLE "payment_history" ADD COLUMN     "applied_at" TIMESTAMP(3),
ADD COLUMN     "expected_amount_kobo" INTEGER,
ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "quote" JSONB;

-- CreateTable
CREATE TABLE "plan_versions" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "price_monthly_kobo" INTEGER NOT NULL,
    "price_annual_kobo" INTEGER NOT NULL,
    "limits" JSONB,
    "change_note" TEXT,
    "created_by" INTEGER,
    "published_by" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_version_modules" (
    "id" SERIAL NOT NULL,
    "plan_version_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,

    CONSTRAINT "plan_version_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_version_features" (
    "id" SERIAL NOT NULL,
    "plan_version_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,

    CONSTRAINT "plan_version_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_terms" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "association_id" INTEGER NOT NULL,
    "plan_version_id" INTEGER NOT NULL,
    "kind" "SubscriptionTermKind" NOT NULL,
    "billing_cycle" "BillingCycle" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "amount_kobo" INTEGER NOT NULL DEFAULT 0,
    "payment_history_id" INTEGER,
    "actor_id" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "highlights" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_eligible_plans" (
    "id" SERIAL NOT NULL,
    "addon_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,

    CONSTRAINT "addon_eligible_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_versions" (
    "id" SERIAL NOT NULL,
    "addon_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "price_monthly_kobo" INTEGER NOT NULL,
    "price_annual_kobo" INTEGER NOT NULL,
    "limits" JSONB,
    "change_note" TEXT,
    "created_by" INTEGER,
    "published_by" INTEGER,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_version_modules" (
    "id" SERIAL NOT NULL,
    "addon_version_id" INTEGER NOT NULL,
    "module_id" INTEGER NOT NULL,

    CONSTRAINT "addon_version_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_version_features" (
    "id" SERIAL NOT NULL,
    "addon_version_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,

    CONSTRAINT "addon_version_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_addons" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "addon_version_id" INTEGER NOT NULL,
    "status" "TenantAddonStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_cycle" "BillingCycle" NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "source" "SubscriptionSource" NOT NULL DEFAULT 'PURCHASE',
    "amount_paid_kobo" INTEGER NOT NULL DEFAULT 0,
    "payment_history_id" INTEGER,
    "actor_id" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_migrations" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "from_version_id" INTEGER NOT NULL,
    "to_version_id" INTEGER NOT NULL,
    "status" "PlanMigrationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "effective_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" JSONB,
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" INTEGER NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_versions_plan_id_status_idx" ON "plan_versions"("plan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plan_versions_plan_id_version_key" ON "plan_versions"("plan_id", "version");

-- CreateIndex
CREATE INDEX "plan_version_modules_module_id_idx" ON "plan_version_modules"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_modules_plan_version_id_module_id_key" ON "plan_version_modules"("plan_version_id", "module_id");

-- CreateIndex
CREATE INDEX "plan_version_features_feature_id_idx" ON "plan_version_features"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_version_features_plan_version_id_feature_id_key" ON "plan_version_features"("plan_version_id", "feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_terms_payment_history_id_key" ON "subscription_terms"("payment_history_id");

-- CreateIndex
CREATE INDEX "subscription_terms_subscription_id_idx" ON "subscription_terms"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_terms_association_id_ends_at_idx" ON "subscription_terms"("association_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "addons_code_key" ON "addons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "addon_eligible_plans_addon_id_plan_id_key" ON "addon_eligible_plans"("addon_id", "plan_id");

-- CreateIndex
CREATE INDEX "addon_versions_addon_id_status_idx" ON "addon_versions"("addon_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "addon_versions_addon_id_version_key" ON "addon_versions"("addon_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "addon_version_modules_addon_version_id_module_id_key" ON "addon_version_modules"("addon_version_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_version_features_addon_version_id_feature_id_key" ON "addon_version_features"("addon_version_id", "feature_id");

-- CreateIndex
CREATE INDEX "tenant_addons_association_id_status_idx" ON "tenant_addons"("association_id", "status");

-- CreateIndex
CREATE INDEX "tenant_addons_subscription_id_idx" ON "tenant_addons"("subscription_id");

-- CreateIndex
CREATE INDEX "tenant_addons_payment_history_id_idx" ON "tenant_addons"("payment_history_id");

-- CreateIndex
CREATE INDEX "plan_migrations_status_effective_at_idx" ON "plan_migrations"("status", "effective_at");

-- CreateIndex
CREATE INDEX "plans_is_active_is_public_is_archived_idx" ON "plans"("is_active", "is_public", "is_archived");

-- CreateIndex
CREATE INDEX "subscriptions_plan_version_id_idx" ON "subscriptions"("plan_version_id");

-- CreateIndex
CREATE INDEX "subscriptions_current_period_end_idx" ON "subscriptions"("current_period_end");

-- CreateIndex
CREATE INDEX "payment_history_needs_review_idx" ON "payment_history"("needs_review");

-- AddForeignKey
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_modules" ADD CONSTRAINT "plan_version_modules_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_modules" ADD CONSTRAINT "plan_version_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_features" ADD CONSTRAINT "plan_version_features_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_version_features" ADD CONSTRAINT "plan_version_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_terms" ADD CONSTRAINT "subscription_terms_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_terms" ADD CONSTRAINT "subscription_terms_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_eligible_plans" ADD CONSTRAINT "addon_eligible_plans_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_eligible_plans" ADD CONSTRAINT "addon_eligible_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_versions" ADD CONSTRAINT "addon_versions_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_version_modules" ADD CONSTRAINT "addon_version_modules_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "addon_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_version_modules" ADD CONSTRAINT "addon_version_modules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "platform_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_version_features" ADD CONSTRAINT "addon_version_features_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "addon_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_version_features" ADD CONSTRAINT "addon_version_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_addons" ADD CONSTRAINT "tenant_addons_addon_version_id_fkey" FOREIGN KEY ("addon_version_id") REFERENCES "addon_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_migrations" ADD CONSTRAINT "plan_migrations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_migrations" ADD CONSTRAINT "plan_migrations_from_version_id_fkey" FOREIGN KEY ("from_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_migrations" ADD CONSTRAINT "plan_migrations_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------------------------------------------------------------

-- Version 1 of every existing plan. Prices are stored in kobo.
INSERT INTO "plan_versions" ("plan_id", "version", "status", "price_monthly_kobo", "price_annual_kobo", "limits", "change_note", "published_at", "updated_at")
SELECT
  p."id",
  1,
  'PUBLISHED'::"PlanVersionStatus",
  (
    CASE
      -- Old untouched seed defaults are replaced by the launch prices; anything the owner already edited is kept as it is.
      WHEN p."code" = 'starter'      AND p."price_monthly" = 5000  AND p."price_annual" = 50000  THEN 800000
      WHEN p."code" = 'professional' AND p."price_monthly" = 15000 AND p."price_annual" = 150000 THEN 1000000
      WHEN p."code" = 'enterprise'   AND p."price_monthly" = 35000 AND p."price_annual" = 350000 THEN 1500000
      ELSE ROUND(p."price_monthly" * 100)::INTEGER
    END
  ),
  (
    CASE
      WHEN p."code" = 'starter'      AND p."price_monthly" = 5000  AND p."price_annual" = 50000  THEN 8000000
      WHEN p."code" = 'professional' AND p."price_monthly" = 15000 AND p."price_annual" = 150000 THEN 10000000
      WHEN p."code" = 'enterprise'   AND p."price_monthly" = 35000 AND p."price_annual" = 350000 THEN 15000000
      ELSE ROUND(p."price_annual" * 100)::INTEGER
    END
  ),
  CASE WHEN p."member_limit" IS NOT NULL THEN jsonb_build_object('members', p."member_limit") ELSE '{}'::jsonb END,
  'Migrated from the previous single-price plan',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "plans" p;

-- Carry over which modules and features each plan included.
INSERT INTO "plan_version_modules" ("plan_version_id", "module_id")
SELECT v."id", pm."module_id"
FROM "plan_modules" pm
JOIN "plan_versions" v ON v."plan_id" = pm."plan_id" AND v."version" = 1
WHERE pm."is_enabled" = true
ON CONFLICT DO NOTHING;

INSERT INTO "plan_version_features" ("plan_version_id", "feature_id")
SELECT v."id", pf."feature_id"
FROM "plan_features" pf
JOIN "plan_versions" v ON v."plan_id" = pf."plan_id" AND v."version" = 1
WHERE pf."is_enabled" = true
ON CONFLICT DO NOTHING;

-- Presentation: display order, the recommended plan, and the "Pro" name.
UPDATE "plans" SET "sort_order" = 1 WHERE "code" = 'starter';
UPDATE "plans" SET "sort_order" = 2, "is_recommended" = true, "badge_label" = 'Most popular' WHERE "code" = 'professional';
UPDATE "plans" SET "sort_order" = 3 WHERE "code" = 'enterprise';
UPDATE "plans" SET "name" = 'Pro' WHERE "code" = 'professional' AND "name" = 'Professional';

-- Every existing subscription points at its plan's version 1.
UPDATE "subscriptions" s
SET "plan_version_id" = v."id",
    "source" = CASE WHEN s."status" = 'TRIALING' THEN 'ONBOARDING'::"SubscriptionSource" ELSE 'PURCHASE'::"SubscriptionSource" END
FROM "plan_versions" v
WHERE v."plan_id" = s."plan_id" AND v."version" = 1;

ALTER TABLE "subscriptions" ALTER COLUMN "plan_version_id" SET NOT NULL;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_version_id_fkey"
  FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Retire the old structures (their data now lives on plan_versions)
-- ---------------------------------------------------------------------------------------------------------------------------------

-- A tenant may now hold several subscription rows over time (one per resubscription); access uses the live/newest one.
DROP INDEX IF EXISTS "subscriptions_association_id_plan_id_key";

ALTER TABLE "plans"
  DROP COLUMN "features",
  DROP COLUMN "member_limit",
  DROP COLUMN "price_annual",
  DROP COLUMN "price_monthly";

DROP TABLE "plan_modules";
DROP TABLE "plan_features";
