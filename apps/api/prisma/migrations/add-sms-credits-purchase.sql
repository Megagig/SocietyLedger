-- Create SMS Credits Purchase table
CREATE TABLE IF NOT EXISTS sms_credits_purchases (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  reference VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider VARCHAR(50) NOT NULL DEFAULT 'paystack',
  paid_at TIMESTAMP,
  metadata JSONB,
  paystack_response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_sms_credits_purchases_association ON sms_credits_purchases(association_id);
CREATE INDEX idx_sms_credits_purchases_reference ON sms_credits_purchases(reference);
CREATE INDEX idx_sms_credits_purchases_status ON sms_credits_purchases(status);

-- Create SMS Credit Balance table if it doesn't exist
CREATE TABLE IF NOT EXISTS sms_credit_balances (
  id SERIAL PRIMARY KEY,
  association_id INTEGER UNIQUE NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_credit_balances_association ON sms_credit_balances(association_id);

-- Add comment
COMMENT ON TABLE sms_credits_purchases IS 'Stores SMS credits purchase transactions via Paystack';
COMMENT ON TABLE sms_credit_balances IS 'Tracks SMS credit balance per association';
