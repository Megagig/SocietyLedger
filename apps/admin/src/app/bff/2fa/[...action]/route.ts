import { NextRequest, NextResponse } from 'next/server';
import {
  setSessionCookie,
  clearChallengeCookie,
  getChallengeCookieId,
} from '@/lib/session.server';
import { API_URL } from '@/lib/env';

// Handles pre-session 2FA operations: verify, recovery, setup, confirm
// Reads challengeId from the httpOnly challenge cookie (client JS cannot read it)
export async function POST(
  req: NextRequest,
  { params }: { params: { action: string[] } },
) {
  const action = params.action.join('/');

  const ALLOWED_ACTIONS = ['verify', 'recovery', 'setup', 'confirm'];
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }

  const challengeId = getChallengeCookieId();
  if (!challengeId) {
    return NextResponse.json({ success: false, message: 'No active challenge' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine for setup
  }

  const upstream = await fetch(`${API_URL}/api/admin/auth/2fa/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'admin' },
    body: JSON.stringify({ ...body, challengeId }),
  });

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  // verify / recovery / confirm return a token → create session
  if (data.data?.token) {
    setSessionCookie(data.data.token);
    clearChallengeCookie();
  }

  return NextResponse.json(data);
}
