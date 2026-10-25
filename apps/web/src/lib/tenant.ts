import { Association, AssociationStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { extractSubdomainFromHost } from '@/utils/subdomain';

export function stripPort(host?: string | null): string {
  if (!host) return '';
  return host.split(':')[0] ?? '';
}

export function extractSubdomain(host?: string | null): string | null {
  return extractSubdomainFromHost(host);
}

export async function resolveAssociation(request: NextRequest): Promise<Association | null> {
  const headerTenant = request.headers.get('x-tenant') || request.headers.get('x-tenant-id');
  const host = request.headers.get('host');
  const subdomain = headerTenant || extractSubdomain(host);

  if (!subdomain) return null;

  return prisma.association.findFirst({
    where: {
      status: { notIn: [AssociationStatus.CANCELLED] },
      OR: [
        { slug: subdomain.toLowerCase() },
        { subdomain: subdomain.toLowerCase() },
      ],
    },
  });
}
