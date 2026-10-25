# Mobile E2E (Maestro)

Seven flows from build-plan F9.3. They run on a real Android phone against a **non-production** API.

> **Status: written from the code, not yet run on a device.** Labels and testIDs were taken from the
> screens, but the first run will probably need a few selector tweaks. Fix them in the YAML, not the app.

## One-time setup

1. Install the Maestro CLI (https://docs.maestro.dev/getting-started/installing-maestro). On Windows
   it runs under WSL2 or Git Bash; the phone connects over `adb` (USB debugging on).
2. Install the **preview** APK on the phone (`eas build --platform android --profile preview`).
3. Seed the demo association on the API the build points at (never production):
   `OKO_DEMO_PASSWORD=... pnpm --filter api seed:oko`
4. Paystack must be in **test mode** on that API.

## Run

```bash
cd apps/mobile
export APP_ID=ng.com.societyledger.app.preview
maestro test e2e/flows \
  -e APP_ID=$APP_ID \
  -e ASSOCIATION_CODE=oko-youth-forum \
  -e MEMBER_EMAIL=member@oko-youth-forum.example \
  -e OFFICER_EMAIL=treasurer@oko-youth-forum.example \
  -e PASSWORD="$OKO_DEMO_PASSWORD"
```

Run one flow: `maestro test e2e/flows/03-vote.yaml -e ...` (same `-e` list).
Flows are independent and each starts with a clean app state; they share `subflows/login.yaml` (kept out of `flows/` so Maestro does not run it alone).

## The flows

| File | Who | What it checks |
|---|---|---|
| 01-login-logout | member | sign in, land on Home, sign out |
| 02-pay-online | member | open an outstanding item, start Paystack test checkout |
| 03-vote | member | open the live election, cast a ballot, see "Already voted" |
| 04-submit-proof | member | declare a payment with a receipt image |
| 05-verify-proof | officer | open the pending proof and verify it |
| 06-take-attendance | officer | open today's meeting, mark everyone present |
| 07-switch-association | member | open Switch association from Profile |

Run 04 before 05: the seed already contains one pending proof, so 05 also passes on its own.

## Paystack test card (public Paystack test values)

Card `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`.
Never run flow 02 against a live Paystack key.
