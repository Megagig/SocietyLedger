-- CreateEnum
CREATE TYPE "AssociationTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "AssociationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_AGENT');

-- CreateTable
CREATE TABLE "associations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "tier" "AssociationTier" NOT NULL DEFAULT 'STARTER',
    "status" "AssociationStatus" NOT NULL DEFAULT 'ACTIVE',
    "logo" TEXT,
    "primary_color" TEXT,
    "subscription_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "platform_role" "PlatformRole",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_approvals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" INTEGER,
    "approval_date" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "member_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "join_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "category" TEXT NOT NULL DEFAULT 'regular',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2),
    "frequency" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "member_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "payment_method" TEXT,
    "reference_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT,
    "receipt_number" TEXT,
    "confirmed_by" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "entry_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "reference_number" TEXT,
    "receipt_file_path" TEXT,
    "created_by" INTEGER NOT NULL,
    "approved_by" INTEGER,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "export_type" TEXT NOT NULL,
    "export_format" TEXT NOT NULL,
    "date_range_start" TIMESTAMP(3),
    "date_range_end" TIMESTAMP(3),
    "export_period" TEXT,
    "file_path" TEXT,
    "member_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "updated_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" INTEGER,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_annual" DECIMAL(10,2) NOT NULL,
    "member_limit" INTEGER,
    "features" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "association_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "renewal_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" SERIAL NOT NULL,
    "subscription_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "associations_slug_key" ON "associations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "associations_subdomain_key" ON "associations"("subdomain");

-- CreateIndex
CREATE INDEX "users_association_id_email_idx" ON "users"("association_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_association_id_email_key" ON "users"("association_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "user_approvals_user_id_key" ON "user_approvals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "members_user_id_key" ON "members"("user_id");

-- CreateIndex
CREATE INDEX "members_association_id_status_idx" ON "members"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "members_association_id_member_id_key" ON "members"("association_id", "member_id");

-- CreateIndex
CREATE INDEX "financial_categories_association_id_type_idx" ON "financial_categories"("association_id", "type");

-- CreateIndex
CREATE INDEX "transactions_association_id_status_idx" ON "transactions"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_association_id_payment_date_idx" ON "payments"("association_id", "payment_date");

-- CreateIndex
CREATE INDEX "accounting_entries_association_id_entry_type_idx" ON "accounting_entries"("association_id", "entry_type");

-- CreateIndex
CREATE INDEX "export_history_association_id_export_type_idx" ON "export_history"("association_id", "export_type");

-- CreateIndex
CREATE INDEX "notifications_association_id_type_idx" ON "notifications"("association_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "settings_association_id_key_key" ON "settings"("association_id", "key");

-- CreateIndex
CREATE INDEX "audit_log_association_id_table_name_idx" ON "audit_log"("association_id", "table_name");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "subscriptions_association_id_status_idx" ON "subscriptions"("association_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_association_id_plan_id_key" ON "subscriptions"("association_id", "plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_history_reference_key" ON "payment_history"("reference");

-- CreateIndex
CREATE INDEX "payment_history_subscription_id_status_idx" ON "payment_history"("subscription_id", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_approvals" ADD CONSTRAINT "user_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_approvals" ADD CONSTRAINT "user_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
