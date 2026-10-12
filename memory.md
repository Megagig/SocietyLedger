# Memory — SocietyLedger Docs Site (D1 Foundation)

Last updated: 2026-10-12

## What was built

- **`apps/docs`** scaffolded from scratch using the current `create-fumadocs-app` static-export template (`--template "+next+fuma-docs-mdx+static"`), adapted into the monorepo as workspace `@societyledger/docs`:
  - Dependencies pinned: `fumadocs-core`/`fumadocs-mdx` 16.17.1/15.4.7, `fumadocs-ui` aliased to `npm:@fumadocs/base-ui@16.17.1`, `next` 16.3.8, `react`/`react-dom` 19.3.0, `tailwindcss` 4.3.3, `typescript` **5.9.3** (not the scaffold's default 7.x), `zod` **^4.6.6** (explicit — see Problems solved).
  - `app/page.tsx` replaced the scaffold's marketing `(home)` route group with a client-side `useRouter().replace('/docs')` redirect (static export has no server to do a real redirect).
  - Removed the scaffold's public GitHub links (`gitConfig`, `ViewOptionsPopover`) from `lib/shared.ts`, `lib/layout.shared.tsx`, `app/docs/[[...slug]]/page.tsx` — repo is private.
  - `next.config.mjs` got `images.unoptimized: true` and `trailingSlash: false` added for static-export correctness.
  - `content/docs/index.mdx` simplified to a one-line placeholder (real IA is D1.3).
  - Root `turbo.json`'s `build.outputs` extended with `out/**` and `.source/**`; root `.gitignore` got a `.source/` entry.
  - `tsconfig.json` extends `../../tsconfig.base.json` to match the other apps' convention.
- **Fixed a pre-existing, unrelated `apps/web` build break** (found while verifying D1.1's "web still builds" DoD line):
  - `apps/web/src/app/dashboard/member/settings/page.tsx` changed `import React, { useState } from 'react'` → `import { useEffect, useState } from 'react'` (it was the *only* file in the app using a default+named React import; that's what caused every Mantine component in its JSX tree to fail `TS2786`/`ReactNode`/`bigint` type errors).
  - `apps/web/tsconfig.json`: removed `"ignoreDeprecations": "6.0"` (current TypeScript rejects that value — a second, independent bug masked behind the first).
- **Context docs updated**: `context/progress-tracker.md` (D1.1 ticked with full notes, decisions log entry for the web fix, resolved a stale G12 gap about Dockerfiles), `context/library-docs.md` (real pinned docs-site versions + the typescript/zod gotchas recorded so nobody re-tries them).
- `AGENTS.md` restored to the user's custom reading-order content after a `develop`→`main` fast-forward merge overwrote it with Turborepo's auto-generated block (that auto-block is gone now; only the user's content remains, untracked by git before this — now tracked, modified).

## Decisions made

- **Branch state**: `develop` was 5 commits behind `main` (Dokploy migration, an "Admin Console" scope addition, typescript fixes) with zero unique commits of its own — fast-forward-merged `develop` to `main`. This brought in `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.dokploy.yml`, `docs/deployment/DOKPLOY_MIGRATION.md`, and substantially expanded context files (admin console track, pnpm migration, Dokploy hosting throughout). **Any future session must read the context files fresh — do not trust summaries of their pre-merge content from earlier in a transcript.**
- **Hosting for `apps/docs` (D1.7, not yet built)**: owner explicitly said "I migrated Netlify and Vercel to Dokploy on my own VPS... I deployed web and api in a docker compose... I want everything to match that pattern for consistency." Resolved interpretation: extend the existing `docker-compose.dokploy.yml` with a new `docs` service (Dockerfile: pnpm/turbo-prune multi-stage → `nginx:alpine` serving `apps/docs/out`), rather than treating docs as a separate standalone Dokploy "Application" (which is what `library-docs.md`'s prose literally says — "each app = one Dokploy Application" — a wording inconsistency with the owner's direct instruction that hasn't been reconciled in the docs yet). When D1.7 is built: add `docs` service + explicit Traefik `priority=100` label (and fix the *existing* `web` service to have explicit `priority=1` — currently missing, a latent routing bug per `architecture.md §17.3`'s wildcard-vs-specific-host warning).
- **D1.3's 197 page stubs**: plan is to generate them from one data file (`apps/docs/scripts/sitemap-data.ts`, transcribed once from `project-overview.md §9.6`) via a generator script, not hand-author 197 files. Not yet built.
- **D1.5/D1.6 (GA4, screenshot pipeline)**: owner confirmed building the *code* now with real credentials (GA4 measurement ID, staging demo association) left as placeholders/TODO for later — not blocking.
- Version-pin reasoning worth not re-deriving: `typescript` must stay ≤5.x line (`typescript-eslint` caps at `<6.1.0`, breaks `pnpm lint` otherwise); `zod` must be explicitly `^4.x` in `apps/docs/package.json` (fumadocs-core peers on zod 4, repo's zod 3.x from the API would silently get hoisted in if left undeclared).

## Problems solved

- `create-fumadocs-app`'s scaffold defaults to `typescript@^7` and lets `zod` go undeclared — both break things (TS7 breaks ESLint's typescript-eslint peer range; undeclared zod lets pnpm hoist the wrong major version). Fixed by pinning both explicitly in `apps/docs/package.json`.
- The `apps/web` Mantine/`ReactNode`/`bigint` build failure (see above) — root cause took significant investigation (ruled out `typescript` version, `@types/react` version, and Mantine patch version before finding the actual single-file stray import). **Do not re-attempt those three dead ends if this resurfaces elsewhere.**
- A `pnpm install` mid-session left `next@14.0.0`'s package partially extracted (`Cannot find module './impl'`) from rapid consecutive installs — fixed with `pnpm install --force`.

## Current state

- `apps/docs`: `dev` (port 3001), `build`, `type-check`, `lint` all verified clean. `pnpm --filter @societyledger/docs dev` serves `/` (redirects) and `/docs` (200) correctly.
- `apps/web`: full production build passes (`pnpm --filter @societyledger/web build`), all 198 routes generated. (Benign `ECONNREFUSED` sitemap/RSS fetch warnings during build are expected — they're trying to hit a live API that isn't running locally, not a real failure.)
- **Nothing has been committed.** The owner explicitly chose "stop here, I'll review first" over committing. Working tree has: new `apps/docs/`, and modified `.gitignore`, `turbo.json`, `AGENTS.md`, `pnpm-lock.yaml`, `context/library-docs.md`, `context/progress-tracker.md`, `apps/web/src/app/dashboard/member/settings/page.tsx`, `apps/web/tsconfig.json` (+ `apps/web/tsconfig.tsbuildinfo`, a harmless generated artifact). Untracked `CLAUDE.md` is the owner's own, unrelated.
- `progress-tracker.md` "Current status" already says: track D1 in progress, next feature **D1.2**, no blockers.

## Next session starts with

Wait for the owner to finish reviewing the diff. Once they give the go-ahead: either commit (conventional messages — `feat(docs): D1.1 scaffold Fumadocs site`, `fix(web): resolve ReactNode/bigint type error in member settings`, `docs(context): progress D1.1`) or proceed straight to **D1.2 — Docs theme, tokens & layout** (apply `ui-tokens.md §14`: Fumadocs CSS-variable overrides, Manrope font swap from the scaffold's default Inter, logo, favicon, header links, footer, light/dark, 404 page). Re-read `ui-tokens.md §14` fresh before starting D1.2 — note Tailwind v4 is CSS-first (`@theme`, no `tailwind.config.js`), so the token mapping approach differs from what `ui-tokens.md` was likely written assuming (v3-style `theme.extend`).

## Open questions

- Should the `library-docs.md` wording "each app = one Dokploy Application" be corrected to match the docker-compose-service approach, or left as-is with a note? (Deferred to whenever D1.7 is actually built.)
- `architecture.md §17.1`'s "the repo currently has no Dockerfiles" line is stale (Dockerfiles exist since the Dokploy migration commit) — flagged in `progress-tracker.md`'s G12 gap entry as "partially resolved," not yet corrected in the architecture doc itself.
- Exact production `API_DOMAIN` value for Dokploy is still unconfirmed with the owner (also part of G12).
