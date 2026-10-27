#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

# Reference data the app cannot work without (roles and permissions, modules, the default plans, help content,
# the platform association) plus the first super admin. Every script is safe to repeat. They run on
# each start on purpose: new permissions and modules ship with the code.
# The order matters: the roles seed builds roles for every association that exists and gives them to
# existing users, so the platform association and the super admin must exist before it runs. The default plans point at module rows, so
# plans.seed.ts runs right after platform-modules.seed.ts; it only creates a plan that does not exist, never changes one.
# A failing seed is reported loudly but does not stop the API from starting.
# Set SEED_ON_START=false to skip (saves about 30 seconds per start).
if [ "${SEED_ON_START:-true}" != "false" ]; then
  echo "Seeding reference data..."
  for seed in     prisma/seeds/platform-association.seed.ts     prisma/seeds/super-admin.seed.ts     prisma/seeds/rbac-seed.ts     prisma/seeds/platform-modules.seed.ts     prisma/seeds/plans.seed.ts     prisma/seeds/help-permissions.seed.ts     prisma/seeds/help-content.seed.ts     prisma/seeds/blog-docs.seed.ts
  do
    if node_modules/.bin/tsx "$seed" > /tmp/seed.log 2>&1; then
      echo "  ok     $seed"
    else
      echo "  FAILED $seed"
      tail -n 20 /tmp/seed.log
    fi
  done
else
  echo "SEED_ON_START=false, skipping seeds."
fi

# Brings every association's member ledgers and books into line with their charges and payments (donations used to unbalance both).
# Safe to repeat: it only adds what is missing, never edits a posted entry, and a second run finds nothing to do. Logs one line per
# association it changed. It never stops the API from starting. Set REPAIR_BOOKS_ON_START=false to skip.
if [ "${REPAIR_BOOKS_ON_START:-true}" != "false" ]; then
  echo "Checking member ledgers and books..."
  node_modules/.bin/tsx scripts/repair-ledgers-and-books.ts || echo "  Ledger and books check failed; the API will start anyway (see the lines above)."
fi

echo "Starting API server..."
exec node dist/server.js
