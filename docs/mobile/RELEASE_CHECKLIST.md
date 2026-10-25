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

## Part 3b. APK for your own website (clients download and install it)

The  build is a test build: it is named "SocietyLedger (Preview)" and has a different app ID, so do not give it to clients.
Use the  profile, which is the production app (name SocietyLedger, ID , production
server) packaged as an installable APK:

\Resolved "production" environment for the build. Learn more: https://docs.expo.dev/eas/environment-variables/#setting-the-environment-for-your-builds
No environment variables with visibility "Plain text" and "Sensitive" found for the "production" environment on EAS.
Environment variables loaded from the "website-apk" build profile "env" configuration: APP_VARIANT, EAS_PROJECT_ID, EXPO_PUBLIC_API_URL, EXPO_PUBLIC_WEB_URL, EXPO_PUBLIC_BASE_DOMAIN, EXPO_PUBLIC_DOCS_URL.

- Incrementing versionCode from 5 to 6.
✔ Incremented versionCode from 5 to 6.


✔ Using remote Android credentials (Expo server)
✔ Using Keystore from configuration: Build Credentials smdzlWFjTW (default)

Compressing project files and uploading to EAS Build. Learn more: https://expo.fyi/eas-build-archive
- Compressing project files
- Uploading to EAS Build (0 / 83.6 MB)
✖ Uploading to EAS Build (17.2 MB / 83.6 MB)
Failed to upload the project tarball to EAS Build

Reason: request to https://storage.googleapis.com/turtle-v2-projects/production/e836085c-3f69-452d-bbab-b7f9c3b6c9d5/02c4cfb9-ea6b-4e74-b48b-c7e2022a49ed?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20261025%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20261025T224947Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host%3Bx-goog-content-length-range&X-Goog-Signature=0b6283e975aa38eafe49bafa28eb22a23ecc1f943f18a213eaba5f704314f8e1b4f7dc5f02df7f425fe291f99bf87cbfa81f665151bba9a3a22d8a513f4e9e49e3f37a2fca3f0da45e47ca26b9ea562c82e98f1015bedf437222f40a50a406e0d66a855c06cd22aa480ae040b222ec61273560f6c6d663366abe3f3451714e5c2917c8aff34daac44aae8e6641fd1d563c2d38e5bb3acb2ef52f22a4e21f2ea828b986d0310ac8c7709ce5a4f7472047233f70381a124844ea4bfd067d03ca846f919f01f1f2aa0ef5a9e3d7c24584c2f3b29a394a99aebfe2cd3d02a9a576cc6e767b37540737c5b2099213644d2937457296c949c7bd40e0cf72ef41c6aeea failed, reason: write ECONNRESET
Hosting it:
- Serve the file over **https**, with the type , from a fixed address
  (for example societyledger.com.ng/download/societyledger.apk). Replace the file for each release.
- Clients must allow installing from their browser (Android asks once). Google Play Protect may show an
  "unrecognised app" notice for apps not from the Play Store. A Play Store listing is the real fix.
- The APK and a later Play Store version use the **same app ID and signing key** (EAS keeps one key for the production
  ID), so a client can update from one to the other. Do not change the app ID later.
- Each new release needs a higher build number (EAS raises it for you). Clients update by installing the new APK over the old one.

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
