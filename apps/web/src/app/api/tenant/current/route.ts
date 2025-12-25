import { NextRequest, NextResponse } from 'next/server';
import { resolveAssociation } from '@/lib/tenant';

export async function GET(request: NextRequest) {
  try {
    const association = await resolveAssociation(request);
    if (!association) {
      return NextResponse.json(
        { success: false, message: 'Association not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: association.id,
        name: association.name,
        slug: association.slug,
        subdomain: association.subdomain,
        tier: association.tier,
        status: association.status,
        logo: association.logo ?? null,
        primaryColor: association.primaryColor ?? null,
      },
    });
  } catch (error) {
    console.error('Resolve tenant error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
