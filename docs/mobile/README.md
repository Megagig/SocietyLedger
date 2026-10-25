# Mobile backend docs

This folder documents the backend side of the mobile track (`build-plan.md` Mobile Phase 0 and onward). It exists so `apps/mobile` never has to guess an API shape — everything here was read directly from `apps/api` controller source, not assumed from `architecture.md`'s design-time sketch.

- **`api-contract.md`** — exact request/response shapes, auth/tenant requirements and error codes for every endpoint the mobile app's Phase 2–3 screens call, verified against the controller source on 2026-10-19 (F0.1). Treat `architecture.md §6`'s envelope description as a simplification; this doc has the real per-endpoint shape, which is not uniform.
- Discrepancies found between `packages/shared`'s existing types and the real API are logged inline in `api-contract.md` and tracked as gap **G2** in `progress-tracker.md` (fix deferred to F1.3 — mobile will not import the stale shared types, per `architecture.md §2`).
- Keep this doc current as F0.2–F0.6 change the contract (new `refreshToken` field, new `/devices` routes, new `code` fields, etc.) — each of those features should come back and update the relevant section here rather than leaving it to drift.
