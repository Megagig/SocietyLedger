# Deploying association signup, the free trial and the setup wizard (Phase 8)

What changes on a server when a new association can sign up from the phone, gets a 14-day Enterprise trial, and is blocked when the trial or plan ends.

## 1. Database

- Apply `apps/api/prisma/migrations/20261103_add_invite_role_and_onboarding_skips`. It adds `member_invites.role_name` (the officer role an invite grants) and `onboarding_progress.skipped_steps`.
- Run it **before** the new API starts, for example `prisma migrate deploy` as a release step, and run `prisma generate` when the image is built. On a developer machine, stop the API first: it holds the Prisma engine file open and `prisma generate` fails with EPERM until it stops.
- The kind of association is stored in the existing settings (`association.associationType` and `association.customAssociationType`), so there is no table change for it.

## 2. Turn on blocking carefully

Blocking is **on by default**. Before deploying, check which associations have no live subscription:

- An association with **no subscription row at all** is let in (so older associations are never locked out by mistake).
- An association whose latest subscription is **Expired** or **Cancelled** (past its paid period) is blocked at once. If you have such associations you do not want blocked yet, either give them a billing override in the admin console (bypass, paid externally, grace period or extended trial) or switch blocking off in the admin console under Settings, "Block associations whose trial or subscription has ended".
- The switch is read within about a minute; per-association results are cached for about 20 seconds.

## 3. Admin console

- Settings: "Default trial days" (1 to 90, default 14) now really sets the length of the trial, and "Allow new sign-ups", "Require email verification" and "Require admin approval" now really apply at signup. They were saved before but ignored.
- Approvals: each unverified person has "Mark email as verified" (needs a reason, written to the audit log) and "Resend verification code". The search box and a "Not verified" filter now work.
- Approving the founding admin starts the trial and sends the approval email, which now links to the association's own address.

## 4. Environment

| Variable | Notes |
| --- | --- |
| `FRONTEND_URL` | The bare app domain, for example `https://societyledger.com.ng`. The approval email and trial reminders build `https://<association>.<this domain>`. |
| Plans | A plan with code `enterprise` must exist (`prisma db seed`). Signup returns a configuration error without it. |

## 5. Mobile

- Release a new build: signup (A13), the setup wizard (O1 to O5), the trial banner and the blocked screen are app changes, not over-the-air updates only if native modules changed (none did), so an EAS Update on the right channel is enough.
- The blocked screen never shows prices or a pay button. Admins are told to renew on the web.

## 6. After it is up

1. Create a test association from the app. Check the verification email arrives, then use "Resend verification code" and "Mark email as verified" in the admin console on a second test account.
2. Approve the test admin. Check the trial end date is 14 days out, the approval email links to the association's address, and the wizard opens.
3. Set the test association's trial end date to the past (admin console billing override or database) and check web and mobile show the blocked screen, then pay or extend and check access returns.
