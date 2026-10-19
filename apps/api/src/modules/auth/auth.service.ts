/**
 * Authentication Service
 * Handles email verification, password reset, and approval workflows
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { hashPassword } from '../../lib/auth';
import { revokeAllForUser } from '../../services/refresh-token.service';

const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
const PASSWORD_RESET_EXPIRY_MINUTES = 60;

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure random token for password reset
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a verification code or reset token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Send verification email with 6-digit code
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  associationName?: string
): Promise<void> {
  // DEV-ONLY: print the plain code so it can be read without an inbox during
  // local docs verification walkthroughs. Never runs outside development.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
  }
  await sendEmail({
    to: email,
    subject: 'Verify Your Email - SocietyLedger',
    template: 'email-verification',
    data: {
      code,
      associationName: associationName || 'SocietyLedger',
      expiryMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
    },
  });
}

/**
 * Send password reset email with link
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  associationName?: string,
  subdomain?: string
): Promise<void> {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Build reset URL with subdomain if available
  let resetUrl: string;
  if (subdomain && process.env.NODE_ENV === 'production') {
    resetUrl = `https://${subdomain}.societyledger.com/auth/reset-password?token=${resetToken}`;
  } else if (subdomain) {
    resetUrl = `http://${subdomain}.localhost:3000/auth/reset-password?token=${resetToken}`;
  } else {
    resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;
  }

  // DEV-ONLY: print the reset URL so it can be followed without an inbox
  // during local docs verification walkthroughs. Never runs outside development.
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
  }

  await sendEmail({
    to: email,
    subject: 'Reset Your Password - SocietyLedger',
    template: 'password-reset',
    data: {
      resetUrl,
      associationName: associationName || 'SocietyLedger',
      expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
    },
  });
}

/**
 * Send approval notification email
 */
export async function sendApprovalNotificationEmail(
  email: string,
  status: 'approved' | 'rejected',
  associationName?: string,
  rejectionReason?: string,
  subdomain?: string
): Promise<void> {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  let loginUrl: string;
  if (subdomain && process.env.NODE_ENV === 'production') {
    loginUrl = `https://${subdomain}.societyledger.com/auth/login`;
  } else if (subdomain) {
    loginUrl = `http://${subdomain}.localhost:3000/auth/login`;
  } else {
    loginUrl = `${baseUrl}/auth/login`;
  }

  await sendEmail({
    to: email,
    subject: status === 'approved' 
      ? 'Your Account Has Been Approved! - SocietyLedger'
      : 'Account Registration Update - SocietyLedger',
    template: status === 'approved' ? 'account-approved' : 'account-rejected',
    data: {
      associationName: associationName || 'SocietyLedger',
      loginUrl,
      rejectionReason,
    },
  });
}

/**
 * Create user with verification code (registration flow)
 */
export async function createUserWithVerification(data: {
  email: string;
  password: string;
  associationId: number;
  role?: string;
  firstName?: string;
  lastName?: string;
}) {
  const { email, password, associationId, role = 'member', firstName, lastName } = data;

  // Generate verification code
  const verificationCode = generateVerificationCode();
  const hashedCode = hashToken(verificationCode);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with pending status
  const user = await prisma.user.create({
    data: {
      associationId,
      email: email.toLowerCase(),
      passwordHash,
      role,
      isActive: false, // Not active until approved
      emailVerified: false,
      verificationCode: hashedCode,
      verificationExpiresAt: expiresAt,
      userApproval: {
        create: {
          approvalStatus: 'pending',
        },
      },
    },
    include: {
      userApproval: true,
      association: {
        select: { name: true, subdomain: true },
      },
    },
  });

  // Return the plain code for sending via email
  return { user, verificationCode };
}

/**
 * Verify email with code
 */
export async function verifyEmailCode(userId: number, code: string): Promise<{
  success: boolean;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userApproval: true },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (user.emailVerified) {
    return { success: false, message: 'Email is already verified' };
  }

  if (!user.verificationCode || !user.verificationExpiresAt) {
    return { success: false, message: 'No verification code found. Please request a new one.' };
  }

  // Check expiry
  if (new Date() > user.verificationExpiresAt) {
    return { success: false, message: 'Verification code has expired. Please request a new one.' };
  }

  // Verify code
  const hashedInputCode = hashToken(code);
  if (hashedInputCode !== user.verificationCode) {
    return { success: false, message: 'Invalid verification code' };
  }

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
    },
  });

  return { success: true, message: 'Email verified successfully' };
}

/**
 * Resend verification code
 */
export async function resendVerificationCode(userId: number): Promise<{
  success: boolean;
  message: string;
  code?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { association: { select: { name: true } } },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (user.emailVerified) {
    return { success: false, message: 'Email is already verified' };
  }

  // Generate new code
  const verificationCode = generateVerificationCode();
  const hashedCode = hashToken(verificationCode);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      verificationCode: hashedCode,
      verificationExpiresAt: expiresAt,
    },
  });

  return { success: true, message: 'Verification code sent', code: verificationCode };
}

/**
 * Initiate password reset
 */
export async function initiatePasswordReset(
  email: string,
  associationId?: number
): Promise<{ success: boolean; token?: string }> {
  // Find user
  const whereClause: any = { email: email.toLowerCase() };
  if (associationId) {
    whereClause.associationId = associationId;
  }

  const user = await prisma.user.findFirst({
    where: whereClause,
    include: { association: { select: { name: true, subdomain: true } } },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  // Generate reset token
  const resetToken = generateResetToken();
  const hashedToken = hashToken(resetToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: expiresAt,
    },
  });

  return { success: true, token: resetToken };
}

/**
 * Reset password with token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  associationId?: number
): Promise<{ success: boolean; message: string }> {
  const hashedToken = hashToken(token);

  // Find user with valid token
  const whereClause: any = {
    passwordResetToken: hashedToken,
    passwordResetExpiresAt: { gt: new Date() },
  };
  if (associationId) {
    whereClause.associationId = associationId;
  }

  const user = await prisma.user.findFirst({ where: whereClause });

  if (!user) {
    return { success: false, message: 'Invalid or expired reset token' };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  // F0.3: a password reset invalidates every existing mobile session.
  await revokeAllForUser(user.id);

  return { success: true, message: 'Password reset successful' };
}

/**
 * Approve or reject user (admin action)
 */
export async function updateUserApproval(
  userId: number,
  status: 'approved' | 'rejected',
  approvedById: number,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userApproval: true,
      association: { select: { name: true, subdomain: true } },
    },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!user.userApproval) {
    return { success: false, message: 'User approval record not found' };
  }

  // Update approval status
  await prisma.$transaction([
    prisma.userApproval.update({
      where: { userId },
      data: {
        approvalStatus: status,
        approvedById,
        approvalDate: new Date(),
        rejectionReason: status === 'rejected' ? rejectionReason : null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        isActive: status === 'approved',
      },
    }),
  ]);

  return {
    success: true,
    message: status === 'approved' ? 'User approved successfully' : 'User rejected',
  };
}
