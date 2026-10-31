-- A standalone thrift group has no cooperatives or welfare, so its roles should not carry those modules' permissions.
-- Left in, they stopped the group's administrator (who does not hold a member's cooperative or welfare permissions) from giving the
-- Ajo Collector or Ajo Officer role: "you can only give a role permissions you hold yourself".
DELETE FROM "role_permissions" rp
USING "roles" r, "associations" a, "permissions" p
WHERE rp."role_id" = r."id"
  AND r."association_id" = a."id"
  AND a."kind" = 'THRIFT_GROUP'
  AND rp."permission_id" = p."id"
  AND (p."key" LIKE 'welfare.%' OR p."key" LIKE 'cooperatives.%');
