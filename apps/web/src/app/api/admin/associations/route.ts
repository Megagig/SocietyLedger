import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('Authorization');
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '20';

  const res = await fetch(`${API_URL}/api/admin/associations?page=${page}&limit=${limit}`, {
    headers: { ...(auth ? { Authorization: auth } : {}) },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
