import Paystack from 'paystack-node';

// Lazy initialization to avoid errors during module load
let paystackInstance: Paystack | null = null;

function getPaystackInstance(): Paystack {
  if (!paystackInstance) {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not defined in environment variables');
    }
    paystackInstance = new Paystack(process.env.PAYSTACK_SECRET_KEY);
  }
  return paystackInstance;
}

// Export a getter instead of direct instance
export const paystack = {
  get instance() {
    return getPaystackInstance();
  }
};

export const PAYSTACK_CONFIG = {
  get secretKey() {
    return process.env.PAYSTACK_SECRET_KEY || '';
  },
  get publicKey() {
    return process.env.PAYSTACK_PUBLIC_KEY || '';
  },
  get webhookSecret() {
    return process.env.PAYSTACK_WEBHOOK_SECRET || '';
  },
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

// Convert amount to Kobo (Paystack uses smallest currency unit)
export function toKobo(amount: number): number {
  return Math.round(amount * 100);
}

// Convert amount from Kobo to Naira
export function fromKobo(amount: number): number {
  return amount / 100;
}
