# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root:
#   docker build -f apps/docs/Dockerfile .
# (handled automatically by docker-compose.dokploy.yml)

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ---- Prune the monorepo down to only what @societyledger/docs needs ----
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune @societyledger/docs --docker

# ---- Install deps (cached separately from source for faster rebuilds) ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ---- Build (static export) ----
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_SHOW_DRAFTS
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SHOW_DRAFTS=$NEXT_PUBLIC_SHOW_DRAFTS
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# `turbo prune`'s output only includes files it can trace through the workspace
# dependency graph — a plain relative-path `extends` in tsconfig.json isn't one,
# so apps/docs/tsconfig.json's `"extends": "../../tsconfig.base.json"` fails to
# resolve without this (found by actually running `docker build`, not assumed).
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @societyledger/docs run build

# ---- Runtime image (static export served by nginx) ----
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/docs/out /usr/share/nginx/html
COPY apps/docs/nginx/default.conf.template /etc/nginx/templates/default.conf.template

# nginx's own envsubst-on-templates entrypoint step only replaces a `${VAR}`
# token if VAR is actually set in the container's environment — if it's
# merely absent (not even empty), the token survives into the generated
# config verbatim, and nginx then fails to start trying to parse it as its
# own `$robots_tag` variable syntax. Found by actually running the
# container without ROBOTS_TAG set. This default makes the image safe to
# run standalone (e.g. `docker run` with no `-e`), not just via compose.
ENV ROBOTS_TAG=""

EXPOSE 80
