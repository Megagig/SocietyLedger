// Type declarations for Request object extensions
import { Plan, Subscription, PlatformRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        associationId?: number | null;
        role: string;
        platformRole?: PlatformRole;
        memberId?: number;
        // Impersonation tracking fields
        isImpersonating?: boolean;
        originalAssociationId?: number;
        impersonationTimestamp?: number;
      };
      tenantId?: number;
      tenant?: any;
      subscription?: Subscription;
      plan?: Plan;
    }
  }
}

// Module declaration for paystack-node
declare module 'paystack-node' {
  export default class Paystack {
    constructor(secretKey: string);
    transaction: {
      initialize(params: any): Promise<any>;
      verify(reference: string): Promise<any>;
    };
    subscription: {
      create(params: any): Promise<any>;
      disable(params: any): Promise<any>;
      enable(params: any): Promise<any>;
    };
    plan: {
      create(params: any): Promise<any>;
      list(): Promise<any>;
    };
  }
}

export {};
