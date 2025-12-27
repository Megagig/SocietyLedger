# Nomba Webhook Signature Verification Fix

**Date:** December 26, 2025  
**Status:** ✅ Fixed  
**Issue:** Incorrect webhook signature verification algorithm

---

## Problem

The initial Nomba integration used a generic HMAC SHA256 verification that hashed the raw JSON body, similar to Paystack. However, Nomba uses a **custom signature format** that requires constructing a specific payload string before hashing.

### User Discovery
User provided screenshot of Nomba dashboard showing:
- **Client ID**: `910b9b4f-ee3b-4b2b-b5df-341bf5f99b84`
- **Private Key**: `6XKubF7AiUFJ7UKpNB/CC1t...` (partially hidden)
- **Account ID**: `9129f542-d7d4-4bdb-d2cc-fcc2ecce6eb2`
- **No separate "Webhook Secret" field visible**

This revealed that:
1. The "Private Key" is for OAuth2 authentication (`NOMBA_API_SECRET`)
2. The webhook signature key is set separately in webhook settings (`NOMBA_WEBHOOK_SECRET`)
3. These are two different secrets with different purposes

---

## Solution

### Updated Signature Verification Algorithm

**Nomba's Signature Format:**
```
eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp
```

**Implementation:**
```typescript
verifyWebhookSignature(webhookPayload: NombaWebhookPayload, signature: string): boolean {
  const signatureKey = process.env.NOMBA_WEBHOOK_SECRET || '';
  
  // Extract fields from webhook payload
  const { event_type, requestId, data } = webhookPayload;
  const { merchant, transaction } = data;

  // Construct signature payload
  const signaturePayload = [
    event_type,
    requestId,
    merchant.userId,
    merchant.walletId,
    transaction.transactionId,
    transaction.type,
    transaction.time,
    '00', // responseCode
    new Date().toISOString(), // timestamp
  ].join(':');

  // Generate HMAC SHA256 hash (Base64 encoded)
  const hash = crypto
    .createHmac('sha256', signatureKey)
    .update(signaturePayload)
    .digest('base64');

  return hash === signature;
}
```

### Key Differences from Paystack

| Aspect | Paystack | Nomba |
|--------|----------|-------|
| **Signature Input** | Raw JSON body | Custom format string |
| **Hash Algorithm** | HMAC SHA512 | HMAC SHA256 |
| **Encoding** | Hex | Base64 |
| **Header Name** | x-paystack-signature | nomba-signature |
| **Secret Source** | API key | Webhook settings |

---

## Changes Made

### 1. Updated `nomba.service.ts`
- Changed `verifyWebhookSignature()` to accept `NombaWebhookPayload` object instead of raw string
- Implemented custom signature payload construction
- Changed encoding from hex to base64
- Added detailed error logging for signature mismatches

### 2. Updated `nomba.webhook.ts`
- Changed webhook header from `x-nomba-signature` to `nomba-signature`
- Pass parsed payload object to verification function instead of raw body
- Removed unnecessary `rawBody` variable

### 3. Updated Documentation
- Clarified credential mapping in `NOMBA_INTEGRATION_GUIDE.md`
- Added detailed webhook testing instructions with correct signature format
- Updated comparison table with signature differences
- Enhanced troubleshooting section

### 4. Updated `.env.example`
- Added inline comments explaining each credential
- Clarified that `NOMBA_API_SECRET` is "Private Key" from API Keys
- Clarified that `NOMBA_WEBHOOK_SECRET` is "Signature Key" from Webhook settings

---

## Configuration Guide

### Nomba Dashboard Setup

1. **API Keys Section** (Settings → API Keys):
   ```env
   NOMBA_API_KEY=<Client ID>
   NOMBA_API_SECRET=<Private Key>
   NOMBA_ACCOUNT_ID=<Account ID>
   ```

2. **Webhook Settings** (Settings → Webhooks):
   - Set webhook URL: `https://yourdomain.com/api/payments/webhook/nomba`
   - Set a **Signature Key** (save this as `NOMBA_WEBHOOK_SECRET`)

### Environment Variables
```env
# From API Keys section
NOMBA_API_KEY="910b9b4f-ee3b-4b2b-b5df-341bf5f99b84"
NOMBA_API_SECRET="6XKubF7AiUFJ7UKpNB/CC1t..."
NOMBA_ACCOUNT_ID="9129f542-d7d4-4bdb-d2cc-fcc2ecce6eb2"

# From Webhook settings
NOMBA_WEBHOOK_SECRET="your-custom-signature-key"
```

---

## Testing

### Test Webhook Signature
```bash
# Construct signature payload
SIGNATURE_PAYLOAD="payment_success:req-123:user-456:wallet-789:txn-abc:CREDIT:2025-12-26T12:00:00Z:00:2025-12-26T12:00:00Z"

# Generate signature (Base64 encoded)
SIGNATURE=$(echo -n "$SIGNATURE_PAYLOAD" | \
  openssl dgst -sha256 -hmac "YOUR_SIGNATURE_KEY" -binary | \
  base64)

# Send test webhook
curl -X POST http://localhost:4000/api/payments/webhook/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: $SIGNATURE" \
  -d @webhook-payload.json
```

---

## Next Steps

1. ✅ Update webhook signature verification algorithm
2. ✅ Update documentation with correct credential mapping
3. ✅ Update environment variable examples
4. ⏳ Regenerate Prisma client: `npm run prisma:generate`
5. ⏳ Test webhook with real Nomba account
6. ⏳ Configure production webhook URL in Nomba dashboard
7. ⏳ Monitor webhook delivery and signature verification in production

---

## Files Modified

- `apps/api/src/modules/payments/nomba/nomba.service.ts`
- `apps/api/src/modules/payments/nomba/nomba.webhook.ts`
- `docs/finances/NOMBA_INTEGRATION_GUIDE.md`
- `apps/api/.env.example`

---

**Status:** ✅ Code updated, ready for testing  
**Next:** Regenerate Prisma client and test with real Nomba webhooks
