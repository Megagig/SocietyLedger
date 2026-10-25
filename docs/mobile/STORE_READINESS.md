# Store readiness (F9.5): Google Play first, App Store prepared

Android is the first release. iOS items are prepared but **not verified on a device** and not submitted.
Fill the `<...>` blanks yourself; nothing here contains a real credential.

## 1. Identity

| Item | Value |
|---|---|
| App name | SocietyLedger |
| Android package | `ng.com.societyledger.app` |
| iOS bundle ID | `ng.com.societyledger.app` |
| Category | Finance (alternative: Productivity) |
| Support email | support@societyledger.com.ng |
| Privacy policy URL | https://societyledger.com.ng/privacy (fix the About-screen link first, finding A6) |
| Terms URL | https://societyledger.com.ng/terms |
| Website | https://societyledger.com.ng |

## 2. Graphics (all from `SocietyLedger-brand/`)

| Asset | File | Where |
|---|---|---|
| App icon (iOS, 1024, no alpha) | `app/icon.png` | already in the app |
| Play hi-res icon (512) | `favicon/icon-512.png` | Play Console, upload |
| Play feature graphic (1024x500) | **not in the kit** | needs making; use `master/logo-horizontal-dark.png` on slate `#0F172A` |
| Phone screenshots, 2 to 8 | take on the Redmi | see section 7 |
| Social / OG image | `social/og-image-1200x630.png` | website only |

## 3. Permissions and usage strings

Every permission the app can request, and why. Strings live in `apps/mobile/app.config.ts`.

| Permission | Why | String (iOS) / note |
|---|---|---|
| Camera | Photograph a payment receipt or deposit slip | "Allow SocietyLedger to use your camera to take a photo of a payment receipt." (set) |
| Photos | Attach a receipt or logo from the gallery | "Allow SocietyLedger to access your photos to attach a payment receipt." (set) |
| Face ID / biometrics | App lock and confirming sensitive actions | "Allow SocietyLedger to use Face ID to unlock the app and confirm sensitive actions." (set) |
| Notifications | Dues reminders, meeting and election alerts | iOS asks at runtime, no string needed. Android 13+ runtime prompt. |
| Calendar | Add a meeting to the phone calendar | **Missing, add before release** (finding A5): "Allow SocietyLedger to add meetings to your calendar." |
| Internet | Everything | Android `INTERNET`, automatic |

Not requested: location, contacts, microphone, SMS, background location, advertising ID.

## 4. Google Play: Data safety form

Answer from this table. "Collected" = leaves the device to our servers.

| Data type | Collected | Shared | Purpose | Optional | Encrypted in transit |
|---|---|---|---|---|---|
| Name | Yes | No | App functionality, account management | No | Yes |
| Email address | Yes | No | Account management, communications | No | Yes |
| Phone number | Yes | No | Account management, communications | Yes | Yes |
| Physical address | Yes | No | App functionality (member records) | Yes | Yes |
| Financial info: payments / dues history | Yes | No | App functionality | No | Yes |
| Photos (receipts, logo) | Yes | No | App functionality | Yes | Yes |
| Other user-generated content (support tickets, poll answers) | Yes | No | App functionality | Yes | Yes |
| Device or other IDs (push token) | Yes | No | App functionality (notifications) | Yes | Yes |
| Crash logs / diagnostics | Yes, once crash reporting is on (finding A4) | Shared with Sentry as a service provider | Analytics, app stability | No | Yes |
| Location, contacts, audio, health, browsing, search | No | | | | |

Other answers:
- **Payment card details:** not collected by us. Card entry happens on Paystack's page; we only receive a
  success/failure and a reference.
- **Data deletion:** users can ask their association administrator, or email support@societyledger.com.ng.
  Play requires a deletion-request URL: point it at https://societyledger.com.ng/contact (or a dedicated page).
- **Families / children:** not designed for children.
- **Ads:** none. **Account required:** yes. **Data sold:** no.

## 5. Apple: App Privacy ("nutrition labels"), prepared for later

"Data Linked to You": Contact Info (name, email, phone, address), Financial Info (payment history),
User Content (photos, support messages), Identifiers (device push token), Diagnostics (crash data).
"Data Used to Track You": none. No third-party advertising.

## 6. Age rating

- **Google Play (IARC):** answer "No" to violence, sexual content, profanity, drugs, gambling (the app handles
  association money but is not a gambling product), user-to-user chat. Expected rating: **Everyone / 3+**.
  If asked about user-generated content: members can post announcements and poll answers inside their own
  association only (no public feed).
- **App Store:** 4+.

## 7. Screenshots (take on the Redmi after the first build)

Seed `oko-youth-forum` first. Use light and dark mode for the first three. Android, 1080x1920 or the phone's
native size (Play accepts 16:9 to 9:16).

1. Home (member view, with the Passbook card)
2. Money: outstanding dues and Pay now
3. Pay: Paystack option and bank-transfer receipt upload
4. Community: live election with candidates
5. Manage: officer payments and proof verification
6. Meetings: attendance list
7. Notifications
8. Profile, security and app lock

Hide real names: the seed data is fictional, so use only `oko-youth-forum`.

## 8. Review notes (paste into Play "App access" and App Review notes)

> SocietyLedger is a management app for associations (dues, meetings, elections, welfare). Each association
> has its own space, found by an association code.
>
> **To review, choose "Get started", enter the association code `oko-youth-forum`, then sign in with either:**
> - Member: `member@oko-youth-forum.example`, password `<OKO_DEMO_PASSWORD>`
> - Officer (treasurer): `treasurer@oko-youth-forum.example`, password `<OKO_DEMO_PASSWORD>`
>
> The demo association contains fictional data only. Payments are made through Paystack; the reviewer
> environment uses **test mode** (test card 4084 0840 8408 4081, any future date, CVV 408, PIN 0000, OTP 123456),
> so no real money moves. The app does not sell digital goods or subscriptions inside the app: association
> subscription billing is handled on our website, and the app shows no prices or purchase buttons for it.
> Support: support@societyledger.com.ng.

Before submitting: run the seed on the **staging** API the production-profile build points at (or accept that
reviewers use production with a dedicated demo association; you said to avoid production, so a staging API
reachable over HTTPS is required for review).

## 9. Production profile settings to confirm

- `APP_VARIANT=production`, `EXPO_PUBLIC_API_URL` = HTTPS API (never an IP or `http://`).
- Android release builds block plain HTTP; the production API must be HTTPS.
- Version: `1.0.0` in `app.config.ts`; `autoIncrement` is on in `eas.json` (EAS manages the version code).
- Android build type for Play must be an **app bundle** (`aab`), which is the default for the `production` profile.
- Submit track: start with Play **Internal testing**, then **Production** with a 10% staged rollout.

## 10. Known gaps before a store submission

| Gap | Owner |
|---|---|
| Calendar permission string (A5) | code, needs your yes |
| About-screen privacy and terms links (A6) | code, needs your yes |
| Play feature graphic (1024x500) | you or a designer |
| Data-deletion URL | you |
| Sentry initialisation so "Diagnostics" is accurate (A4) | code, needs your yes |
| iOS: dark/tinted icon variants (optional), TestFlight on a real iPhone | later |
