import { NextRequest, NextResponse } from 'next/server';

function extractSubdomain(host?: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0]?.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return null;
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const [sub] = parts;
  if (sub === 'www') return null;
  return sub;
}

export function middleware(request: NextRequest) {
  const subdomain = extractSubdomain(request.headers.get('host'));
  const requestHeaders = new Headers(request.headers);

  if (subdomain) {
    requestHeaders.set('x-tenant', subdomain);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
