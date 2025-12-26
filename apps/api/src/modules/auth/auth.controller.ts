import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '../../lib/auth';
import { TenantRequest } from '../../middleware/tenant.middleware';
import {
  createUserWithVerification,
  verifyEmailCode,
  resendVerificationCode,
  sendVerificationEmail,
  initiatePasswordReset,
  sendPasswordResetEmail,
  resetPassword,
} from './auth.service';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const resendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;
      const { email, password } = loginSchema.parse(req.body);

      // Find user by email - check both tenant-scoped and platform admins
      let user;
      
      if (tenantId) {
        user = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), associationId: tenantId },
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
      }
      
      // If no user found in tenant, check for platform admin (SUPER_ADMIN)
      if (!user) {
        user = await prisma.user.findFirst({
          where: { 
            email: email.toLowerCase(), 
            platformRole: 'SUPER_ADMIN',
            associationId: null,
          },
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
      }

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
        return;
      }

      // Check password
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
        return;
      }

      // Check email verification (skip for super admins)
      if (!user.platformRole && !user.emailVerified) {
        res.status(401).json({
          success: false,
          message: 'Please verify your email before logging in',
          code: 'EMAIL_NOT_VERIFIED',
        });
        return;
      }

      // Check approval status (skip for super admins)
      if (!user.platformRole && user.userApproval) {
        if (user.userApproval.approvalStatus === 'pending') {
          res.status(401).json({
            success: false,
            message: 'Your account is pending admin approval',
            code: 'PENDING_APPROVAL',
          });
          return;
        }

        if (user.userApproval.approvalStatus === 'rejected') {
          res.status(401).json({
            success: false,
            message: 'Your account registration was rejected',
            code: 'ACCOUNT_REJECTED',
          });
          return;
        }
      }

      // Check if user is active
      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Your account has been suspended',
          code: 'ACCOUNT_SUSPENDED',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
        memberId: user.member?.id,
        associationId: tenantId,
        platformRole: user.platformRole ?? undefined,
      });

      // Set HTTP-only cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
        domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
      });

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            member: user.member,
            association: tenant,
            platformRole: user.platformRole,
          },
          token,
        },
        message: 'Login successful',
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;
      const { email, password, firstName, lastName } = registerSchema.parse(req.body);

      if (!tenantId) {
        res.status(400).json({
          success: false,
          message: 'Missing tenant context. Please access via your association subdomain.',
        });
        return;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), associationId: tenantId },
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'An account with this email already exists',
        });
        return;
      }

      // Create user with verification code
      const { user, verificationCode } = await createUserWithVerification({
        email,
        password,
        associationId: tenantId,
        firstName,
        lastName,
      });

      // Send verification email
      try {
        await sendVerificationEmail(email, verificationCode, tenant?.name);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            approvalStatus: user.userApproval?.approvalStatus,
          },
        },
        message: 'Registration successful. Please check your email for a verification code.',
      });
    } catch (error) {
      console.error('Register error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Registration failed',
      });
    }
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req as TenantRequest;
      const { email, code } = verifyEmailSchema.parse(req.body);

      // Find user
      const user = await prisma.user.findFirst({
        where: { 
          email: email.toLowerCase(),
          ...(tenantId ? { associationId: tenantId } : {}),
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const result = await verifyEmailCode(user.id, code);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Email verified successfully. Your account is pending admin approval.',
      });
    } catch (error) {
      console.error('Verify email error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Email verification failed',
      });
    }
  }

  async resendVerificationCode(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;
      const { email } = resendCodeSchema.parse(req.body);

      // Find user
      const user = await prisma.user.findFirst({
        where: { 
          email: email.toLowerCase(),
          ...(tenantId ? { associationId: tenantId } : {}),
        },
      });

      if (!user) {
        // Don't reveal if user exists
        res.status(200).json({
          success: true,
          message: 'If an account exists, a new verification code has been sent.',
        });
        return;
      }

      if (user.emailVerified) {
        res.status(400).json({
          success: false,
          message: 'Email is already verified',
        });
        return;
      }

      const result = await resendVerificationCode(user.id);

      if (result.success && result.code) {
        try {
          await sendVerificationEmail(email, result.code, tenant?.name);
        } catch (emailError) {
          console.error('Failed to send verification email:', emailError);
        }
      }

      res.status(200).json({
        success: true,
        message: 'If an account exists, a new verification code has been sent.',
      });
    } catch (error) {
      console.error('Resend code error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to resend verification code',
      });
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;
      const { email } = forgotPasswordSchema.parse(req.body);

      const result = await initiatePasswordReset(email, tenantId);

      // Send email if token was generated (user exists)
      if (result.token) {
        try {
          await sendPasswordResetEmail(
            email,
            result.token,
            tenant?.name,
            tenant?.subdomain
          );
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
        }
      }

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request',
      });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req as TenantRequest;
      const { token, password } = resetPasswordSchema.parse(req.body);

      const result = await resetPassword(token, password, tenantId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Password reset failed',
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
      });
      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
      });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as TenantRequest & { user?: { id?: number } };
      const userId = authReq.user?.id;
      const tenantId = authReq.tenantId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
        return;
      }

      const user = await prisma.user.findFirst({
        where: { id: userId, associationId: tenantId ?? undefined },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          associationId: true,
          platformRole: true,
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              memberId: true,
              email: true,
              phone: true,
            },
          },
          userApproval: {
            select: {
              approvalStatus: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user information',
      });
    }
  }
}
