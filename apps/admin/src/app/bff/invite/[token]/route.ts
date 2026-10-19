import { NextRequest, NextResponse } from 'next/server';
import { API_URL } from '@/lib/env';

// Public — no session cookie required. Looks up an invite by its raw
// token so the accept page can show who's inviting and to what role.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const upstream = await fetch(`${API_URL}/api/admin/auth/invite/${params.token}`, {
      headers: { 'X-Client': 'admin' },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('BFF invite GET error:', err);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
