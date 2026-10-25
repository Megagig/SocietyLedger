# Deploying the AI assistant and AI credits

What the AI assistant (and the Paystack-backed credits for it and for SMS) needs on a server. Written for Dokploy; the same applies anywhere.

## 1. Database

- Apply the migration `apps/api/prisma/migrations/20261026_add_ai_credits`. It adds `ai_credit_balances`, `ai_credit_purchases` and the `units`, `allowance_units` and `credit_units` columns on `ai_audit_logs`.
- Run it **before** the new API starts serving traffic, for example `prisma migrate deploy` as a release step. The AI endpoints query tables that do not exist until it has run.
- Run `prisma generate` when the API image is built, so the client knows the new tables.

## 2. API environment variables

| Variable | Needed | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | Without it the assistant answers "not configured". |
| `OPENROUTER_MODEL` | No | Default `deepseek/deepseek-chat`. The model saved in the admin console (Settings, AI) overrides it, so it can be changed without a deploy. |
| `FRONTEND_URL` | Yes | The bare app domain, for example `https://societyledger.com.ng`. No subdomain, no path. Paystack sends buyers back to `https://<association>.<this domain>`, so it must match the real tenant domain. |
| `API_PUBLIC_URL` (or `BACKEND_URL`) | Yes | The public API address. The mobile payment return uses it. |
| Paystack secret and public keys | Yes | Live keys for live use. |

## 3. Paystack dashboard

- Set the webhook to the API's Paystack webhook route (the one already used for subscriptions). It credits AI (`AIC-`) and SMS (`SMS-`) purchases the moment Paystack confirms, even if the buyer closes the page.
- Without a reachable webhook, credits are still added when the buyer returns to the app or reopens the credits page, which asks Paystack directly.

## 4. Domains

- A wildcard domain and certificate (`*.societyledger.com.ng`) must point at the web app. Payment returns go to the association's own subdomain, where the buyer is signed in.

## 5. After it is up

1. Admin console, Settings, AI: check the model, the credit price, the smallest purchase, the daily free requests by plan and what each request costs. Defaults apply until you save.
2. Switch the `ai` module on for the plans that should have it.
3. Make one small real purchase and check the credits are added and the purchase shows "Added".

## Not covered yet

- The help and support AI services still call the provider directly, outside the daily free requests and credits.
