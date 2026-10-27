# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root:
#   docker build -f apps/web/Dockerfile .
# (handled automatically by docker-compose.dokploy.yml)

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- Prune the monorepo down to only what @societyledger/web needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @societyledger/web --docker

# ---- Install deps (cached separately from source for faster rebuilds) ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# apps/web's package.json points its Prisma "schema" config at ../api/prisma/schema.prisma,
# but apps/api isn't a workspace *dependency* of web, so `turbo prune` won't pull it in. It has
# to be in place BEFORE `pnpm install`, because web's own `postinstall` script runs
# `prisma generate` (which reads that path) as part of the install step itself.
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
# `prisma generate` infers a "project root" as the common ancestor of the CWD (apps/web) and the
# schema's directory (apps/api/prisma) — i.e. apps/ — and tries to auto-install its own CLI there
# if that directory has no package.json. Give it a throwaway one so it doesn't; placing it
# directly in apps/ (not apps/<name>/) keeps it from matching the "apps/*" workspace glob, so
# pnpm doesn't treat it as a real workspace member.
RUN echo '{"name":"apps-root-placeholder","private":true}' > apps/package.json
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_BASE_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_BASE_DOMAIN=$NEXT_PUBLIC_BASE_DOMAIN
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# Build shared package first so its dist/index.js exists for webpack resolution
RUN pnpm --filter @societyledger/shared build
RUN pnpm --filter @societyledger/web run build

# ---- Runtime image (Next.js standalone output) ----
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 webuser
WORKDIR /app

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=webuser:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=webuser:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER webuser
ENV NODE_ENV=production
ENV PORT=3000
# Listen on every network address. Without this Next binds only to the container's own hostname address, which is the wrong
# network when the container is attached to more than one, and the proxy then gets "connection refused" (a 502).
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
