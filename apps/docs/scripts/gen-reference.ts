/**
 * Generates `content/docs/reference/*.mdx` from `apps/api`'s permissions,
 * statuses, payment methods and plan/module seeds (`project-overview.md
 * §9.6.21`). **Stub until D6.1** (`build-plan.md` explicitly allows this) —
 * the 5 reference pages stay as D1.3's hand-written stubs for now.
 *
 * Wired into CI now (D1.7) so the pipeline shape — generate, then fail if
 * the generated files changed but weren't committed — is already in
 * place before there's anything to generate. A no-op script touching no
 * files trivially satisfies that check; this stops being trivial at D6.1.
 *
 * Run: pnpm -F @societyledger/docs gen:reference
 */
console.log('gen:reference — stub until D6.1, no files written.');
