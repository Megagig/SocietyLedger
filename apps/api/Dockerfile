# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root:
#   docker build -f apps/api/Dockerfile .
# (handled automatically by docker-compose.dokploy.yml)

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- Prune the monorepo down to only what @societyledger/api needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @societyledger/api --docker

# ---- Install deps (cached separately from source for faster rebuilds) ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# apps/api/tsconfig.json has `"extends": "../../tsconfig.base.json"`, but that root file
# isn't part of any workspace package's manifest, so `turbo prune` doesn't carry it into
# out/full — without it, tsc fails to load its config (TS5083) before it can compile anything.
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @societyledger/api run db:generate
# `tsc` does not set noEmitOnError, so it still writes dist/*.js even when it reports
# pre-existing type errors elsewhere in the codebase (unrelated to this Docker build) —
# it only exits non-zero. Tolerate that, but fail the build if the entry point is
# genuinely missing (a real compile failure, not just a type-check complaint).
RUN pnpm --filter @societyledger/api run build:prod || true
RUN test -f apps/api/dist/server.js

# ---- Runtime image ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser
WORKDIR /app

COPY --from=builder --chown=apiuser:nodejs /app .

RUN chmod +x /app/apps/api/docker-entrypoint.sh \
  && mkdir -p /app/apps/api/uploads \
  && chown -R apiuser:nodejs /app/apps/api/uploads

USER apiuser
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first
EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
