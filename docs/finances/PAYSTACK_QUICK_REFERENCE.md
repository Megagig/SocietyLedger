# Paystack Integration - Quick Reference Card

**Last Updated:** December 26, 2025

---

## 🚀 Quick Start

### Environment Variables
```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
```

---

## 🔌 API Endpoints

### Initialize Payment
```bash
POST /api/payments/paystack/initialize
Content-Type: application/json
Cookie: token=JWT_TOKEN

{
  "transactionId": 123,
  "callbackUrl": "https://app.com/verify?reference=PAY-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "PAY-1735215357000-ABC123",
    "authorizationUrl": "https://checkout.paystack.com/xyz",
    "amount": 5000.00
  }
}
```

---

### Verify Payment
```bash
GET /api/payments/paystack/verify/:reference
Cookie: token=JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "amount": 5000.00,
    "receiptNumber": "RCP000123",
    "transactionStatus": "paid"
  }
}
```

---

### Get Payment Status
```bash
GET /api/payments/paystack/status/:reference
Cookie: token=JWT_TOKEN
```

---

### Webhook (Public)
```bash
POST /api/payments/webhook/paystack
Content-Type: application/json
x-paystack-signature: HMAC_SHA512_SIGNATURE

{
  "event": "charge.success",
  "data": { ... }
}
```

---

## 🧪 Test Cards

### Successful Payment
```
Card: 4084084084084081
CVV: 408
Expiry: 12/30
PIN: 0000
OTP: 123456
```

### Failed Payment
```
Card: 5060666666666666666
CVV: 123
Expiry: 12/30
```

---

## 💻 Frontend Integration

### Payment Button
```typescript
const handlePayment = async () => {
  const response = await fetch('/api/payments/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ transactionId: 123 }),
  });
  
  const data = await response.json();
  window.location.href = data.data.authorizationUrl;
};
```

### Verify Payment
```typescript
const verifyPayment = async (reference: string) => {
  const response = await fetch(
    `/api/payments/paystack/verify/${reference}`,
    { credentials: 'include' }
  );
  
  const data = await response.json();
  if (data.success) {
    // Show success message
  }
};
```

---

## 🔐 Security Checklist

- [x] Webhook signature verification (HMAC SHA512)
- [x] Idempotency protection (webhookReceived flag)
- [x] Multi-tenant isolation (associationId filter)
- [x] Atomic database transactions
- [x] Comprehensive audit logging
- [x] HTTPS only in production
- [x] Secure cookie handling

---

## 🗄️ Database

### PaymentGatewayTransaction Model
```prisma
model PaymentGatewayTransaction {
  id                Int       @id @default(autoincrement())
  associationId     Int
  transactionId     Int?
  provider          String    // 'paystack'
  reference         String    @unique
  amount            Decimal   @db.Decimal(10, 2)
  status            String    // 'pending', 'success', 'failed'
  webhookReceived   Boolean   @default(false)
  paystackResponse  Json?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

---

## 🔄 Payment Flow

```
1. User clicks "Pay with Paystack"
   ↓
2. POST /api/payments/paystack/initialize
   ↓
3. Redirect to Paystack checkout
   ↓
4. User completes payment
   ↓
5. Paystack sends webhook (automatic)
   ↓
6. User redirected back
   ↓
7. GET /api/payments/paystack/verify/:reference
   ↓
8. Show success + receipt
```

---

## 🐛 Debugging

### Check Payment Status
```sql
SELECT * FROM payment_gateway_transactions 
WHERE reference = 'PAY-123';
```

### Check Webhook Receipt
```sql
SELECT webhook_received, status, paystack_response 
FROM payment_gateway_transactions 
WHERE reference = 'PAY-123';
```

### View Audit Logs
```sql
SELECT * FROM audit_log 
WHERE action LIKE '%PAYMENT%' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📞 Support

- **Paystack Docs:** https://paystack.com/docs/
- **Webhook Docs:** https://paystack.com/docs/payments/webhooks/
- **Test Cards:** https://paystack.com/docs/payments/test-payments/

---

## ⚡ Common Issues

### Webhook Not Received
- Check webhook URL is publicly accessible
- Verify signature verification is working
- Check Paystack dashboard for webhook logs

### Payment Not Recorded
- Check webhook signature
- Verify transaction exists
- Check audit logs for errors

### Duplicate Payments
- Idempotency protection should prevent this
- Check `webhookReceived` flag

---

**Quick Reference Version:** 1.0  
**Last Updated:** December 26, 2025
