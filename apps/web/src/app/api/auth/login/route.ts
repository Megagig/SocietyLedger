import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
import { z } from 'zod';
import { resolveAssociation } from '@/lib/tenant';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const association = await resolveAssociation(request);
    if (!association) {
      return NextResponse.json(
        { success: false, message: 'Association not found. Use a valid subdomain.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), associationId: association.id },
      include: {
        userApproval: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberId: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if password is correct
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: 'Account is deactivated' },
        { status: 401 }
      );
    }

    // Check approval status
    if (user.userApproval && user.userApproval.approvalStatus === 'pending') {
      return NextResponse.json(
        { success: false, message: 'Account is pending approval' },
        { status: 401 }
      );
    }

    if (user.userApproval && user.userApproval.approvalStatus === 'rejected') {
      return NextResponse.json(
        { success: false, message: 'Account registration was rejected' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member?.id,
      associationId: association.id,
      platformRole: user.platformRole,
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          member: user.member,
          associationId: association.id,
          platformRole: user.platformRole,
        },
        token,
      },
      message: 'Login successful',
    });

    // Set HTTP-only cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input data', errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}