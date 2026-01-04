-- ============================================================================
-- DAILY PAYMENT SETTLEMENTS REPORT
-- ============================================================================
-- This query helps track all online payments by association for daily settlements
-- Use this to transfer funds to each association with 2% platform fee deducted
-- ============================================================================

-- 1. DAILY PAYMENTS BY ASSOCIATION (Today's payments)
-- ============================================================================
SELECT 
    a.id AS association_id,
    a.name AS association_name,
    a.subdomain,
    COUNT(DISTINCT pgt.id) AS total_transactions,
    SUM(pgt.amount) AS total_amount_ngn,
    SUM(pgt.amount * 0.98) AS amount_to_transfer_ngn,  -- 98% (after 2% fee)
    SUM(pgt.amount * 0.02) AS platform_fee_ngn,        -- 2% platform fee
    STRING_AGG(DISTINCT pgt.reference, ', ') AS payment_references
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND DATE(pgt.updated_at) = CURRENT_DATE  -- Today's payments
GROUP BY 
    a.id, a.name, a.subdomain
ORDER BY 
    total_amount_ngn DESC;


-- 2. DETAILED PAYMENT BREAKDOWN (Today's payments with member info)
-- ============================================================================
SELECT 
    a.id AS association_id,
    a.name AS association_name,
    a.subdomain,
    pgt.reference AS payment_reference,
    pgt.amount AS amount_ngn,
    pgt.amount * 0.98 AS amount_to_transfer,
    pgt.amount * 0.02 AS platform_fee,
    pgt.updated_at AS payment_completed_at,
    m.member_id,
    m.first_name || ' ' || m.last_name AS member_name,
    m.email AS member_email,
    t.reference_number AS transaction_ref,
    fc.name AS category_name,
    p.receipt_number
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
    LEFT JOIN transactions t ON pgt.transaction_id = t.id
    LEFT JOIN members m ON t.member_id = m.id
    LEFT JOIN financial_categories fc ON t.category_id = fc.id
    LEFT JOIN payments p ON p.transaction_id = t.id AND p.payment_method = 'paystack'
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND DATE(pgt.updated_at) = CURRENT_DATE
ORDER BY 
    a.name, pgt.updated_at DESC;


-- 3. PENDING SETTLEMENTS (Successful payments not yet settled)
-- ============================================================================
-- Add a 'settled' column to payment_gateway_transactions table to track this
-- For now, this shows all successful payments from the last 7 days
SELECT 
    a.id AS association_id,
    a.name AS association_name,
    COUNT(pgt.id) AS pending_count,
    SUM(pgt.amount) AS total_pending_ngn,
    SUM(pgt.amount * 0.98) AS amount_to_transfer_ngn,
    MIN(pgt.updated_at) AS oldest_payment,
    MAX(pgt.updated_at) AS newest_payment
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND pgt.updated_at >= CURRENT_DATE - INTERVAL '7 days'
    -- AND pgt.settled = false  -- Uncomment when settled column is added
GROUP BY 
    a.id, a.name
HAVING 
    COUNT(pgt.id) > 0
ORDER BY 
    total_pending_ngn DESC;


-- 4. MONTHLY SUMMARY BY ASSOCIATION
-- ============================================================================
SELECT 
    a.id AS association_id,
    a.name AS association_name,
    DATE_TRUNC('month', pgt.updated_at) AS month,
    COUNT(pgt.id) AS total_transactions,
    SUM(pgt.amount) AS total_amount_ngn,
    SUM(pgt.amount * 0.98) AS total_transferred_ngn,
    SUM(pgt.amount * 0.02) AS total_platform_fees_ngn
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND pgt.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY 
    a.id, a.name, DATE_TRUNC('month', pgt.updated_at)
ORDER BY 
    month DESC, total_amount_ngn DESC;


-- 5. PAYMENT PROVIDER BREAKDOWN
-- ============================================================================
SELECT 
    a.name AS association_name,
    pgt.provider,
    COUNT(pgt.id) AS transaction_count,
    SUM(pgt.amount) AS total_amount_ngn,
    AVG(pgt.amount) AS avg_transaction_ngn
FROM 
    payment_gateway_transactions pgt
    INNER JOIN associations a ON pgt.association_id = a.id
WHERE 
    pgt.status = 'success'
    AND pgt.webhook_received = true
    AND DATE(pgt.updated_at) = CURRENT_DATE
GROUP BY 
    a.name, pgt.provider
ORDER BY 
    a.name, total_amount_ngn DESC;


-- ============================================================================
-- RECOMMENDED: Add settlement tracking column
-- ============================================================================
-- Run this migration to add settlement tracking:
/*
ALTER TABLE payment_gateway_transactions 
ADD COLUMN settled BOOLEAN DEFAULT false,
ADD COLUMN settled_at TIMESTAMP,
ADD COLUMN settlement_reference VARCHAR(255),
ADD COLUMN settlement_notes TEXT;

CREATE INDEX idx_pgt_settlement ON payment_gateway_transactions(association_id, settled, updated_at);
*/

-- After adding the column, update it when you transfer funds:
/*
UPDATE payment_gateway_transactions 
SET 
    settled = true,
    settled_at = NOW(),
    settlement_reference = 'SETTLE-2026-01-04-001',
    settlement_notes = 'Bank transfer to association account'
WHERE 
    id IN (1, 2, 3, ...);  -- IDs of payments being settled
*/


-- ============================================================================
-- QUICK DAILY SETTLEMENT WORKFLOW
-- ============================================================================
-- 1. Run Query #1 to get summary by association
-- 2. Run Query #2 to get detailed breakdown
-- 3. Transfer funds to each association (98% of total)
-- 4. Update settled status (when column is added)
-- 5. Keep 2% as platform fee
-- ============================================================================
