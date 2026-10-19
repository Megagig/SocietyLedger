import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

// Public — no session cookie required. The invitee doesn't have a session
// yet; that's the whole point of this endpoint.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const upstream = await fetch(`${API_URL}/api/admin/auth/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'admin' },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('BFF invite accept error:', err);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
