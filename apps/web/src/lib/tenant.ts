import { Association, AssociationStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

export function stripPort(host?: string | null): string {
  if (!host) return '';
  return host.split(':')[0] ?? '';
}

export function extractSubdomain(host?: string | null): string | null {
  const hostname = stripPort(host)?.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;

  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const [sub] = parts;
  if (sub === 'www') return null;
  return sub;
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
