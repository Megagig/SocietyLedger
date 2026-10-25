# Mobile release checklist (F9.1, F9.2, F9.6)

You run the builds and submissions. No CI is used (Dokploy deploys the servers; the app is built by hand).

## Part 1. Before the first build

1. Merge to `develop`, then `main`; deploy the servers on Dokploy with the env list in `.env.dokploy.example`.
2. Migrations and the reference-data seeds (plans, roles, permissions, modules, help content) run by themselves every time the API container starts. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` on the first deploy to create the first admin console login, then remove the password.
3. Create the demo association on **staging** (never production):
   `OKO_DEMO_PASSWORD=... pnpm --filter api seed:oko` (needs the staging `DATABASE_URL`).
4. Put the app's build variables in EAS (`eas env:create`, or in `eas.json` under each profile's `env`).
   `eas build` does **not** read `apps/mobile/.env.local`:

   | Variable | Value |
   |---|---|
   | `EXPO_PUBLIC_API_URL` | https://api.societyledger.com.ng (HTTPS only) |
   | `EXPO_PUBLIC_WEB_URL` | https://societyledger.com.ng |
   | `EXPO_PUBLIC_BASE_DOMAIN` | societyledger.com.ng |
   | `EXPO_PUBLIC_DOCS_URL` | https://docs.societyledger.com.ng |
   | `EXPO_PUBLIC_SENTRY_DSN` | from Sentry (only after finding A4 is fixed) |
   | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Sentry; the token is a secret |

   For the **preview** profile, add `"android": { "buildType": "apk" }` so you get an installable APK
   (without it, EAS builds an app bundle that cannot be installed directly).
5. Decide which approved findings from `PHASE9_REVIEW_FINDINGS.md` go in this build. Icons and splash only
   change with a **new native build**, never with an EAS Update.

## Part 2. Preview build and the phone (Redmi)

```bash
eas build --platform android --profile preview
```
Install the APK. Then:

### Cold start (target 2.5 s or less)
Close the app completely, then on the PC with USB debugging:
```bash
adb shell am force-stop ng.com.societyledger.app.preview
adb shell am start -W -n ng.com.societyledger.app.preview/.MainActivity
```
`TotalTime` is the cold-start time in ms. Run 5 times, record the median. Repeat once after a phone restart.

### Memory
Use the app normally for 10 minutes (open Home, Money, Community, a list, back out), then:
```bash
adb shell dumpsys meminfo ng.com.societyledger.app.preview | grep -E "TOTAL|Java Heap|Native Heap"
```
Record TOTAL PSS. Flag anything that keeps growing between two readings 5 minutes apart.

### Text size and motion
- Settings > Display > Font size: largest, and the scaling at 1.3x. Open Home, Money, Pay, Manage, Profile.
  Note any clipped label or button.
- Settings > Accessibility > Remove animations: open Home and a list; nothing should loop or bounce.

### TalkBack walkthrough (10 flows)
Turn on TalkBack (Settings > Accessibility). Swipe right to move, double-tap to activate. For each flow,
check: every control is announced with a sensible name, the order makes sense, nothing is announced as
"unlabelled button", and you can finish without looking.

1. Sign in (association code, then email and password)
2. Home: read the balance card and the next due
3. Pay a due with Paystack (up to opening checkout)
4. Upload a payment receipt
5. Vote in the election
6. Read notifications and mark one read
7. Join / view a meeting and add it to the calendar
8. Officer: verify a payment proof
9. Officer: mark attendance
10. Profile: security, app lock, sign out

Record failures in the table at the bottom of this file.

### E2E
```bash
cd apps/mobile && maestro test e2e/flows -e APP_ID=ng.com.societyledger.app.preview ...   # see e2e/README.md
```

## Part 3. Production release

1. All Part 2 results recorded; no open **Blocker** from `PHASE9_REVIEW_FINDINGS.md`.
2. Bump the version in `apps/mobile/app.config.ts` if this is not 1.0.0 (EAS auto-increments the build number).
3. Build: `eas build --platform android --profile production` (creates the `.aab`).
4. Submit to **Play Internal testing**: `eas submit --platform android --profile production`
   (first time needs the Play service-account key and one manual upload of the first build in the Play Console).
5. Test the internal build on the Redmi: sign in, one payment in test mode against staging, one vote.
6. Complete the Play listing from `STORE_READINESS.md` (Data safety, content rating, app access notes, screenshots).
7. Promote to **Production** with a **10% staged rollout**. Watch Sentry (crash-free sessions, new issues)
   and the API logs for 24 hours.
8. If crash-free sessions are 99% or better and there are no new error spikes, raise to 50%, then 100%.
   To stop: Play Console > Halt rollout.
9. **EAS Update** for JS-only fixes: `eas update --channel production --message "..."`. It cannot change icons,
   splash, permissions or native modules; those need a new build (the runtime version policy is `fingerprint`,
   so an incompatible update is simply not delivered to old builds).

## Part 4. iOS (later, needs an iPhone or a TestFlight tester)

Prepared but not verified: icon (no alpha), splash, Face ID string, privacy answers. Before submitting:
`eas build --platform ios --profile production`, install via TestFlight, run the TalkBack-equivalent
(VoiceOver) walkthrough, check Face ID, notifications and the calendar prompt.

## Results log (fill in)

| Check | Result | Date | Notes |
|---|---|---|---|
| Cold start, median of 5 (ms) | | | target 2500 |
| Memory TOTAL PSS after 10 min (MB) | | | |
| Font 1.3x: clipped screens | | | |
| Reduce motion | | | |
| TalkBack flow 1 to 10 | | | |
| Maestro 01 to 07 | | | |
| Sentry: first crash report received | | | needs finding A4 |
| Play internal test install | | | |
