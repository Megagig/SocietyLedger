import Paystack from 'paystack-node';

if (!process.env.PAYSTACK_SECRET_KEY) {
  throw new Error('PAYSTACK_SECRET_KEY is not defined in environment variables');
}

// Initialize Paystack with secret key
export const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);

export const PAYSTACK_CONFIG = {
  secretKey: process.env.PAYSTACK_SECRET_KEY,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
};

// Helper function to verify Paystack webhook signature
export function verifyPaystackSignature(payload: string, signature: string): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', PAYSTACK_CONFIG.webhookSecret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

// Helper function to calculate subscription price based on billing cycle
export function calculateSubscriptionAmount(
  monthlyPrice: number,
  annualPrice: number,
  billingCycle: 'MONTHLY' | 'ANNUAL'
): number {
  return billingCycle === 'MONTHLY' ? monthlyPrice : annualPrice;
}

// Convert amount to Kobo (Paystack uses smallest currency unit)
export function toKobo(amount: number): number {
  return Math.round(amount * 100);
}

// Convert amount from Kobo to Naira
export function fromKobo(amount: number): number {
  return amount / 100;
}
