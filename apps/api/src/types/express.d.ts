// Type declarations for Request object extensions
import { Plan, Subscription } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        associationId: number | null;
        role: string;
        platformRole?: string;
      };
      tenantId?: number;
      tenant?: any;
      subscription?: Subscription;
      plan?: Plan;
    }
  }
}

export {};
