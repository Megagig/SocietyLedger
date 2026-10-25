-- Who recorded a welfare contribution, so the same officer cannot also confirm it. Older contributions stay NULL and can be confirmed by anyone allowed to.
ALTER TABLE "welfare_contributions" ADD COLUMN "recorded_by" INTEGER;
