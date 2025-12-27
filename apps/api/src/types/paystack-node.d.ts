declare module 'paystack-node' {
  interface TransactionInitializeParams {
    email: string;
    amount: number;
    reference?: string;
    callback_url?: string;
    metadata?: Record<string, any>;
    channels?: string[];
    currency?: string;
  }

  interface TransactionInitializeResponse {
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }

  interface TransactionVerifyResponse {
    status: boolean;
    message: string;
    data: {
      status: string;
      reference: string;
      amount: number;
      paid_at: string;
      channel: string;
      currency: string;
      customer: {
        email: string;
      };
      metadata?: Record<string, any>;
    };
  }

  class Paystack {
    constructor(secretKey: string);
    
    initializeTransaction(params: TransactionInitializeParams): Promise<TransactionInitializeResponse>;
    verifyTransaction(reference: string): Promise<TransactionVerifyResponse>;
  }

  export default Paystack;
}
