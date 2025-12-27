# Nomba Payment Integration Guide

**Date:** December 26, 2025  
**Status:** ✅ Complete  
**Documentation:** https://developer.nomba.com/docs

---

## Overview

Nomba integration provides an alternative payment gateway for SocietyLedger, allowing users to choose between Paystack and Nomba for online payments. This gives associations flexibility and redundancy in payment processing.

---

## Features

### Core Capabilities
- ✅ OAuth2 authentication with Nomba API
- ✅ Payment initialization with checkout links
- ✅ Payment verification
- ✅ Webhook handling with signature verification
- ✅ Multi-tenant isolation
- ✅ Atomic transaction processing
- ✅ Audit logging
- ✅ Receipt generation
- ✅ Provider selection in UI

### Security Features
- ✅ HMAC SHA256 webhook signature verification
- ✅ Idempotency protection (prevents duplicate processing)
- ✅ OAuth2 token management with auto-refresh
- ✅ Tenant-scoped data access
- ✅ Comprehensive audit trail

---

## Architecture

### Backend Structure
```
apps/api/src/modules/payments/nomba/
├── nomba.service.ts      # Nomba API wrapper (OAuth2, payments)
├── nomba.controller.ts   # HTTP request handlers
├── nomba.webhook.ts      # Webhook event processor
├── nomba.types.ts        # TypeScript type definitions
└── nomba.routes.ts       # Express route definitions
```

### API Endpoints

#### 1. Initialize Payment
**POST** `/api/payments/nomba/initialize`

**Request:**
```json
{
  "transactionId": 123,
  "callbackUrl": "https://demo.societyledger.com/dashboard/finance/payments/verify"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "reference": "NMB-1735215357000-123",
    "checkoutLink": "https://checkout.nomba.com/xyz",
    "orderReference": "NMB-1735215357000-123",
    "amount": 5000.00
  }
}
```

#### 2. Verify Payment
**GET** `/api/payments/nomba/verify/:reference`

**Response:**
```json
{
  "success": true,
  "message": "Payment verified and recorded successfully",
  "data": {
    "status": "success",
    "reference": "NMB-1735215357000-123",
    "amount": 5000.00,
    "receiptNumber": "RCP000124",
    "transactionId": 123,
    "transactionStatus": "paid",
    "paidAt": "2025-12-26T12:00:00Z"
  }
}
```

#### 3. Get Payment Status
**GET** `/api/payments/nomba/status/:reference`

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "NMB-1735215357000-123",
    "status": "success",
    "amount": 5000.00,
    "provider": "nomba",
    "webhookReceived": true,
    "transaction": {
      "id": 123,
      "referenceNumber": "TXN000123",
      "status": "paid"
    }
  }
}
```

#### 4. Webhook Handler
**POST** `/api/payments/webhook/nomba`

**⚠️ PUBLIC ENDPOINT** - No authentication required  
**Security:** Webhook signature verification (HMAC SHA256)

**Supported Events:**
- `payment_success` - Payment completed successfully
- `payment_failed` - Payment failed
- `payment_pending` - Payment is pending

---

## Setup Instructions

### 1. Get Nomba API Credentials

1. Sign up at [Nomba Dashboard](https://dashboard.nomba.com)
2. Navigate to **Settings** → **API Keys**
3. Copy your API credentials:
   - **Client ID** (shown as API Key in dashboard)
   - **Private Key** (shown as API Secret - click to reveal)
   - **Account ID**
4. Navigate to **Settings** → **Webhooks**
5. Configure webhook:
   - Set webhook URL: `https://yourdomain.com/api/payments/webhook/nomba`
   - Set a **Signature Key** (this is your webhook secret)
   - Save the signature key securely

**Important Notes:**
- The "Private Key" in the dashboard is your `NOMBA_API_SECRET` (used for OAuth2 authentication)
- The "Signature Key" you set in webhook settings is your `NOMBA_WEBHOOK_SECRET` (used for webhook verification)
- These are two different secrets with different purposes

### 2. Configure Environment Variables

Add to `apps/api/.env`:

```env
# Nomba Configuration
# Get these from Nomba Dashboard → Settings → API Keys
NOMBA_API_KEY=your-client-id-from-dashboard
NOMBA_API_SECRET=your-private-key-from-dashboard
NOMBA_ACCOUNT_ID=your-account-id-from-dashboard

# Webhook signature key (set this in Nomba Dashboard → Settings → Webhooks)
NOMBA_WEBHOOK_SECRET=your-webhook-signature-key

# Nomba API base URL
NOMBA_BASE_URL=https://api.nomba.com/v1

# Frontend URL (for callbacks)
FRONTEND_URL=http://localhost:3000
```

**Credential Mapping:**
- `NOMBA_API_KEY` = "Client ID" from API Keys section
- `NOMBA_API_SECRET` = "Private Key" from API Keys section (click to reveal)
- `NOMBA_ACCOUNT_ID` = "Account ID" from API Keys section
- `NOMBA_WEBHOOK_SECRET` = "Signature Key" you set in Webhooks section

