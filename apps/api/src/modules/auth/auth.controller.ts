import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '../../lib/auth';
import { TenantRequest } from '../../middleware/tenant.middleware';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  memberId: z.string().optional(),
});

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId, tenant } = req as TenantRequest;
      const { email, password } = loginSchema.parse(req.body);

      // Find user by email - check both tenant-scoped and platform admins
      let user;
      
      if (tenantId) {
        // Try to find user in the specific tenant first
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

      // Check if user is active
      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Account is deactivated',
        });
        return;
      }

      // Check approval status
      if (user.userApproval && user.userApproval.approvalStatus === 'pending') {
        res.status(401).json({
          success: false,
          message: 'Account is pending approval',
        });
        return;
      }

      if (user.userApproval && user.userApproval.approvalStatus === 'rejected') {
        res.status(401).json({
          success: false,
          message: 'Account registration was rejected',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        memberId: user.member?.id,
        associationId: tenantId,
        platformRole: user.platformRole ?? undefined,
      });

      // Set HTTP-only cookie with appropriate SameSite for cross-origin
      // Note: Browsers allow secure cookies on localhost even over HTTP
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', token, {
        httpOnly: true,
        secure: true, // Required for SameSite=None (browsers allow this on localhost)
        sameSite: 'none', // Required for cross-origin cookies (localhost:3000 to localhost:4000)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: '/',
        domain: isProduction ? process.env.COOKIE_DOMAIN : undefined, // Only set domain in production
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
      const { email, password, memberId } = registerSchema.parse(req.body);

      if (!tenantId) {
        res.status(400).json({
          success: false,
          message: 'Missing tenant context. Provide association subdomain or x-tenant header.',
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
          message: 'User with this email already exists',
        });
        return;
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user with approval pending
      const user = await prisma.user.create({
        data: {
          associationId: tenantId,
          email: email.toLowerCase(),
          passwordHash,
          role: 'member',
          isActive: true,
          userApproval: {
            create: {
              approvalStatus: 'pending',
            },
          },
        },
        include: {
          userApproval: true,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            approvalStatus: user.userApproval?.approvalStatus,
            association: tenant,
          },
        },
        message: 'Registration successful. Please wait for admin approval.',
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

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('token', {
        httpOnly: true,
        secure: true, // Must match the cookie settings (browsers allow this on localhost)
        sameSite: 'none', // Must match the cookie settings used when setting
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
      const authReq = req as TenantRequest & { user?: { userId?: number } };
      const userId = authReq.user?.userId;
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
          associationId: true,
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
