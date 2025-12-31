import { NextRequest, NextResponse } from 'next/server';

function extractSubdomain(host?: string | null): string | null {
  if (!host) return null;
  
  try {
    const hostname = host.split(':')[0]?.toLowerCase();
    if (!hostname || hostname === '127.0.0.1') return null;

    // Handle localhost subdomains (e.g., demo.localhost)
    if (hostname.endsWith('.localhost')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const sub = parts[0];
        return sub !== 'www' ? sub : null;
      }
    }

    // Handle regular domains
    if (hostname === 'localhost') return null;
    const parts = hostname.split('.');
    if (parts.length < 3) return null;
    const [sub] = parts;
    if (sub === 'www') return null;
    return sub;
  } catch (error) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  try {
    const subdomain = extractSubdomain(request.headers.get('host'));
    const requestHeaders = new Headers(request.headers);
    const pathname = request.nextUrl.pathname;

    // Add subdomain to headers
    if (subdomain) {
      requestHeaders.set('x-tenant', subdomain);
    }

    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/admin'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    // Check if accessing protected route
    if (isProtectedRoute) {
      // Get auth token from cookies
      const token = request.cookies.get('token')?.value;
      
      // If no token, redirect to login
      if (!token) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Public routes (auth pages) - redirect if already authenticated
    const publicRoutes = ['/auth/login', '/auth/register'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (isPublicRoute) {
      const token = request.cookies.get('token')?.value;
      
      // If has token, redirect to dashboard
      if (token) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // On error, just pass through
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
