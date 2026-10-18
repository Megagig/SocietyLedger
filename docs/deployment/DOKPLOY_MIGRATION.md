# Migrating to Dokploy (API + Web + Database)

Moves the stack off Netlify (web) + Render (api, per [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)) + Neon (database)
onto a single self-hosted [Dokploy](https://dokploy.com) instance, driven by [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml).

Assumes Dokploy is already installed and running on your VPS.

## What's in the stack

| Service    | Image / build                | Replaces              |
|------------|-------------------------------|------------------------|
| `postgres` | `postgres:16-alpine`          | Neon                   |
| `redis`    | `redis:7-alpine`              | (new — was optional)   |
| `api`      | built from `apps/api/Dockerfile` | Render               |
| `web`      | built from `apps/web/Dockerfile` (Next.js standalone) | Netlify |
| `admin`    | built from `apps/admin/Dockerfile` (Next.js standalone) | (new in A1.7) |
| `docs`     | built from `apps/docs/Dockerfile` (Next.js static export) | Netlify |

All services run as one Dokploy "Compose" project on Dokploy's shared `dokploy-network` so Traefik can route to each. `api` and `admin` are additionally on the `internal` bridge network so the admin BFF can reach the API at `http://societyledger-api:4000` without going through the public internet.

## 1. DNS

The app is multi-tenant via subdomain (`<slug>.societyledger.com.ng`), same constraint that drove the earlier Netlify→Vercel discussion in [VERCEL_MIGRATION.md](./VERCEL_MIGRATION.md). At your DNS provider (currently HostAfrica per [CUSTOM_DOMAIN_SETUP.md](./CUSTOM_DOMAIN_SETUP.md)):

| Type | Name | Value                  |
|------|------|-------------------------|
| A    | `@`  | `<dokploy-server-ip>`  |
| A    | `*`  | `<dokploy-server-ip>`  |
| A    | `api`| `<dokploy-server-ip>`  |

**Wildcard TLS**: Let's Encrypt's HTTP-01 challenge (Dokploy/Traefik's default) **cannot** issue a wildcard cert for `*.societyledger.com.ng`. You need the DNS-01 challenge instead, which requires your DNS provider to support an API-driven ACME plugin in Traefik. If HostAfrica doesn't support this, move DNS (just the nameservers/zone, not hosting) to Cloudflare — Dokploy/Traefik has built-in support for the Cloudflare DNS-01 provider. Configure this in Dokploy's Traefik settings before deploying `web`; otherwise every subdomain will show a certificate error.

## 2. Create the Dokploy project

1. In Dokploy: **Create Project** → **Compose**.
2. Point it at this repo, branch `main` (or whichever you deploy from), compose path `docker-compose.dokploy.yml`.
3. Open the project's **Environment** tab and paste in the values from [`.env.dokploy.example`](../../.env.dokploy.example) (with real secrets — generate new `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, don't reuse the Neon/Render ones).
4. Deploy. First build will take longer (installing deps, building both images); subsequent deploys reuse Docker layer cache.

## 3. Migrate data from Neon

Do this once `postgres` is up (step 2) but before cutting over DNS/traffic.

```sh
NEON_DATABASE_URL="postgresql://<user>:<pass>@<ep>.neon.tech/societyledger?sslmode=require" \
TARGET_DATABASE_URL="postgresql://societyledger:<password>@<dokploy-host>:5432/societyledger" \
./scripts/migrate-neon-to-dokploy.sh
```

See the script's header comment for prerequisites (matching `pg_dump`/`pg_restore` version, network reachability to the Dokploy Postgres container).

The `api` container's entrypoint ([`apps/api/docker-entrypoint.sh`](../../apps/api/docker-entrypoint.sh)) runs `prisma migrate deploy` on every start, so once the data is restored, Prisma's own migration history (the `_prisma_migrations` table, included in the dump) keeps the schema in sync going forward — you don't run migrations manually.

## 4. Cut over

1. Verify the app end-to-end against the Dokploy-hosted stack using the `api`/`web` domains directly (before flipping the apex/wildcard DNS), or a `/etc/hosts` override if you need the exact production domain for cookies/subdomain logic to behave.
2. Flip the DNS records from step 1 to the Dokploy server IP.
3. Once propagated and verified, decommission Render, Netlify, and the Neon project — not before, in case of rollback.

## 5. Admin console setup (added A1.7)

### DNS

Add an `A` record for `admin.societyledger.com.ng` pointing to the Dokploy server IP (same target as `api`). The wildcard record `*` already covers subdomains, but an explicit record for `admin` avoids relying on the wildcard:

| Type | Name    | Value                 |
|------|---------|-----------------------|
| A    | `admin` | `<dokploy-server-ip>` |

### Environment variables (new in A1.7)

In the Dokploy project's **Environment** tab add:

```
# API extras
ADMIN_URL=https://admin.societyledger.com.ng
PLATFORM_TOKEN_EXPIRY=8h
TOTP_ENCRYPTION_KEY=<64 hex chars — openssl rand -hex 32>

# Admin console
ADMIN_DOMAIN=admin.societyledger.com.ng
NEXT_PUBLIC_ADMIN_HOST=https://admin.societyledger.com.ng
NEXT_PUBLIC_ENV=production
ADMIN_IP_ALLOWLIST=
```

The `TOTP_ENCRYPTION_KEY` is the AES-256-GCM key used to encrypt TOTP secrets at rest in Postgres. Generate once; rotation requires re-encryption of all stored secrets (script to be added in A2+).

### First-time admin user

After deploying, promote an existing user to platform admin via `psql` (or the Prisma Studio Dokploy extension):

```sql
UPDATE "User"
SET platform_role = 'SUPER_ADMIN'
WHERE email = 'your@email.com';
```

Then log in at `https://admin.societyledger.com.ng`. On first login, if 2FA is not yet set up, you will be prompted to enrol. Save the recovery codes in your password manager.

### Emergency TOTP reset

If locked out of 2FA, SSH to the server and run:

```sh
docker exec societyledger-api npx tsx scripts/reset-totp.ts your@email.com
```

This nulls the TOTP secret and all recovery codes for that user, allowing plain password login on the next attempt.

### Staging deployment

To deploy a staging instance pointing at the `develop` branch, create a second Dokploy "Compose" project with these overrides in its environment:

```
ADMIN_DOMAIN=admin-staging.societyledger.com.ng
NEXT_PUBLIC_ADMIN_HOST=https://admin-staging.societyledger.com.ng
NEXT_PUBLIC_ENV=staging
ADMIN_IP_ALLOWLIST=<your-office-IP>   # restrict staging to known IPs
PLATFORM_TOKEN_EXPIRY=2h              # shorter for staging
```

The `EnvBadge` in the top-bar chrome will show **STAGING** (blue) in the staging instance and **PROD** (red) in production — a quick visual signal that prevents accidental destructive actions on production when a staging tab is open nearby.

## 7. Known limitations to revisit later

- **Uploads**: `apps/api` writes payment-proof/logo uploads to a local `uploads/` directory, mounted here as the `api_uploads` named volume. This works for a single `api` replica (Dokploy's default) but won't survive scaling to multiple replicas or a host migration without the volume moving too. Fine for now; move to S3/Cloudinary-style object storage before scaling `api` horizontally.
- **Backups**: `pgdata` and `redisdata` are plain Docker named volumes. Set up Dokploy's scheduled backups (or your own `pg_dump` cron) for `pgdata` — Neon's automatic point-in-time backups no longer apply once you're off it.
