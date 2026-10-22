-- Notifications written before push_type existed have no destination. Fill it in for the ones whose meaning is unambiguous.
UPDATE "notifications" SET "push_type" = 'support.ticket_created' WHERE "push_type" IS NULL AND "title" = 'New support ticket';
UPDATE "notifications" SET "push_type" = 'savings.deposit_decision' WHERE "push_type" IS NULL AND "type" IN ('savings.deposit_approved', 'savings.deposit_rejected');
UPDATE "notifications" SET "push_type" = 'loan.repayment_decision' WHERE "push_type" IS NULL AND "type" IN ('loan.repayment_confirmed', 'loan.repayment_rejected');
UPDATE "notifications" SET "push_type" = 'announcement' WHERE "push_type" IS NULL AND "type" = 'announcement';
