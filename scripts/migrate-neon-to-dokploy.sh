#!/bin/sh
# Dumps the existing Neon Postgres database and restores it into the
# Postgres container managed by the Dokploy compose stack.
#
# Usage:
#   NEON_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/societyledger?sslmode=require" \
#   TARGET_DATABASE_URL="postgresql://societyledger:pass@<dokploy-host>:5432/societyledger" \
#   ./scripts/migrate-neon-to-dokploy.sh
#
# Requires postgresql-client (pg_dump/pg_restore) matching (or newer than)
# the Postgres major version on both ends — use 16.x to match postgres:16-alpine.
#
# TARGET_DATABASE_URL must be reachable from where this script runs. If the
# Dokploy Postgres container only exposes its port on the Dokploy host's
# internal docker network, either run this script ON that host, or
# temporarily publish the port (Dokploy UI -> service -> expose 5432) and
# remove the exposure again once the migration is verified.

set -eu

: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL to the current Neon connection string}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL to the new Dokploy Postgres connection string}"

DUMP_FILE="societyledger_neon_$(date +%Y%m%d_%H%M%S).dump"

echo "==> Dumping Neon database to ${DUMP_FILE}"
pg_dump "${NEON_DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${DUMP_FILE}"

echo "==> Restoring into target database"
pg_restore "${TARGET_DATABASE_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --exit-on-error \
  "${DUMP_FILE}"

echo "==> Done. Dump kept at ${DUMP_FILE} (delete once you've verified the data)."
echo "==> Next: point apps/api's DATABASE_URL/DIRECT_URL at the target and run"
echo "    'pnpm --filter @societyledger/api exec prisma migrate status' to confirm"
echo "    the migration history table matches, then smoke-test the app."
