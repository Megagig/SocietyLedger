FROM node:20-alpine AS base

# turbo prune step — creates a minimal monorepo subtree for this app only
FROM base AS pruner
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @societyledger/admin --docker

# Install dependencies
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
# Copy the full installer output (root + workspace node_modules) then overlay
# the full source. pnpm puts Next.js in apps/admin/node_modules, not the root.
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars must be baked in at build time
ARG NEXT_PUBLIC_ADMIN_HOST
ARG NEXT_PUBLIC_ENV
ENV NEXT_PUBLIC_ADMIN_HOST=$NEXT_PUBLIC_ADMIN_HOST
ENV NEXT_PUBLIC_ENV=$NEXT_PUBLIC_ENV
RUN npm install -g pnpm && pnpm --filter @societyledger/admin build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public 2>/dev/null || true

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/admin/server.js"]
