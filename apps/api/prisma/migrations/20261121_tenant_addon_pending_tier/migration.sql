-- A staff downgrade of an add-on tier waits for the end of the paid period (T9). The row keeps the tier it was bought on and records the
-- tier it moves to; the renewal quote prices the new tier and ends this one. Nothing changes today and nothing is charged.
ALTER TABLE "tenant_addons" ADD COLUMN IF NOT EXISTS "pending_addon_id" INTEGER;
