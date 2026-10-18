import { AssociationStatus } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { extractSubdomain, extractSubdomainFromOrigin, findAssociationByIdentifier } from '../lib/tenant';

export interface TenantRequest extends Request {
  tenantId?: number;
  tenant?: {
    id: number;
    slug: string;
    subdomain: string;
    status: AssociationStatus;
    name: string;
    logo?: string | null;
  } | null;
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Allow health checks without tenant context
    if (req.path === '/health') {
      return next();
    }

    // Allow public association endpoints without an existing tenant
    if (
      req.path.startsWith('/api/associations/check-subdomain') ||
      req.path.startsWith('/api/associations/signup')
    ) {
      return next();
    }

    // Allow impersonation handoff exchange — tenant context is set from the token after exchange
    if (req.path.startsWith('/api/auth/impersonation/exchange')) {
      return next();
    }

    // Allow subscription verify endpoint without tenant (user redirected from Paystack)
    if (req.path.startsWith('/api/subscriptions/verify/')) {
      return next();
    }

    // Allow admin routes without tenant context (super admin operates across all tenants)
    if (req.path.startsWith('/api/admin')) {
      return next();
    }

    // Allow export routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/exports')) {
      return next();
    }

    // Allow report routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/reports')) {
      return next();
    }

    // Allow accounting routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/accounting')) {
      return next();
    }

    // Allow dashboard routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/dashboard')) {
      return next();
    }

    // Allow help routes - tenant context comes from authenticated user's associationId
    // Help content is global or association-specific, handled by the service
    if (req.path.startsWith('/api/help')) {
      return next();
    }

    // Allow support routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/support')) {
      return next();
    }

    // Allow member self-service routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/members/me')) {
      return next();
    }

    // Allow member-ledger routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/member-ledger')) {
      return next();
    }

    // Allow notifications routes - tenant context comes from authenticated user's associationId
    if (req.path.startsWith('/api/notifications')) {
      return next();
    }

    // Allow subscription plans endpoint without strict tenant requirement
    if (req.path === '/api/subscriptions/plans') {
      // Try to resolve tenant but don't fail if not found
      const headerTenant = (req.headers['x-tenant'] ?? req.headers['x-tenant-id']) as string | undefined;
      const subdomain = extractSubdomain(req.headers.host);
      const originSubdomain = extractSubdomainFromOrigin(req.headers.origin as string) || 
                             extractSubdomainFromOrigin(req.headers.referer as string);

      const association = await findAssociationByIdentifier({
        subdomain: headerTenant || subdomain || originSubdomain || undefined,
        slug: headerTenant?.toLowerCase(),
        id: headerTenant && !Number.isNaN(Number(headerTenant)) ? Number(headerTenant) : undefined,
      });

      if (association) {
        req.tenant = {
          id: association.id,
          slug: association.slug,
          subdomain: association.subdomain,
          status: association.status,
          name: association.name,
          logo: association.logo,
        };
        req.tenantId = association.id;
      }
      
      return next();
    }

    // Allow auth endpoints (login/register/me/logout) to proceed even without tenant
    // The controller will handle super admin login vs tenant user login
    if (
      req.path.startsWith('/api/auth/login') ||
      req.path.startsWith('/api/auth/register') ||
      req.path.startsWith('/api/auth/me') ||
      req.path.startsWith('/api/auth/logout') ||
      req.path.startsWith('/api/auth/verify-email') ||
      req.path.startsWith('/api/auth/resend-verification') ||
      req.path.startsWith('/api/auth/forgot-password') ||
      req.path.startsWith('/api/auth/reset-password') ||
      req.path.startsWith('/api/member-invites/verify') ||
      req.path.startsWith('/api/member-invites/accept')
    ) {
      // Try to resolve tenant but don't fail if not found
      const headerTenant = (req.headers['x-tenant'] ?? req.headers['x-tenant-id']) as string | undefined;
      const subdomain = extractSubdomain(req.headers.host);
      const originSubdomain = extractSubdomainFromOrigin(req.headers.origin as string) || 
                             extractSubdomainFromOrigin(req.headers.referer as string);

      const association = await findAssociationByIdentifier({
        subdomain: headerTenant || subdomain || originSubdomain || undefined,
        slug: headerTenant?.toLowerCase(),
        id: headerTenant && !Number.isNaN(Number(headerTenant)) ? Number(headerTenant) : undefined,
      });

      if (association) {
        req.tenant = {
          id: association.id,
          slug: association.slug,
          subdomain: association.subdomain,
          status: association.status,
          name: association.name,
          logo: association.logo,
        };
        req.tenantId = association.id;
      }
      
      return next();
    }

    const headerTenant = (req.headers['x-tenant'] ?? req.headers['x-tenant-id']) as string | undefined;
    const subdomain = extractSubdomain(req.headers.host);
    
    // For cross-origin requests (e.g., demo.localhost:3000 -> localhost:4000),
    // extract subdomain from Origin or Referer header
    const originSubdomain = extractSubdomainFromOrigin(req.headers.origin as string) || 
                           extractSubdomainFromOrigin(req.headers.referer as string);
    
    // Check for Super Admin's selected association context
    const superAdminAssociationId = req.headers['x-association-id'] as string | undefined;

    const association = await findAssociationByIdentifier({
      subdomain: headerTenant || subdomain || originSubdomain || undefined,
      slug: headerTenant?.toLowerCase(),
      id: (superAdminAssociationId && !Number.isNaN(Number(superAdminAssociationId))) 
        ? Number(superAdminAssociationId) 
        : (headerTenant && !Number.isNaN(Number(headerTenant)) ? Number(headerTenant) : undefined),
    });

    if (!association) {
      res.status(400).json({
        success: false,
        message: 'Association not found. Provide a valid subdomain or tenant header.',
      });
      return;
    }

    if (association.status === AssociationStatus.SUSPENDED) {
      res.status(403).json({
        success: false,
        message: 'Association is suspended. Please contact support.',
      });
      return;
    }

    if (association.status === AssociationStatus.CANCELLED) {
      res.status(403).json({
        success: false,
        message: 'Association subscription is cancelled.',
      });
      return;
    }

    req.tenant = {
      id: association.id,
      slug: association.slug,
      subdomain: association.subdomain,
      status: association.status,
      name: association.name,
      logo: association.logo,
    };
    req.tenantId = association.id;

    next();
  } catch (error) {
    next(error);
  }
}
