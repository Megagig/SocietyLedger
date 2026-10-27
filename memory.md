# Memory — Billing review fixes, mobile fixes, member photos, and the Ajo/Thrift add-on plan

Last updated: 2026-10-27

> Replaces the earlier "Mobile Phase 9" memory. That work (brand rollout, Dokploy deployment, Oko demo seed, Maestro flows, EAS builds) is recorded in `context/progress-tracker.md` (Phase 9) and `docs/mobile/`. Nothing in this file is a secret; env var *names* only.

## What was built

**Billing review fixes (Plan Builder / entitlements, branch `Plan-Builder`)**
- Member limit now enforced on every member-creating path: `assertMemberCapacity` + `MemberLimitError` in `apps/api/src/middleware/subscription.middleware.ts`, used by self-registration (`member-invites.service.ts`), setup-wizard team invites (`onboarding.controller.ts`) and self-created profiles (`member-finance.controller.ts`). Test: `__tests__/billing/member-capacity.test.ts`.
- Subscription payment receipts: `GET /api/subscriptions/payments/:id/receipt` (`subscription.controller.ts`/`.routes.ts`), page `apps/web/src/app/dashboard/subscription/receipt/[id]/page.tsx`, "Receipt" link on the Subscription page.
- Removed dead `calculateSubscriptionAmount` (`lib/paystack.ts`); admin `not-found.tsx` uses Mantine colour variables; web pricing components use `primary-*` not `teal-*`.
- Docs/tracker/registry updated; deploy checklist in `docs/billing/PLAN_BUILDER.md`.
- Env vars for deploy: `REVALIDATE_SECRET` (same on API and web, generate with `openssl rand -hex 24`), `WEB_REVALIDATE_URL` (`https://societyledger.com.ng/api/revalidate`), `SUBSCRIPTION_NOMBA_ENABLED=false`, `FEATURE_FLAG_MODE` empty (`shadow` = enforcement off, emergency only).

**Mobile fixes**
- Biometric lockout: `features/auth/mutations.ts` `useLogin` now unlocks the app after a password sign-in; `app/(lock)/unlock.tsx` waits (max 2s) for foreground, shows the failure code, and turns app lock off with a toast on `not_enrolled`/`passcode_not_set`/`not_available`. Tests: `app/(lock)/unlock.test.tsx`, `features/auth/mutations.test.tsx`. Old dev builds lack `expo-local-authentication`, so they need a rebuild.
- Signed-in devices: API route `DELETE /api/auth/sessions/:familyId` (`revokeSessionForUser` in `refresh-token.service.ts`); mobile sends `X-Device-Name`/`X-Device-Platform` from `src/lib/device.ts` via `api/client.ts`. Old sessions stay "Unknown device".
- About screen links: `app/(app)/(tabs)/profile/about.tsx` uses `EXPO_PUBLIC_WEB_URL` (default `https://societyledger.com.ng`); new web page `apps/web/src/app/licenses` (+ footer link, sitemap).

**Member profile photos (API + mobile + web)**
- API: `Member.photoKey/photoThumbKey/photoUpdatedAt`, migration `20261105_member_photos` (applied to the dev DB with `db execute` + `migrate resolve`); `services/member-photo.service.ts` (sharp: 512px + 128px, strips EXIF, 5MB, jpeg/png/webp); `getStablePresignedUrl` in `lib/storage.ts` (6h windows so links cache); routes `PUT/DELETE /api/members/me/photo` and `/api/members/:id/photo` (needs `members.edit`) in `modules/members/member-photo.controller.ts`; `photoUrl`/`thumbUrl` returned by members list/detail/`/members/me`, `/auth/me`, login and payment proofs. Tests: `__tests__/members/member-photo*.test.ts`.
- Mobile: `Avatar` `imageUrl` prop (exact pixel sizes, 96 size added), `EditableAvatar` + `useProfilePhoto` (camera/library, square crop, remove), used on Profile and the officer's member detail; thumbs in `MemberRow`, Home greeting, proof rows.
- Web: `components/members/{MemberAvatar,ProfilePhotoEditor,SidebarAvatar}.tsx`, `hooks/useMyPhoto.ts`; wired into My Profile, member detail, Members table and the three sidebars.
- Blank Profile screen after adding a photo: changed the image from `100%` to exact pixel sizes (`Avatar.tsx`) — a best guess, **not confirmed on a device**.

**Ajo/Thrift add-on — planning only, nothing built**
- New `context/thrift-ajo-spec.md` (source of truth) plus Track T in `context/build-plan.md` (55 features, T0–T12, whole plan 171), `progress-tracker.md` (checklist, open questions, Decisions log rows), `architecture.md §18`, `project-overview.md §12`, `library-docs.md`, `code-standards.md`.

