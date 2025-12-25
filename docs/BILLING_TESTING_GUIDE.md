# Quick Start Guide - Testing Billing System

## Step 1: Configure Environment Variables

Add these to your `apps/api/.env`:

```env
# Paystack Test Mode Keys (Get from dashboard.paystack.com)
PAYSTACK_SECRET_KEY=sk_test_your_test_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_test_public_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```

## Step 2: Seed Subscription Plans

```bash
cd apps/api

# Make sure database is running
# Then seed the plans
npx tsx prisma/seed-plans.ts
```

This creates 3 plans:
- **Starter**: ₦5,000/month or ₦50,000/year (50 members)
- **Professional**: ₦15,000/month or ₦150,000/year (200 members)
- **Enterprise**: ₦35,000/month or ₦350,000/year (unlimited)

## Step 3: Start Development Servers

Terminal 1 - API:
```bash
cd apps/api
npm run dev
```

Terminal 2 - Web:
```bash
cd apps/web
npm run dev
```

## Step 4: Test the Flow

### 4.1 Create a Test Association (if not done)

```bash
# Using the registration endpoint
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testassoc.com",
    "password": "Test123!",
    "associationName": "Test Association",
    "subdomain": "testassoc"
  }'
```

### 4.2 Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testassoc.com",
    "password": "Test123!"
  }'
```

### 4.3 View Plans Page

Navigate to: http://localhost:3000/dashboard/subscription/plans

Or using the subdomain: http://testassoc.localhost:3000/dashboard/subscription/plans

### 4.4 Select a Plan

1. Choose Monthly or Annual billing
2. Click "Choose Plan"
3. You'll be redirected to Paystack checkout

### 4.5 Use Paystack Test Card

When on Paystack checkout page, use:

```
Card Number: 4084084084084081
CVV: 408
Expiry: Any future date (e.g., 12/25)
PIN: 0000
```

### 4.6 Complete Payment

After successful payment, you'll be redirected to:
`http://localhost:3000/dashboard/subscription/verify?reference=SUB-xxx`

The system will:
- Verify the payment with Paystack
- Activate the subscription
- Update the association status
- Show success message
- Redirect to subscription dashboard

### 4.7 View Subscription Dashboard

Navigate to: http://localhost:3000/dashboard/subscription

You should see:
- Current plan details
- Billing cycle and amount
- Next billing date
- Payment history
- Cancel/Reactivate options

## Step 5: Test API Endpoints Directly

### Get Available Plans
```bash
curl http://localhost:4000/api/subscriptions/plans
```

### Get Current Subscription (requires auth)
```bash
curl http://localhost:4000/api/subscriptions/current \
  -H "Cookie: auth-token=your_jwt_token"
```

### Initialize Payment
```bash
curl -X POST http://localhost:4000/api/subscriptions/initialize \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=your_jwt_token" \
  -d '{
    "planId": 1,
    "billingCycle": "MONTHLY"
  }'
```

### Cancel Subscription
```bash
curl -X POST http://localhost:4000/api/subscriptions/cancel \
  -H "Cookie: auth-token=your_jwt_token"
```

## Step 6: Test Webhooks (Optional)

To test webhooks locally, you'll need to expose your local server:

### Option 1: Using ngrok
```bash
ngrok http 4000
```

Then configure the webhook URL in Paystack dashboard:
```
https://your-ngrok-url.ngrok.io/api/webhooks/paystack
```

### Option 2: Manual webhook simulation
```bash
# Generate signature
echo -n '{"event":"charge.success","data":{"reference":"SUB-123-456"}}' | \
  openssl dgst -sha512 -hmac "your_webhook_secret"

# Send webhook
curl -X POST http://localhost:4000/api/webhooks/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: generated_signature" \
  -d '{"event":"charge.success","data":{"reference":"SUB-123-456"}}'
```

## Common Issues

### Issue: Database connection error
**Solution**: Wake up your Neon database by making a query in Prisma Studio or wait a moment for it to wake up.

### Issue: CORS errors
**Solution**: Make sure FRONTEND_URL in .env matches your actual frontend URL (http://localhost:3000)

### Issue: Payment not verifying
**Solution**: 
1. Check that reference exists in payment_history table
2. Verify PAYSTACK_SECRET_KEY is correct
3. Check API logs for error messages

### Issue: Webhook signature invalid
**Solution**: 
1. Get correct webhook secret from Paystack dashboard
2. Make sure you're sending raw body (not parsed JSON)
3. Check that webhook URL is registered in Paystack

## Next Steps

After testing billing:

1. **Protect Routes**: Add subscription middleware to premium features
   ```typescript
   router.use('/api/members', subscriptionMiddleware, memberRoutes);
   ```

2. **Add Feature Checks**: Use feature access middleware
   ```typescript
   router.use('/api/reports', featureAccessMiddleware('advancedReporting'));
   ```

3. **Implement Trial Reminders**: Set up cron jobs for trial expiry notifications

4. **Add Upgrade Prompts**: Show upgrade prompts when users hit limits

## Testing Checklist

- [ ] Can view all subscription plans
- [ ] Can select monthly billing
- [ ] Can select annual billing (shows savings)
- [ ] Payment initialization redirects to Paystack
- [ ] Can complete payment with test card
- [ ] Payment verification works
- [ ] Subscription status updates to ACTIVE
- [ ] Subscription dashboard shows correct info
- [ ] Payment history displays
- [ ] Can cancel subscription
- [ ] Can reactivate cancelled subscription
- [ ] Webhook handler processes events
- [ ] Subscription middleware blocks expired subscriptions

## Support

If you encounter issues:
1. Check API logs: `apps/api` console
2. Check browser console for frontend errors
3. Verify database records in Prisma Studio: `npm run db:studio`
4. Test Paystack connectivity: https://api.paystack.co/
