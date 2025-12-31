import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AssociationStatus, AssociationTier, BillingCycle, SubscriptionStatus } from '@prisma/client';

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  tier: z.nativeEnum(AssociationTier).default(AssociationTier.STARTER),
  logo: z.string().url().optional(),
  primaryColor: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  logo: z.string().url().optional(),
  primaryColor: z.string().optional(),
  status: z.nativeEnum(AssociationStatus).optional(),
  tier: z.nativeEnum(AssociationTier).optional(),
});

const signupSchema = z.object({
  association: z.object({
    name: z.string().min(2),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
    tier: z.nativeEnum(AssociationTier).default(AssociationTier.STARTER),
    primaryColor: z.string().optional(),
    logo: z.string().url().optional(),
  }),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
  planCode: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
});

export class AssociationsController {
  async create(req: Request, res: Response) {
    try {
      const input = createSchema.parse(req.body);

      const existing = await prisma.association.findFirst({
        where: {
          OR: [{ slug: input.slug }, { subdomain: input.subdomain }],
        },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Slug or subdomain already exists' });
      }

      const association = await prisma.association.create({
        data: {
          name: input.name,
          slug: input.slug.toLowerCase(),
          subdomain: input.subdomain.toLowerCase(),
          tier: input.tier,
          status: AssociationStatus.ACTIVE,
          logo: input.logo,
          primaryColor: input.primaryColor,
        },
      });

      return res.status(201).json({ success: true, data: association });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Association create error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const association = await prisma.association.findUnique({ where: { id } });
      if (!association) return res.status(404).json({ success: false, message: 'Association not found' });
      return res.json({ success: true, data: association });
    } catch (error) {
      console.error('Association get error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const input = updateSchema.parse(req.body);
      const association = await prisma.association.update({ where: { id }, data: input });
      return res.json({ success: true, data: association });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Association update error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async softDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const association = await prisma.association.update({
        where: { id },
        data: { status: AssociationStatus.CANCELLED },
      });
      return res.json({ success: true, data: association });
    } catch (error) {
      console.error('Association delete error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async checkSubdomain(req: Request, res: Response) {
    try {
      const subdomain = String(req.query.subdomain || '').toLowerCase();
      if (!subdomain) return res.status(400).json({ success: false, message: 'subdomain is required' });

      const association = await prisma.association.findUnique({ 
        where: { subdomain },
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
          tier: true,
          status: true,
          logo: true,
          primaryColor: true,
        }
      });
      
      if (!association) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }
      
      // Check if association is active
      if (association.status === AssociationStatus.CANCELLED) {
        return res.status(403).json({ success: false, message: 'Association is inactive' });
      }
      
      return res.json({ success: true, data: association });
    } catch (error) {
      console.error('Check subdomain error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async signup(req: Request, res: Response) {
    try {
      const input = signupSchema.parse(req.body);

      const conflict = await prisma.association.findFirst({
        where: {
          OR: [{ slug: input.association.slug }, { subdomain: input.association.subdomain }],
        },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Slug or subdomain already exists' });
      }

      const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
      if (!plan) return res.status(400).json({ success: false, message: 'Invalid plan' });

      // Import auth service for verification
      const { generateVerificationCode, hashToken, sendVerificationEmail } = await import('../auth/auth.service');
      
      // Generate verification code
      const verificationCode = generateVerificationCode();
      const hashedCode = hashToken(verificationCode);
      const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const result = await prisma.$transaction(async (tx) => {
        const assoc = await tx.association.create({
          data: {
            name: input.association.name,
            slug: input.association.slug.toLowerCase(),
            subdomain: input.association.subdomain.toLowerCase(),
            tier: input.association.tier,
            status: AssociationStatus.ACTIVE,
            logo: input.association.logo,
            primaryColor: input.association.primaryColor,
          },
        });

        await tx.subscription.create({
          data: {
            associationId: assoc.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            billingCycle: BillingCycle.MONTHLY,
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        // Create default RBAC roles for the association
        const adminRole = await tx.role.create({
          data: {
            name: 'admin',
            displayName: 'Administrator',
            description: 'Full administrative access',
            associationId: assoc.id,
            isSystemRole: true,
          },
        });

        await tx.role.createMany({
          data: [
            {
              name: 'treasurer',
              displayName: 'Treasurer',
              description: 'Financial management',
              associationId: assoc.id,
              isSystemRole: true,
            },
            {
              name: 'secretary',
              displayName: 'Secretary',
              description: 'Record keeping and communications',
              associationId: assoc.id,
              isSystemRole: true,
            },
            {
              name: 'member',
              displayName: 'Member',
              description: 'Basic member access',
              associationId: assoc.id,
              isSystemRole: true,
            },
          ],
        });

        const passwordHash = await (await import('bcryptjs')).default.hash(input.admin.password, 12);
        const user = await tx.user.create({
          data: {
            associationId: assoc.id,
            email: input.admin.email.toLowerCase(),
            passwordHash,
            role: 'admin',
            isActive: false, // Not active until email verified and super admin approves
            emailVerified: false, // Requires email verification
            verificationCode: hashedCode,
            verificationExpiresAt,
            userApproval: { create: { approvalStatus: 'pending' } }, // Pending super admin approval
          },
        });

        // Assign Admin role to the creator
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: adminRole.id,
            associationId: assoc.id,
            assignedBy: user.id, // Self-assigned
          },
        });

        return { assoc, user };
      });

      // Send verification email
      try {
        console.log('📧 Attempting to send verification email to:', input.admin.email);
        console.log('📧 Verification code:', verificationCode);
        await sendVerificationEmail(
          input.admin.email,
          verificationCode,
          input.association.name
        );
        console.log('✅ Verification email sent successfully');
      } catch (emailError: any) {
        console.error('❌ Failed to send verification email:', emailError?.message || emailError);
        console.error('Full error:', emailError);
        // Don't fail the signup if email fails
      }

      return res.status(201).json({ 
        success: true, 
        data: {
          association: {
            id: result.assoc.id,
            name: result.assoc.name,
            subdomain: result.assoc.subdomain,
          },
          user: {
            id: result.user.id,
            email: result.user.email,
            emailVerified: result.user.emailVerified,
          },
        },
        message: 'Association created. Please check your email for a verification code.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('Association signup error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async getSettings(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const settings = await prisma.settings.findMany({ where: { associationId: id } });
      const association = await prisma.association.findUnique({
        where: { id },
        select: { logo: true, primaryColor: true, name: true },
      });
      return res.json({ success: true, data: { settings, branding: association } });
    } catch (error) {
      console.error('Get settings error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { logo, primaryColor, settings } = req.body as {
        logo?: string;
        primaryColor?: string;
        settings?: { key: string; value: string }[];
      };

      // Update association branding
      if (logo !== undefined || primaryColor !== undefined) {
        await prisma.association.update({
          where: { id },
          data: { logo, primaryColor },
        });
      }

      // Upsert individual settings
      if (settings && Array.isArray(settings)) {
        for (const s of settings) {
          await prisma.settings.upsert({
            where: { associationId_key: { associationId: id, key: s.key } },
            update: { value: s.value, updatedBy: (req as any).user?.id ?? 0 },
            create: { associationId: id, key: s.key, value: s.value, updatedBy: (req as any).user?.id ?? 0 },
          });
        }
      }

      return res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
      console.error('Update settings error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
