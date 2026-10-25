-- Reminders are decided from the collection ages alone, so the per-lodgment marker added a moment ago is not needed.
ALTER TABLE "cash_lodgments" DROP COLUMN "overdue_notified_at";
