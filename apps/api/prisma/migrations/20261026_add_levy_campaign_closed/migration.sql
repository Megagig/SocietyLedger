-- A closed levy campaign takes no new members; the charges already raised stay owed until paid, waived or voided one by one.
ALTER TYPE "LevyCampaignStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
