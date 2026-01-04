# Payment Settlement Guide

## Overview

This guide explains how to track and settle daily payments to associations until the automatic Paystack Split Payment (Subaccounts) feature is implemented.

---

## Current Payment Flow

1. **Member makes payment** → Money goes to platform Paystack account
2. **Payment recorded** → Tracked in `payment_gateway_transactions` table with `associationId`
3. **Daily settlement** → Platform transfers 98% to association, keeps 2% fee
4. **Record keeping** → All transactions tracked for audit

---

## Daily Settlement Process

### Step 1: Run Daily Report

Connect to your database and run:

```sql
-- Get today's payments by association
SELECT 
    a.id AS association_id,
    a.name AS association_name,
    a.subdomain,
    COUNT(DISTINCT pgt.id) AS total_transactions,
    SUM(pgt.amount) AS total_amount_ngn,
    SUM(pgt.amount * 0.98) AS amount_to_transfer_ngn,
    SUM(pgt.amount * 0.02) AS platform_fee_ngn,
    STRING_AGG(DISTINCT pgt.reference, ', ') AS payment_references
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND DATE(pgt.updated_at) = CURRENT_DATE
GROUP BY 
    a.id, a.name, a.subdomain
ORDER BY 
    total_amount_ngn DESC;
```

**Output Example:**
```
association_id | association_name      | total_amount_ngn | amount_to_transfer_ngn | platform_fee_ngn
---------------|----------------------|------------------|------------------------|------------------
1              | Demo Association     | 50,000.00        | 49,000.00              | 1,000.00
2              | Test Cooperative     | 25,000.00        | 24,500.00              | 500.00
```

### Step 2: Get Association Bank Details

```sql
-- Get bank details for settlements
SELECT 
    id,
    name,
    subdomain,
    -- Add these columns to associations table:
    bank_name,
    account_number,
    account_name
FROM 
    associations
WHERE 
    id IN (1, 2, ...);  -- IDs from Step 1
```

### Step 3: Transfer Funds

For each association:
1. Log into your bank/Paystack dashboard
2. Transfer the `amount_to_transfer_ngn` to their account
3. Use reference: `SETTLE-YYYY-MM-DD-{association_id}`
4. Keep the `platform_fee_ngn` in your account

### Step 4: Record Settlement (Optional but Recommended)

```sql
-- Mark payments as settled
UPDATE payment_gateway_transactions 
SET 
    settled = true,
    settled_at = NOW(),
    settlement_reference = 'SETTLE-2026-01-04-001',
    settlement_notes = 'Bank transfer completed'
WHERE 
    association_id = 1
    AND status = 'success'
    AND DATE(updated_at) = '2026-01-04';
```

---

## Database Schema Enhancement (Recommended)

Add settlement tracking to `payment_gateway_transactions`:

```sql
ALTER TABLE payment_gateway_transactions 
ADD COLUMN settled BOOLEAN DEFAULT false,
ADD COLUMN settled_at TIMESTAMP,
ADD COLUMN settlement_reference VARCHAR(255),
ADD COLUMN settlement_notes TEXT;

CREATE INDEX idx_pgt_settlement ON payment_gateway_transactions(association_id, settled, updated_at);
```

---

## Useful Queries

### Check Unsettled Payments

```sql
SELECT 
    a.name,
    COUNT(pgt.id) AS unsettled_count,
    SUM(pgt.amount) AS unsettled_amount,
    MIN(pgt.updated_at) AS oldest_payment
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.settled = false
GROUP BY 
    a.name;
```

### Monthly Platform Revenue

```sql
SELECT 
    DATE_TRUNC('month', updated_at) AS month,
    SUM(amount * 0.02) AS platform_revenue_ngn,
    COUNT(*) AS total_transactions
FROM 
    payment_gateway_transactions
WHERE 
    status = 'success'
    AND webhook_received = true
GROUP BY 
    DATE_TRUNC('month', updated_at)
ORDER BY 
    month DESC;
```

### Association Payment History

```sql
SELECT 
    pgt.reference,
    pgt.amount,
    pgt.amount * 0.98 AS transferred,
    pgt.amount * 0.02 AS platform_fee,
    pgt.updated_at AS payment_date,
    pgt.settled,
    pgt.settlement_reference,
    m.first_name || ' ' || m.last_name AS member_name
FROM 
    payment_gateway_transactions pgt
    LEFT JOIN transactions t ON pgt.transaction_id = t.id
    LEFT JOIN members m ON t.member_id = m.id
WHERE 
    pgt.association_id = 1  -- Replace with association ID
    AND pgt.status = 'success'
ORDER BY 
    pgt.updated_at DESC
LIMIT 50;
```

---

## Important Notes

### 1. **Association Tracking is Already Built-In**
- Every payment has `associationId` field
- No risk of mixing up payments
- Easy to generate reports per association

### 2. **Platform Fee (2%)**
- Covers Paystack transaction fees (~1.5%)
- Platform operational costs
- Profit margin (~0.5%)

### 3. **Settlement Frequency**
- **Recommended:** Daily settlements
- **Alternative:** Weekly settlements (Fridays)
- **Minimum:** Monthly settlements

### 4. **Audit Trail**
- All payments tracked in database
- Payment references stored
- Member information linked
- Transaction details preserved

### 5. **Future Automation**
When Paystack Subaccounts are implemented:
- Settlements will be automatic
- No manual transfers needed
- Real-time fund distribution
- This manual process becomes obsolete

---

## Troubleshooting

### Payment Not Showing in Report
- Check if `status = 'success'`
- Verify `webhook_received = true`
- Confirm payment date matches query date

### Association Missing Bank Details
- Contact association admin
- Request bank details via email
- Update association record in database

### Duplicate Settlements
- Always check `settled = false` before transferring
- Use unique settlement references
- Keep settlement log/spreadsheet

---

## Next Steps

1. **Immediate:** Use this manual process for settlements
2. **This Week:** Add bank details to association onboarding
3. **Next Sprint:** Implement Paystack Subaccounts for automation
4. **Future:** Add settlement dashboard in admin panel

---

## Support

For questions or issues:
- Check `apps/api/scripts/daily-payment-settlements.sql` for all queries
- Review payment records in database
- Contact associations for bank detail updates

---

**Last Updated:** January 4, 2026
**Status:** Manual Process (Temporary until Subaccounts implemented)
