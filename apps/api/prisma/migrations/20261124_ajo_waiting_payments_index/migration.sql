-- The officers' "waiting for you" queue and its badge count look up payments by association and status only (REPORTED, CASH_RECEIVED) and
-- sort by when they were received, and they are asked for every minute by every officer with the app open. The only index that starts with the
-- association also puts the circle next, so the database read every payment the association has ever had to find the few waiting ones.
CREATE INDEX IF NOT EXISTS "ajo_contributions_association_id_status_received_at_idx" ON "ajo_contributions" ("association_id", "status", "received_at");
