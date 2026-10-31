# Responsive audit harness

Tooling for the responsive audit (branch `responsive-pwa`). It changes no app code. Screenshots and metrics go to `artifacts/` (gitignored).

## The scratch stack (never your dev database)
1. Create a scratch database (`sl_responsive`) and apply migrations: `prisma migrate deploy` with `DATABASE_URL` pointing at it.
2. Seed it, in this order, from `apps/api`: `prisma db seed`, `tsx prisma/seeds/demo-association.seed.ts`, `tsx prisma/seeds/responsive-hardcases.seed.ts`, `tsx prisma/seeds/rbac-seed.ts`, `tsx prisma/seeds/demo-ajo.seed.ts`.
3. Run the API on port 4101 with `RESEND_API_KEY`, `TERMII_API_KEY` and the Paystack keys blanked (the demo addresses are fictional and cron jobs would otherwise try to message them).
4. Build the web app into its own folder and serve it on 3100:
   `NEXT_DIST_DIR=.next-resp NEXT_PUBLIC_API_URL=http://localhost:4101 NEXT_PUBLIC_BASE_DOMAIN=localhost:3100 next build`, then the same variables with `next start -p 3100`.
5. The tenant is `demo`, reached at `http://demo.localhost:3100`.

## Running
```
node responsive/routes.mjs                       # route list from src/app/**/page.tsx
node responsive/params.mjs                       # (scratch DB env) one real record per dynamic route
node responsive/capture.mjs --run baseline --pass admin      # also: public, roles, standalone
node responsive/interactions.mjs --run baseline              # opened menus, modals, error states
LH_DIR=<folder with lighthouse installed> node responsive/lighthouse.mjs --run baseline
node responsive/analyze.mjs baseline             # artifacts/baseline/summary.md
```
Options for `capture.mjs`: `--viewports 320x568,1440x900`, `--filter dashboard/members` (no leading slash: Git Bash rewrites it), `--limit`, `--concurrency`. Runs resume where they stopped.

Playwright is loaded from the copy in the pnpm store (via `apps/docs`) because `apps/web` does not declare it yet.
