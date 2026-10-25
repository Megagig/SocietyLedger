-- Closing nominations used to send an election back to DRAFT, which made it look unstarted and let nominations be registered again.
ALTER TYPE "ElectionStatus" ADD VALUE IF NOT EXISTS 'NOMINATIONS_CLOSED' AFTER 'NOMINATIONS_OPEN';
