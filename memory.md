# Memory — SocietyLedger Docs Site (D1.2 + dev-environment fixes)

Last updated: 2026-10-12

## What was built

- **D1.2 Docs theme, tokens & layout** (`apps/docs`), now ticked in `progress-tracker.md`:
  - `apps/docs/app/theme.css` (new) — overrides every Fumadocs `--color-fd-*` CSS variable per `ui-tokens.md §14.1` (confirmed the names match the installed `@fumadocs/base-ui@16.17.1` exactly, by reading the package source directly — no drift to reconcile), plus a `.dark #nd-sidebar` override (see Problems solved) and a `@theme { --radius-sm/-md/-lg }` block that retunes every `rounded-*` utility sitewide, including Fumadocs' own component markup.
  - `apps/docs/app/global.css` — now `@import`s `theme.css` last, after the Fumadocs imports, so the overrides win on cascade order.
  - `apps/docs/app/layout.tsx` — font swapped `Inter` → `Manrope`; added `metadata.icons` pointing at `/favicon.png`; renders `<Footer />` after `{children}`.
  - `apps/docs/components/layout/logo.tsx` (new) and `apps/docs/components/layout/footer.tsx` (new).
  - `apps/docs/app/not-found.tsx` (new) — client component; reuses the existing Fumadocs search dialog via `useSearchContext().setOpenSearch(true)` rather than rebuilding search; confirmed it still prerenders correctly to static `out/404.html` under `output: 'export'`.
  - `apps/docs/lib/layout.shared.tsx` — `nav.title` is now `<Logo />`; added `links: [{ text: 'Open SocietyLedger', url: appUrl, external: true }]`. "Get the app" link deliberately **not** added (see Decisions).
  - `apps/docs/lib/shared.ts` — added `appUrl` constant, reads `NEXT_PUBLIC_APP_URL`.
  - `apps/docs/.env.example` (new) — just `NEXT_PUBLIC_APP_URL` for now; a comment notes which later features add the rest of `architecture.md §14.10`'s vars.
  - `apps/docs/public/favicon.png` (new) — copied byte-for-byte from `apps/web/public/favicon.png`.
  - Context docs updated: `ui-tokens.md §14.2` (new `--color-docs-logo-from/-to` token row + exception note), `ui-registry.md` (Logo/Footer/NotFound registered), `library-docs.md` (Fumadocs sidebar-specificity gotcha recorded), `progress-tracker.md` (D1.2 ticked, 3 new decisions logged, current status → next = D1.3).
- **Architecture.md Dokploy corrections** (housekeeping requested by owner, done before D1.2): `architecture.md §1`, `§6.1`, `§17.1`–`§17.4` rewritten to reflect reality — **one Dokploy Compose application** (`docker-compose.dokploy.yml`, already live for `api`/`web`), not one Dokploy Application per app; `API_DOMAIN` confirmed as `https://api.societyledger.com.ng`. `progress-tracker.md`'s G12 gap marked resolved. `library-docs.md`'s "each app = one Dokploy Application" wording **deliberately left uncorrected** — owner explicitly deferred that to D1.7.
- **Windows dev-environment fix** (`apps/api/package.json`): `dev`, `start`, `test:email` scripts rewritten to use `cross-env` (added as a devDependency) instead of POSIX-only inline `NODE_OPTIONS='...' cmd` syntax, which breaks under `cmd.exe` (pnpm on Windows always runs scripts through `cmd.exe`, even when invoked from Git Bash).

## Decisions made

- **Docs logo/favicon deliberately reuse `apps/web`'s existing teal→green gradient brand as-is**, not the ledger+brass system the rest of `ui-tokens.md §14` assumes for docs — owner's explicit call at D1.2 (no real logo asset existed anywhere in the repo; match the live product now). Implemented as **named CSS tokens + `@utility` classes** (`--color-docs-logo-from/-to`, `docs-logo-icon-bg`, `docs-logo-text`), not raw Tailwind palette classes like web's own `from-teal-500 to-green-500` — required to stay inside AGENTS.md's absolute "no raw Tailwind color classes" rule while still matching web's exact visual.
- **"Get the app" header link omitted until D7** (when mobile ships) — mobile doesn't exist yet; avoids a dead link; matches `ui-rules.md §11.3`'s own deferral of the equivalent homepage strip, even though `build-plan.md`'s D1.2 bullet literally names it.
- **Dokploy deployment model corrected project-wide**: one Compose stack, not one app = one Dokploy Application. `library-docs.md`'s wording is the one remaining place that still says the old thing — intentionally, until D1.7.
- Footer content kept intentionally minimal (copyright · Documentation link · Open SocietyLedger link) since `ui-rules.md` doesn't fully specify a docs footer composition yet.

