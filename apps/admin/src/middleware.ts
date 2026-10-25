import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'sl_admin_session';

// Public routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/2fa', '/invite', '/favicon', '/apple-touch-icon.png', '/brand/', '/_next', '/robots.txt', '/api/health'];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

// IP allowlist — comma-separated CIDRs or IPs. Empty = off.
const ALLOWED_IPS = (process.env.ADMIN_IP_ALLOWLIST ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function isIpAllowed(ip: string): boolean {
  if (ALLOWED_IPS.length === 0) return true;
  return ALLOWED_IPS.some((allowed) => ip === allowed || ip.startsWith(allowed.split('/')[0]));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // IP allowlist check (before anything else)
  if (ALLOWED_IPS.length > 0) {
    const clientIp = getClientIp(req);
    if (!isIpAllowed(clientIp)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // BFF routes handle their own auth
  if (pathname.startsWith('/bff')) {
    return NextResponse.next();
  }

  // Public paths — no session required
  if (isPublic(pathname)) {
    // Redirect authenticated users away from login
    if (pathname.startsWith('/login')) {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
    return NextResponse.next();
  }

  // Protected paths — require session cookie
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
