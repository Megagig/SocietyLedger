-- Plan-switch fields: store the next plan+cycle until the current period ends.
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "pending_plan_id"       INTEGER,
  ADD COLUMN IF NOT EXISTS "pending_billing_cycle"  "BillingCycle";
