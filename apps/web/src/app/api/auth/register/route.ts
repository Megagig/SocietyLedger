import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';
import { resolveAssociation } from '@/lib/tenant';

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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
    const { email, password, firstName, lastName } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), associationId: association.id },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate unique member ID
    const memberCount = await prisma.member.count({ where: { associationId: association.id } });
    const memberId = `MEM${String(memberCount + 1).padStart(4, '0')}`;

    // Create user and member in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          associationId: association.id,
          email: email.toLowerCase(),
          passwordHash,
          role: 'member',
          isActive: false, // Will be activated after approval
        },
      });

      // Create member profile
      const member = await tx.member.create({
        data: {
          associationId: association.id,
          userId: user.id,
          memberId,
          firstName,
          lastName,
          email: email.toLowerCase(),
          status: 'inactive', // Will be activated after approval
          category: 'regular',
          joinDate: new Date(),
        },
      });

      // Create user approval record
      const userApproval = await tx.userApproval.create({
        data: {
          userId: user.id,
          approvalStatus: 'pending',
        },
      });

      return { user, member, userApproval };
    });

    // TODO: Send email notification to admins about new registration
    // This will be implemented when we add the email service

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.id,
        memberId: result.member.memberId,
        approvalStatus: 'pending',
      },
      message: 'Registration successful. Please wait for admin approval.',
    });
  } catch (error) {
    console.error('Registration error:', error);

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