## Decisions made

Ajo (all owner decisions, 2026-10-27; recorded in the Decisions log):
- Both models: collector thrift (daily/weekly/monthly) and rotating pot. Roles: contributor, collector, officer, admin (admin approves payouts; preparer cannot approve).
- **One money mode only: the group's own bank account.** SocietyLedger is record-keeping software and never holds, collects or moves contribution money. **Removed by the owner:** escrow partner mode, Paystack settlement/payout mode, NIN/BVN/ID verification, KYC levels/provider, NDPA/legal planning items. Do not re-add without a new owner decision. Paystack is used only for the add-on subscription.
- Verification is two-step: group officer/admin approves; then SocietyLedger staff check name, phone, address and payout account name (no ID numbers or photos). Join/contribute after step 1; **no payout until step 2 verified**; changing the payout account resets to pending.
- Prices: Starter ≤30 ₦3,000.00/month (₦30,000.00/yr), Growth 31–150 ₦8,000.00, Business 151–500 ₦20,000.00, Enterprise 500+ from ₦40,000.00 custom; annual = 10× monthly; 14-day trial. Levy billed on the add-on invoice: cycle 0.5% (min ₦500, max ₦5,000) + participant 0.25% (min ₦50, max ₦1,000), Starter exempt.
- Payout order hybrid (recorded draw, swaps before first payout with admin approval, logged emergency exception after). Trust score = on-time % over 12 months with bands (95/85/70). Expired add-on = read-only, not a tenant lockout. Standalone thrift groups for outsiders are kept (tenant kind `THRIFT_GROUP`), no legal gate.
- Collector tools online only in the first release.

Other:
- Plan editor: modules/features are locked until "Edit terms (start a draft)" is clicked (versioned plans). The owner declined changing this UX.
- Photos: private storage with signed links; server cleans every upload; admins can set photos for members without logins (0 of 77 can sign in).

## Problems solved

- `prisma generate` EPERM on Windows: a hung Jest process held `query_engine-windows.dll.node`; ending it (or it finishing) fixed it. Find the holder with `Get-Process node | Modules` filter before retrying.
- Heredoc/inline `node -e` quoting breaks on large content: write patch scripts or files with the Write tool, then run them. Files are CRLF: normalise `\r\n` in patch scripts.
- `/recover` rule: diagnose first; if the same problem persists after one corrective prompt, stop.
- RNTL here is async: `await render(...)`, `await act(async () => ...)`; expo-image error events need `props.onError(...)` in tests.
- Web has no test runner; web checks are `tsc` + `eslint` only.

## Current state

- API/web/admin typecheck clean at last check; mobile suite 1057 passing (before the last Avatar test, which also passes); API photo/member/auth/billing tests pass. DB-backed billing suites need `BILLING_TEST_DATABASE_URL` (a database whose name contains "test"; the scratch DB was dropped).
- Pre-existing, unrelated: multi-tenancy Jest suites fail on ESM `otplib`; docs `gen:reference` permissions page fails on a spread; a few mobile `tsc` errors in `ImageViewerModal`, `Passbook`, `Skeleton`, `PagedList`.
- Not verified in a browser or on a phone: billing checkout/receipts, the biometric fix, devices list, About links, photo upload, the Profile blank-screen fix. Real Paystack not exercised.
- Photos not yet shown in: approvals queue, invitable list, role users, cooperatives guarantors, meetings, elections, announcements, comments. Web photo upload has a preview but no drag-to-crop box.
- Owner commits; I do not commit unless asked.

## Next session starts with

1. If the owner reports results: the Profile blank screen after photo upload (ask for the Metro error / `adb logcat` if still blank); the photo upload end to end on web and phone.
2. Otherwise the next planned work is **Ajo Track T1 (foundation)**: data model + migration, module/add-on catalogue with `ajoContributors` limit and read-only expiry, standalone tenant kind, RBAC, append-only ledger, settings. Read `context/thrift-ajo-spec.md` first.
3. Production deploy needs: DB backup, env vars above, run `apps/api/scripts/rebalance-default-plans.ts` (dry run, `--apply`, `--migrate`), new API deploy, new mobile build, `MINIO_PUBLIC_ENDPOINT` for photo links.

## Open questions

- Ajo: only one left — online-only collector vs weak connectivity in markets (revisit after the pilot).
- Whether to extend photos to the remaining places listed above, and whether to add a drag-to-crop box on web.
- Whether to add a "this device" tag on the signed-in devices list.
- Whether to add `context/thrift-ajo-spec.md` to the read-first list in `AGENTS.md`.
- Billing: member limit is still not enforced on the onboarding import path if one exists (none found); docs screenshots for changed billing pages need recapturing.
