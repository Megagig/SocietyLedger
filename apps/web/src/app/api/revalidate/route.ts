import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { PRICING_TAG } from '@/lib/pricing';

/**
 * Called by the API the moment the platform owner publishes a plan or add-on change, so the landing page, homepage and pricing page
 * show it immediately instead of at their next timed refresh. Protected by a shared secret; without one configured it refuses everything.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get('x-revalidate-secret') ?? '';
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ success: false, message: 'Not allowed' }, { status: 401 });
  }

  revalidateTag(PRICING_TAG);
  revalidatePath('/');
  revalidatePath('/pricing');
  return NextResponse.json({ success: true, revalidated: true });
}
