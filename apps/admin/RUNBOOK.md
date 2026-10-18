# Admin Console — Operations Runbook

> **Audience:** on-call engineers responsible for the SocietyLedger admin console (`apps/admin`).

---

## 1. Deploy Procedure

### Prerequisites
- Dokploy access with deploy permission for the `admin` service
- Environment variables configured (see §5)
- Database backup completed and verified before any migration deploy

### Steps

1. **Merge** the PR to `main` (after all CI checks green, smoke tests green).
2. **Dokploy** — navigate to the `societyledger-admin` service → **Deploy** → confirm.
3. Dokploy runs: `pnpm turbo build --filter=@societyledger/admin` then starts the Next.js standalone server on port 3002.
4. **Health check** — visit `https://admin.societyledger.com.ng/login`; expect 200 with `X-Robots-Tag: noindex` in response headers.
5. **Smoke** — run the Playwright suite against production:
   ```sh
   cd apps/admin
   PLAYWRIGHT_BASE_URL=https://admin.societyledger.com.ng \
   E2E_ADMIN_EMAIL=<admin-email> \
   E2E_ADMIN_PASSWORD=<admin-password> \
   pnpm test:e2e
   ```
6. **Security header check** — confirm:
   - `Content-Security-Policy` does **not** contain `unsafe-eval`
   - `X-Frame-Options: DENY`
   - `X-Robots-Tag` contains `noindex`

---

## 2. Rollback Procedure

1. **Dokploy** → `societyledger-admin` → **Deployments** → select the last known-good deployment → **Rollback**.
2. Verify health check (§1 step 4) on the rolled-back version.
3. If rollback involves a database migration regression, follow §3.

---

## 3. Restore-from-Backup Drill

Run this drill **before every release that includes a database migration**. Document the result in the PR description.

### Step-by-step

1. **Stop** the admin service in Dokploy (to prevent writes during restore).
2. **Identify backup** — in Dokploy → Databases → `societyledger-db` → Backups, note the most recent successful backup timestamp and filename.
3. **Download** the backup to a secure local path:
   ```sh
   # Example using pg_dump-style dump stored in S3/Dokploy storage
   dokploy db download --service societyledger-db --backup <backup-id> -o /tmp/sl-backup.sql
   ```
4. **Restore** to a staging database (never restore directly to production without a dry run):
   ```sh
   psql $STAGING_DATABASE_URL < /tmp/sl-backup.sql
   ```
5. **Verify** the staging restore — run the API health check and confirm critical tables exist:
   ```sh
   psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM platform_admins;"
   psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM associations;"
   ```
6. **Production restore** (only if staging drill passed):
   - In Dokploy → Databases → `societyledger-db` → **Restore** → select the backup → confirm.
   - Dokploy restores in-place; the service stays stopped.
7. **Restart** the admin service; confirm health check passes.
8. **Run smoke tests** against production (§1 step 5).
9. **Document** the drill in the release notes: timestamp, backup age at time of restore, any anomalies.

### Acceptable RPO
Maximum 24 hours — daily automated backups are configured in Dokploy.

---

## 4. Incident Response

| Symptom | First action |
|---|---|
| Admin console returns 500 | Check Dokploy runtime logs → `societyledger-admin` → Logs |
| Login returns 401 `PLATFORM_LOGIN_REQUIRED` | Expected — admin must log in via this console, not the tenant portal |
| Session cookie not set after login | Verify `NODE_ENV=production` and `ADMIN_HOST` env vars; check `sameSite=strict` cookie in DevTools |
| BFF returns 404 for a valid admin path | Path not in ALLOW_LIST — add to `apps/admin/src/app/bff/[...path]/route.ts` under the `admin/` prefix |
| CSP violation reports | Check browser console; `unsafe-eval` removed in A3.2 — if a Mantine/Next.js update re-introduces it, pin the version |
| IP allowlist blocking legitimate admin | Check `ADMIN_IP_ALLOWLIST` env var in Dokploy; add the CIDR block or clear to disable |

---

## 5. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | API base URL e.g. `https://api.societyledger.com.ng` |
| `NEXT_PUBLIC_ADMIN_HOST` | Yes | Admin console origin e.g. `https://admin.societyledger.com.ng` (used for CSRF check) |
| `SESSION_SECRET` | Yes | 32-byte hex secret for cookie signing |
| `ADMIN_IP_ALLOWLIST` | No | Comma-separated CIDR blocks; leave blank to allow all |
| `NODE_ENV` | Yes | `production` in prod; controls cookie `Secure` flag |

---

## 6. Security Checklist (pre-launch, per §16.10)

- [ ] Cookie: `httpOnly`, `Secure` (prod), `SameSite=Strict`, no `Domain` attribute (host-only)
- [ ] CSP: no `unsafe-eval`; `frame-ancestors 'none'`
- [ ] `X-Robots-Tag: noindex, nofollow, noarchive` on all responses
- [ ] `robots.ts` disallows all crawlers
- [ ] BFF allow-list contains only `admin/` and `subscriptions/plans`
- [ ] Rate limit on `/api/admin/auth/login` — 10 req/min per IP
- [ ] 2FA enforced for all platform admins
- [ ] Impersonation requires reason + expiry ≤ 4h; no JWT in URL
- [ ] Every destructive action requires confirmation modal + reason field
- [ ] Permanent delete requires typing the subdomain
- [ ] No links to admin console from `apps/web`, `apps/mobile`, or `apps/docs`
- [ ] Restore-from-backup drill completed and documented
