import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomainFromHost } from '@/utils/subdomain';

function extractSubdomain(host?: string | null): string | null {
  return extractSubdomainFromHost(host);
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
    const protectedRoutes = ['/dashboard'];
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
