import { NextRequest, NextResponse } from 'next/server';
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  setChallengeCookie,
  clearChallengeCookie,
} from '@/lib/session.server';
import { API_URL } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${API_URL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'admin' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }

    // 2FA challenge
    if (data.data?.requires2fa || data.data?.requires2faSetup) {
      setChallengeCookie(data.data.challengeId);
      return NextResponse.json({
        success: true,
        data: {
          requires2fa: data.data.requires2fa,
          requires2faSetup: data.data.requires2faSetup,
        },
      });
    }

    // Successful login — set session cookie, clear any stale challenge
    setSessionCookie(data.data.token);
    clearChallengeCookie();

    return NextResponse.json({
      success: true,
      data: { user: data.data.user },
    });
  } catch (err) {
    console.error('BFF session POST error:', err);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest) {
  clearSessionCookie();
  clearChallengeCookie();
  return NextResponse.json({ success: true });
}

export async function GET(_req: NextRequest) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/api/admin/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Client': 'admin' },
  });

  if (!upstream.ok) {
    clearSessionCookie();
    return NextResponse.json({ success: false, message: 'Session expired' }, { status: 401 });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}