## Problems solved

- Confirmed Fumadocs' dark-mode mechanism by reading the installed package source (`node_modules/@fumadocs/base-ui/dist/provider/base.js`): `next-themes` with `attribute: "class"` — a `.dark` class on `<html>`, **not** a `prefers-color-scheme` media query. Don't re-derive this from docs guesswork next time.
- `@fumadocs/base-ui`'s `neutral.css` ships `.dark #nd-sidebar { --color-fd-muted: …; … }` with an ID selector, which out-specificities a plain `.dark { … }` override for those 3 properties on the sidebar specifically. Fixed by repeating the same `#nd-sidebar` selector in `theme.css`. Recorded in `library-docs.md` so it isn't re-discovered the hard way.
- `apps/api`'s `dev`/`start`/`test:email` scripts silently failed on Windows (`'NODE_OPTIONS' is not recognized...`) even when run from Git Bash, because pnpm's Windows script runner always uses `cmd.exe` regardless of the calling shell. Fixed with `cross-env`.
- Rapid consecutive `pnpm add`/`pnpm run dev`/kill cycles broke `next`'s CLI entry point (`Cannot find module '.../next/dist/bin/next'`) in both `apps/web` and `apps/docs` node_modules — same class of bug as the one already recorded from the D1.1 session. Fixed again with `pnpm install --force`. **Pattern now confirmed twice: avoid interleaving `pnpm add`/`pnpm install` with starting/stopping dev servers in quick succession on this machine.**

## Current state

- `apps/docs`: `dev`/`type-check`/`lint`/`build` all verified clean. Compiled CSS checked directly (not just assumed) to confirm the override cascade order actually wins. Owner visually confirmed `/docs` renders correctly in Chrome (dark theme, ledger-green logo, correct placeholder copy) via a screenshot.
- `pnpm run dev` from the repo root now brings up `api` (:4000), `web` (:3000), `docs` (:3001) together cleanly — verified end-to-end after the `cross-env` fix and a `pnpm install --force`.
- All background dev servers were stopped at the owner's request (ports 3000/3001/4000 confirmed clear) so they can run it themselves.
- **Nothing is committed yet.** Working tree has: D1.2 docs changes, the architecture.md/progress-tracker.md/library-docs.md/ui-tokens.md/ui-registry.md context edits, and the unrelated `apps/api/package.json` cross-env fix — all uncommitted, all verified working.
- Owner was given the exact commands to run things themselves: `pnpm run dev` (root, all three) or `pnpm -F @societyledger/docs dev` (docs only, no need to `cd` into the app folder).

## Next session starts with

Confirm with the owner whether to commit now (suggested split: `feat(docs): D1.2 theme, tokens & layout`, `fix(api): use cross-env for Windows-compatible dev scripts`, `docs(context): correct Dokploy deployment model, confirm API_DOMAIN`) or proceed straight to **D1.3 — Information architecture skeleton** (all 197 pages as drafts, per `project-overview.md §9.6` — needs a `scripts/sitemap-data.ts` generator, not hand-authored files, per the earlier D1.1-session decision log).

## Open questions

- `library-docs.md`'s "each app = one Dokploy Application" wording is still uncorrected (intentionally, deferred to D1.7).
- Footer and 404 page were verified structurally (compiled HTML/CSS) and the `/docs` home page was visually confirmed by the owner, but footer/404/light-mode/dark-toggle interaction haven't been explicitly eyeballed by the owner yet — worth a quick look before calling D1.2 fully demo-ready.