**Production:**
```env
NOMBA_API_KEY=your-live-api-key
NOMBA_API_SECRET=your-live-api-secret
NOMBA_ACCOUNT_ID=your-live-account-id
NOMBA_WEBHOOK_SECRET=your-live-webhook-secret
NOMBA_BASE_URL=https://api.nomba.com/v1
FRONTEND_URL=https://societyledger.com
```

### 3. Test the Integration

#### Test Payment Flow
1. Navigate to a transaction details page
2. Select "Nomba" from the payment provider dropdown
3. Click "Pay ₦X"
4. Complete payment on Nomba checkout page
5. Verify redirect back to verification page
6. Check payment recorded in database

#### Test Webhook
```bash
# Note: Nomba uses a specific signature format
# Format: eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp

# Example payload construction
SIGNATURE_PAYLOAD="payment_success:test-request-id:user-123:wallet-456:txn-789:CREDIT:2025-12-26T12:00:00Z:00:2025-12-26T12:00:00Z"

# Generate signature (replace YOUR_SIGNATURE_KEY with your webhook secret)
SIGNATURE=$(echo -n "$SIGNATURE_PAYLOAD" | openssl dgst -sha256 -hmac "YOUR_SIGNATURE_KEY" -binary | base64)

# Send webhook
curl -X POST http://localhost:4000/api/payments/webhook/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: $SIGNATURE" \
  -d '{
    "event_type": "payment_success",
    "requestId": "test-request-id",
    "data": {
      "merchant": {
        "userId": "user-123",
        "walletId": "wallet-456",
        "walletBalance": 1000000
      },
      "transaction": {
        "transactionId": "txn-789",
        "type": "CREDIT",
        "originatingFrom": "WEB",
        "transactionAmount": 500000,
        "fee": 7500,
        "time": "2025-12-26T12:00:00Z",
        "merchantTxRef": "NMB-123"
      },
      "order": {
        "accountId": "acc-123",
        "orderReference": "NMB-123",
        "callbackUrl": "http://localhost:3000/verify",
        "customerEmail": "test@example.com",
        "amount": 5000.00,
        "currency": "NGN",
        "customerId": "member-123"
      }
    }
  }'
```

**Important:** The signature must match the exact format Nomba uses:
- Fields joined with colons (`:`)
- Order: `eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp`
- Hashed with HMAC SHA256
- Base64 encoded (not hex)

---

## Payment Flow

### End-to-End Flow

```
1. Member views transaction details
   └─ Selects "Nomba" from provider dropdown
   └─ Clicks "Pay ₦X with Nomba"

2. Frontend: POST /api/payments/nomba/initialize
   └─ Backend: Authenticates with Nomba (OAuth2)
   └─ Backend: Creates checkout order
   └─ Backend: Saves PaymentGatewayTransaction (pending)
   └─ Returns: checkoutLink

3. Member redirected to Nomba checkout
   └─ Nomba hosted payment page
   └─ Member enters card details / selects bank

4. Member completes payment
   └─ Nomba processes payment
   └─ Nomba sends webhook: POST /api/payments/webhook/nomba
   └─ Backend: Verifies signature (HMAC SHA256)
   └─ Backend: Records payment, updates transaction

5. Member redirected back to app
   └─ Frontend: GET /api/payments/nomba/verify/:reference
   └─ Backend: Verifies payment, returns status
   └─ Frontend: Shows success message + receipt

6. Member receives confirmation
   └─ Receipt available for download
   └─ Email notification (TODO - Phase 6)
```

### Backend Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  1. Initialize Payment                                  │
│  POST /api/payments/nomba/initialize                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ • Validate transaction                           │  │
│  │ • Calculate outstanding balance                  │  │
│  │ • Generate unique reference (NMB-timestamp-id)   │  │
│  │ • Authenticate with Nomba (OAuth2)               │  │
│  │ • Create checkout order                          │  │
│  │ • Create PaymentGatewayTransaction (pending)     │  │
│  │ • Return checkoutLink                            │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  2. User Pays on Nomba                                  │
│  (External - Nomba hosted page)                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  3. Webhook Received                                    │
│  POST /api/payments/webhook/nomba                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ • Verify signature (HMAC SHA256)                 │  │
│  │ • Find PaymentGatewayTransaction                 │  │
│  │ • Check idempotency (webhookReceived flag)       │  │
│  │ • Atomic transaction:                            │  │
│  │   - Update gateway transaction (success)         │  │
│  │   - Create Payment record                        │  │
│  │   - Update Transaction status (paid/partial)     │  │
│  │   - Create audit log                             │  │
│  │ • Return 200 OK                                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  4. Verify Payment (User Redirect)                      │
│  GET /api/payments/nomba/verify/:reference              │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ • Find PaymentGatewayTransaction                 │  │
│  │ • If already processed, return status            │  │
│  │ • Else, call Nomba verify API                    │  │
│  │ • Record payment (same as webhook)               │  │
│  │ • Return success + receipt number                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Integration

