# Memory — Mobile Phase 9: hardening, brand rollout, deployment and EAS builds

Last updated: 2026-10-26

## What was built

Per-feature detail is in `context/progress-tracker.md` (Phase 9), `context/ui-registry.md` (brand section) and `docs/mobile/`. Start with `docs/mobile/PHASE9_REVIEW_FINDINGS.md`, `STORE_READINESS.md` and `RELEASE_CHECKLIST.md`.

- **Brand rollout:** `SocietyLedger-brand/` kit applied to mobile (icon, adaptive icons, light and dark splash, notification icon, in-app mark), web (favicons, PWA icons, manifest, service worker v2, OG image, `components/brand/BrandLogo.tsx`), admin and docs.
- **Seed for demo/E2E:** `apps/api/prisma/seeds/oko-youth-forum.seed.ts` (`pnpm --filter api seed:oko`, password from env `OKO_DEMO_PASSWORD`). **Not yet run on the deployed API.**
- **E2E:** 7 Maestro flows in `apps/mobile/e2e/` (written from the code, never run on a device).
- **Deployment (Dokploy):**
  - `docker-compose.dokploy.yml` and `.env.dokploy.example` now list every variable the API reads.
  - Migration `20261019_a0_create_notification_preferences` fixes a gap: a fresh database could not be built from the migrations.
  - `docker-entrypoint.sh` runs migrations, then 8 idempotent seeds in a fixed order (plans, platform association, super admin, roles, modules, help permissions, help content, blog), then the server. `SEED_ON_START=false` skips them.
  - New `prisma/seeds/super-admin.seed.ts` (env `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, 12+ chars; creates one only if none exists). `seed-all.ts` must never run in production (hard-coded credentials).
  - MinIO is a **separate shared stack** (`docker-compose.minio.yml`, container `shared-minio`, domain `files.societyledger.com.ng` on port 9000, console 9001 not public). Per-app bucket and scoped key. Steps in `docs/deployment/MINIO_SETUP.md`.
- **Fixes after the first deploy:**
  - Docs page `getting-started/create-your-association.mdx` used `<Callout type="info">`; the docs Callout only accepts note, tip, warning, danger. This broke the whole compose build.
  - Web: new `apps/web/src/utils/subdomain.ts` stops `societyledger.com.ng` being treated as an association (it caused 404s on `check-subdomain` and a wrong tenant header). Used by middleware, `lib/tenant.ts`, `utils/tenant.ts` and `TenantContext`.
- **EAS / Expo build fixes:**
  - `apps/mobile/package.json`: script `eas-build-post-install` builds `@societyledger/shared` (its `dist/` is gitignored); `babel-preset-expo` added as a dependency; `expo-build-properties` added.
  - Root `.npmrc` (new file): `public-hoist-pattern[]=*babel*`. Gradle runs Metro with plain node, so Babel plugin names must resolve from the repo root.
  - Two stale `tsconfig.tsbuildinfo` files untracked (they stopped `tsc` from emitting `dist`).
  - `app.config.ts`: fails a production build when `EXPO_PUBLIC_API_URL` is missing or not https (warns for preview); default EAS project id; arm64-only preview build with compressed native libs, arm64+armv7 for production, via `expo-build-properties`; blocks the default `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` permissions.
  - `eas.json`: `preview` and `production` env hold the four public `EXPO_PUBLIC_*` addresses (all on societyledger.com.ng); new profile **`website-apk`** (production identity as an APK, for hosting on the website).

## Decisions made

- No CI/CD; the owner deploys with Dokploy and runs builds by hand (`eas build`). Android first; iOS prepared but not device-verified and not submitted.
- MinIO is shared across apps: one bucket and one key limited to that bucket per app. The API uses an internal endpoint plus a separate public endpoint for signed links.
- Seeds run on every API start on purpose, so new permissions and modules ship with the code.
- Working rule from the owner still applies: list review fixes and get approval before changing code. The security and accessibility fixes below are **not yet approved or applied**.
- `preview` builds point at the deployed (production) API because no staging API exists. Clients get the `website-apk` profile, never `preview`.

## Problems solved

- Gradle bundling failed with `Cannot find module 'babel-preset-expo'` and then `@babel/plugin-transform-react-jsx`: fixed by the dependency plus `.npmrc` above. Tested by simulating EAS from a clean copy with a fresh install and a plain-node bundle command.
- `eas env:create` could not link the project locally (project id only existed in the build profile): fixed with a default id; values now live in `eas.json`.
- The 283 MB preview APK was a universal APK with four chip types: restricted as above (new size not yet measured).
- Local `node_modules` had ~27 emptied package folders (cause unknown); repaired by deleting the empty `.pnpm` folders and reinstalling. Tools used: a scan for empty package folders, then `CI=true pnpm install --frozen-lockfile`.
- In a shell, the MinIO app secret must be 8 to 40 characters (use `head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'`, 32 chars) and `$( )` is for a command, never for a pasted value.

## Current state

- Deployed on Dokploy; API log shows migrations applied and all 8 seeds `ok`. Docs, web and admin build. API Docker image builds and starts from an empty database.
- The last edits (`app.config.ts`, `eas.json`, `docs/mobile/RELEASE_CHECKLIST.md`) were uncommitted at the last check; the owner commits and pushes. Before any build make sure `.npmrc`, `pnpm-lock.yaml` and `apps/mobile/package.json` are committed.
- A preview APK built successfully (283 MB) before the size fix. The `website-apk` profile has not been built.
- Typechecks: mobile shows 6 type errors after a clean install (`ImageViewerModal`, `Passbook`, `Skeleton`, `PagedList`; className typing and FlashList), which do not affect bundling. Admin has 2 old errors. The API prod `tsc` reports ~100 errors that the Dockerfile hides with `|| true` (types looser than the functions they call).
- Nothing measured or run on a device yet: cold start, memory, TalkBack, 1.3x text, Maestro flows, payment proof upload against MinIO.
- Expo checker shows version drift (expo 58.0.16 vs 58.0.19, TypeScript 5.9 vs 6.0, etc.); left alone on purpose.

## Next session starts with

1. Ask the owner which fixes from `docs/mobile/PHASE9_REVIEW_FINDINGS.md` to apply. Recommended first: A1 (set `trust proxy`, otherwise all users share one rate-limit counter behind Traefik), A2 (Paystack webhook secret fallback and reject when empty), A3 (no fallback JWT secret in production, API and web), A5 (calendar permission text), A6 (About screen privacy and terms links point at the wrong domain). Then A4 (start Sentry with data scrubbing), B5 (tertiary text contrast: light `84 114 90`, dark `121 152 128`), B3, B4, B1. A7 (dependency upgrades: jsPDF, Next in web and admin) as separate passes.
2. Confirm the deployed server has: `API_PUBLIC_URL` = the API address (it was set to the website address by mistake), `APP_URL`, the MinIO scoped key, and the demo association seeded if the owner wants `oko-youth-forum` to exist there.
3. Build `website-apk` and the preview APK on the Redmi; record cold start, memory, TalkBack and Maestro results in the table at the end of `docs/mobile/RELEASE_CHECKLIST.md`; confirm the APK size.
4. Then `/review` on Phase 9 and update `context/progress-tracker.md` (F9.x are still unchecked).

## Open questions

- Phase 8 carry-over: show a "waiting for approval" message when someone signs in on the bare domain with no association (needs the owner's yes).
- Associations that already had an Expired or Cancelled subscription are blocked at once when Phase 8 ships; bypass or not?
- Play feature graphic (1024x500) and a data-deletion URL are still needed for the store listing; iOS needs a real iPhone or TestFlight tester.
- Brand colours are not applied to the app theme (still teal tokens); only logos and icons moved.
- R8 code shrinking not tried (could save 10 to 20 MB, risk of launch crashes).
- `ai-help.service.ts` and `ai-support.service.ts` are still not on credits; `GET /ai/reminders/suggestions` still spends a credit.
- The shared MinIO user creation was in progress; confirm `societyledger-app` exists and the API logs no storage error.
