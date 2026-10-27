import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session.server';
import { API_URL } from '@/lib/env';

// Only these API prefixes may be forwarded — everything else is 404
// admin/ covers all platform admin endpoints; subscriptions/plans for plan picker
const ALLOW_LIST = [
  'admin/',
  'subscriptions/plans',
];

function isAllowed(apiPath: string): boolean {
  return ALLOW_LIST.some((prefix) => apiPath.startsWith(prefix));
}

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const apiPath = params.path.join('/');

  if (!isAllowed(apiPath)) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }

  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  // Reject requests whose Origin is not this admin host (CSRF)
  const origin = req.headers.get('origin');
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST ?? 'http://localhost:3002';
  if (origin && origin !== adminHost) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(`${API_URL}/api/${apiPath}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': req.headers.get('content-type') ?? 'application/json',
    'X-Client': 'admin',
  };

  let body: BodyInit | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer().then((b) => Buffer.from(b));
  }

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
    // @ts-ignore — Node 18 fetch doesn't have duplex type but it's needed
    duplex: 'half',
  });

  if (upstream.status === 401) {
    const res = NextResponse.json({ success: false, message: 'Session expired' }, { status: 401 });
    return res;
  }

  // Bytes, not text: an Excel export is binary and would be corrupted by a text round-trip.
  const data = await upstream.arrayBuffer();
  const responseHeaders: Record<string, string> = { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' };
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) responseHeaders['Content-Disposition'] = disposition;
  return new NextResponse(data, { status: upstream.status, headers: responseHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
