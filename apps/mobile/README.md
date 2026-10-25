# @societyledger/mobile

The SocietyLedger Expo app. See the repo root `context/` docs before changing anything here:

- `context/architecture.md` — folder structure, layer boundaries, API contract.
- `context/ui-tokens.md` / `context/ui-rules.md` — design system (colors, type, spacing, components).
- `context/code-standards.md` — code conventions.
- `context/library-docs.md` — pinned library versions and our usage patterns per library.
- `context/build-plan.md` / `context/progress-tracker.md` — what's built and what's next.

## Development

```
pnpm -F @societyledger/mobile dev
pnpm -F @societyledger/mobile lint
pnpm -F @societyledger/mobile type-check
pnpm -F @societyledger/mobile test
```

Copy `.env.example` to `.env.local` and fill in values for local development.
