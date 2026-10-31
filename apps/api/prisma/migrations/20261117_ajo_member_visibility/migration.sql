-- Transparency (spec §16): each rule version says whether the circle's members may see each other on the Circle board, and how names are
-- shown. Every existing version is OFF, so no circle becomes visible until its admin publishes a new version with FULL (7 days' notice,
-- and each member accepts it); collector-thrift versions can only ever be OFF.
ALTER TABLE "ajo_group_rule_versions" ADD COLUMN IF NOT EXISTS "member_visibility" TEXT NOT NULL DEFAULT 'OFF';
ALTER TABLE "ajo_group_rule_versions" ADD COLUMN IF NOT EXISTS "name_display" TEXT NOT NULL DEFAULT 'FIRST_INITIAL';

ALTER TABLE "ajo_group_rule_versions" DROP CONSTRAINT IF EXISTS "ajo_group_rule_versions_visibility_check";
ALTER TABLE "ajo_group_rule_versions" ADD CONSTRAINT "ajo_group_rule_versions_visibility_check" CHECK (
  "member_visibility" IN ('FULL', 'OFF') AND "name_display" IN ('FIRST_INITIAL', 'FULL')
);