### Payment Button with Provider Selection

The `PaymentButton` component now includes a dropdown to select between Paystack and Nomba:

```typescript
<PaymentButton
  transactionId={transaction.id}
  amount={transaction.balance}
  variant="filled"
  size="md"
/>
```

**Features:**
- Provider selection dropdown (Paystack / Nomba)
- Automatic endpoint routing based on selection
- Unified payment flow for both providers
- Loading states and error handling

### Payment Verification

The verification page automatically detects the provider from the reference format:
- Paystack: `PAY-timestamp-id`
- Nomba: `NMB-timestamp-id`

---

## Comparison: Paystack vs Nomba

| Feature | Paystack | Nomba |
|---------|----------|-------|
| **Authentication** | API Key (Bearer token) | OAuth2 (Client credentials) |
| **Webhook Signature** | HMAC SHA512 (raw JSON) | HMAC SHA256 (custom format) |
| **Webhook Header** | x-paystack-signature | nomba-signature |
| **Signature Format** | Raw JSON body | eventType:requestId:userId:... |
| **Signature Encoding** | Hex | Base64 |
| **Amount Format** | Kobo (x100) | Kobo (x100) |
| **Checkout** | Hosted page | Hosted page |
| **Payment Methods** | Card, Bank Transfer, USSD | Card, Bank Transfer, Flash Account |
| **Reference Format** | PAY-timestamp-id | NMB-timestamp-id |
| **API Base URL** | https://api.paystack.co | https://api.nomba.com/v1 |

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failed
**Error:** "Failed to authenticate with Nomba"

**Solution:**
- Verify `NOMBA_API_KEY` and `NOMBA_API_SECRET` are correct
- Check if credentials are for the correct environment (test/live)
- Ensure `NOMBA_ACCOUNT_ID` matches your account

#### 2. Webhook Signature Verification Failed
**Error:** "Invalid signature"

**Solution:**
- Verify `NOMBA_WEBHOOK_SECRET` matches the signature key you set in Nomba dashboard webhook settings
- Check webhook URL is correctly configured in Nomba dashboard
- Ensure the signature format matches Nomba's specification:
  - Format: `eventType:requestId:userId:walletId:transactionId:transactionType:transactionTime:responseCode:timestamp`
  - Algorithm: HMAC SHA256
  - Encoding: Base64 (not hex)
- Verify webhook header is `nomba-signature` (not `x-nomba-signature`)
- Check that all required fields are present in the webhook payload

#### 3. Payment Not Found
**Error:** "Payment record not found"

**Solution:**
- Verify reference format is correct (NMB-timestamp-id)
- Check if PaymentGatewayTransaction was created
- Ensure tenant context is correct

#### 4. Token Expired
**Error:** "Token expired"

**Solution:**
- Service automatically refreshes tokens
- Check if `NOMBA_API_SECRET` is correct
- Verify system time is synchronized

---

## Security Best Practices

### 1. Webhook Security
- ✅ Always verify webhook signatures
- ✅ Use HTTPS for webhook URLs
- ✅ Implement idempotency checks
- ✅ Log all webhook events

### 2. API Security
- ✅ Store credentials in environment variables
- ✅ Never expose API keys in frontend
- ✅ Use HTTPS for all API calls
- ✅ Implement rate limiting

### 3. Data Security
- ✅ Encrypt sensitive data at rest
- ✅ Use parameterized queries (Prisma)
- ✅ Implement tenant isolation
- ✅ Audit all financial operations

---

## Testing

### Test Credentials
Nomba provides test credentials in their dashboard. Use these for development and testing.

### Test Scenarios
1. ✅ Successful payment flow
2. ✅ Failed payment handling
3. ✅ Pending payment status
4. ✅ Webhook processing
5. ✅ Duplicate webhook handling (idempotency)
6. ✅ Multi-tenant isolation
7. ✅ Provider switching (Paystack ↔ Nomba)

---

## Monitoring

### Key Metrics to Track
- Payment success rate per provider
- Average payment processing time
- Webhook delivery success rate
- API authentication failures
- Provider availability

### Logging
All Nomba operations are logged with:
- Tenant ID
- User ID
- Reference number
- Amount
- Status
- Timestamp

---

## Support

### Nomba Support
- **Documentation:** https://developer.nomba.com/docs
- **Support Email:** support@nomba.com
- **Dashboard:** https://dashboard.nomba.com

### Internal Support
- Check audit logs for payment history
- Review webhook logs for processing issues
- Monitor error rates in Sentry
- Contact development team for integration issues

---

**Last Updated:** December 26, 2025  
**Status:** ✅ Production Ready  
**Next Steps:** Test with real Nomba account, configure production webhooks

---

**Built with ❤️ for African Associations**
