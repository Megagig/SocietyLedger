import { Association, AssociationStatus } from '@prisma/client';
import prisma from './prisma';

const TENANT_HEADER = 'x-tenant';
const TENANT_ID_HEADER = 'x-tenant-id';

export interface TenantLookup {
  id?: number;
  slug?: string;
  subdomain?: string;
}

export function stripPort(host?: string | null): string {
  if (!host) return '';
  return host.split(':')[0] ?? '';
}

export function extractSubdomain(host?: string | null): string | null {
  const hostname = stripPort(host);
  if (!hostname) return null;

  // Handle localhost and IPs separately
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }

  // Handle .localhost TLD (e.g., demo.localhost)
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      return sub !== 'www' ? sub : null;
    }
  }

  // Handle regular domains
  const parts = hostname.split('.');
  if (parts.length < 3) {
    // example.com => no subdomain
    return null;
  }

  const [sub] = parts;
  if (sub === 'www') return null;
  return sub;
}

/**
 * Extract subdomain from Origin or Referer header (for cross-origin requests)
 */
export function extractSubdomainFromOrigin(originOrReferer?: string | null): string | null {
  if (!originOrReferer) return null;
  
  try {
    const url = new URL(originOrReferer);
    return extractSubdomain(url.hostname);
  } catch {
    return null;
  }
}

export async function findAssociationByIdentifier({
  id,
  slug,
  subdomain,
}: TenantLookup): Promise<Association | null> {
  if (!id && !slug && !subdomain) return null;

  return prisma.association.findFirst({
    where: {
      status: { notIn: [AssociationStatus.CANCELLED] },
      OR: [
        id ? { id } : undefined,
        slug ? { slug } : undefined,
        subdomain ? { subdomain } : undefined,
      ].filter(Boolean) as any,
    },
  });
}

export async function resolveAssociationFromRequestHeaders(headers: Record<string, string | string[] | undefined>): Promise<Association | null> {
  const headerTenant = (headers[TENANT_HEADER] ?? headers[TENANT_ID_HEADER]) as string | undefined;
  if (!headerTenant) return null;

  const numericId = Number(headerTenant);
  const lookup: TenantLookup = {};

  if (!Number.isNaN(numericId)) {
    lookup.id = numericId;
  }

  lookup.slug = headerTenant.toLowerCase();
  lookup.subdomain = headerTenant.toLowerCase();

  return findAssociationByIdentifier(lookup);
}

export function withTenant<T extends Record<string, any>>(associationId: number, data: T): T & { associationId: number } {
  return { ...data, associationId };
}

export function assertTenantId(tenantId?: number): number {
  if (!tenantId) {
    throw new Error('Tenant context is required for this operation');
  }
  return tenantId;
}
