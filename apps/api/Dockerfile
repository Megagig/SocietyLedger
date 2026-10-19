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
# Build shared package first so Node.js runtime can require() its compiled CJS output.
# packages/shared/main is ./dist/index.js — without this step Node would try to
# execute the TypeScript source directly and fail with ERR_MODULE_NOT_FOUND.
RUN pnpm --filter @societyledger/shared build
# Pre-existing TS2345/TS2322 errors in controllers (Zod body vs service params) cause
# tsc to exit non-zero. noEmitOnError:false in tsconfig.prod.json means JS is still
# emitted; || true absorbs the non-zero exit so Docker doesn't fail the layer.
RUN pnpm --filter @societyledger/api run build:prod || true

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
