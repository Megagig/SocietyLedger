import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AssociationStatus, AssociationTier, BillingCycle, SubscriptionStatus } from '@prisma/client';
import { ROLE_PERMISSION_MAPPING } from '../../lib/role-permission-mapping';
import { RESERVED_SUBDOMAINS, ASSOCIATION_TYPE_OTHER, associationSignupSchema } from '@societyledger/shared';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { startTrialIfPending } from '../../services/subscription-access.service';
import { SettingsService } from '../settings/settings.service';

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

      if (RESERVED_SUBDOMAINS.includes(subdomain as string)) {
        return res.status(409).json({ success: false, message: 'Subdomain is reserved', code: 'SUBDOMAIN_RESERVED' });
      }

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
      const parsed = associationSignupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.errors[0]?.message ?? 'Invalid data', errors: parsed.error.errors });
      }
      const input = parsed.data;
      const subdomain = input.association.subdomain;

      if (RESERVED_SUBDOMAINS.includes(subdomain)) {
        return res.status(409).json({ success: false, message: 'Subdomain is reserved', code: 'SUBDOMAIN_RESERVED' });
      }

      const platform = await PlatformSettingsService.getSettings();
      if (platform.allowNewSignups === false) {
        return res.status(403).json({
          success: false,
          message: 'New associations cannot sign up right now. Please try again later.',
          code: 'SIGNUPS_CLOSED',
        });
      }
      const needsVerification = platform.requireEmailVerification !== false;
      const needsApproval = platform.requireAdminApproval !== false;

      const conflict = await prisma.association.findFirst({
        where: { OR: [{ slug: subdomain }, { subdomain }] },
      });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Slug or subdomain already exists', code: 'SUBDOMAIN_TAKEN' });
      }

      // Every new association starts its free trial on the Enterprise plan.
      const plan = await prisma.plan.findUnique({ where: { code: 'enterprise' } });
      if (!plan) {
        console.error('❌ Plan not found: enterprise - Database may need seeding. Run: npx prisma db seed');
        return res.status(500).json({
          success: false,
          message: 'System configuration error. Please contact support.',
          error: 'PLAN_NOT_FOUND'
        });
      }

      // Import auth service for verification
      const { generateVerificationCode, hashToken, sendVerificationEmail } = await import('../auth/auth.service');

      // G66: reuse the shared mapping (rbac-seed.ts's own source of truth) instead of
      // an independent copy — that copy had drifted, missing an entire financial_secretary
      // role and roughly a dozen permissions per role real re-seeded associations already had.
      const rolePermissionMap: Record<string, string[]> = ROLE_PERMISSION_MAPPING;

      // Get all unique permission keys
      const allPermissionKeys = [...new Set(Object.values(rolePermissionMap).flat())];

      // Fetch all permissions at once (outside transaction)
      const allPermissions = await prisma.permission.findMany({
        where: { key: { in: allPermissionKeys } }
      });

      if (allPermissions.length === 0) {
        console.error('❌ No permissions found in database - Database may need seeding. Run: npx prisma db seed');
        return res.status(500).json({
          success: false,
          message: 'System configuration error. Please contact support.',
          error: 'PERMISSIONS_NOT_SEEDED'
        });
      }

      // Create permission lookup map
      const permissionMap = new Map(allPermissions.map(p => [p.key, p.id]));

      // Hash password outside transaction
      const bcrypt = (await import('bcryptjs')).default;
      const passwordHash = await bcrypt.hash(input.admin.password, 12);

      // Generate verification code
      const verificationCode = generateVerificationCode();
      const hashedCode = hashToken(verificationCode);
      const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const now = new Date();

      // Run transaction with extended timeout (30 seconds)
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create association
        const assoc = await tx.association.create({
          data: {
            name: input.association.name,
            slug: subdomain,
            subdomain,
            tier: AssociationTier.ENTERPRISE,
            status: AssociationStatus.ACTIVE,
          },
        });

        // 2. Create the trial subscription. It carries no end date yet: the clock starts when the SaaS owner approves the
        // founding admin (startTrialIfPending), so a slow approval or a lost email never uses up the trial.
        await tx.subscription.create({
          data: {
            associationId: assoc.id,
            planId: plan.id,
            status: SubscriptionStatus.TRIALING,
            billingCycle: BillingCycle.MONTHLY,
            trialEndsAt: null,
            currentPeriodStart: now,
            currentPeriodEnd: now,
            renewalDate: null,
          },
        });

        // 3. Create all roles at once
        const rolesToCreate = [
          { name: 'admin', displayName: 'Administrator', description: 'Full administrative access' },
          { name: 'treasurer', displayName: 'Treasurer', description: 'Financial management' },
          { name: 'financial_secretary', displayName: 'Financial Secretary', description: 'Financial record keeping' },
          { name: 'member', displayName: 'Member', description: 'Basic member access' },
          { name: 'election_committee', displayName: 'Election Committee', description: 'People chosen to conduct elections, separate from the officers' },
        ];

        const createdRoles: { id: number; name: string }[] = [];
        for (const roleData of rolesToCreate) {
          const role = await tx.role.create({
            data: {
              name: roleData.name,
              displayName: roleData.displayName,
              description: roleData.description,
              associationId: assoc.id,
              isSystemRole: true,
            },
          });
          createdRoles.push({ id: role.id, name: role.name });
        }

        // 4. Batch create all role permissions using createMany
        const rolePermissionsToCreate: { roleId: number; permissionId: number }[] = [];
        for (const role of createdRoles) {
          const permissionKeys = rolePermissionMap[role.name] || [];
          for (const key of permissionKeys) {
            const permissionId = permissionMap.get(key);
            if (permissionId) {
              rolePermissionsToCreate.push({ roleId: role.id, permissionId });
            }
          }
        }

        if (rolePermissionsToCreate.length > 0) {
          await tx.rolePermission.createMany({
            data: rolePermissionsToCreate,
            skipDuplicates: true,
          });
        }

        // 5. Create user
        const user = await tx.user.create({
          data: {
            associationId: assoc.id,
            email: input.admin.email,
            passwordHash,
            role: 'admin',
            isActive: !needsApproval,
            emailVerified: !needsVerification,
            verificationCode: needsVerification ? hashedCode : null,
            verificationExpiresAt: needsVerification ? verificationExpiresAt : null,
            userApproval: { create: { approvalStatus: needsApproval ? 'pending' : 'approved' } },
          },
        });

        // 5b. The founder is also the association's first member, so their name shows up across the app.
        await tx.member.create({
          data: {
            associationId: assoc.id,
            userId: user.id,
            memberId: 'MEM0001',
            firstName: input.admin.firstName,
            lastName: input.admin.lastName,
            email: input.admin.email,
            phone: input.admin.phone,
            status: 'active',
            loginStatus: 'active',
            joinDate: now,
          },
        });

        // 6. Assign Admin role to the creator
        const adminRole = createdRoles.find(r => r.name === 'admin');
        if (adminRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: adminRole.id,
              associationId: assoc.id,
              assignedBy: user.id,
            },
          });
        }

        return { assoc, user };
      }, {
        maxWait: 10000, // 10 seconds max wait to acquire connection
        timeout: 30000, // 30 seconds transaction timeout
      });

      // The kind of association lives with the rest of the association settings (the same value Settings > Association edits).
      try {
        await SettingsService.updateSettings(
          result.assoc.id,
          'association',
          {
            associationType: input.association.type,
            customAssociationType: input.association.type === ASSOCIATION_TYPE_OTHER ? input.association.customType : null,
          },
          result.user.id,
        );
      } catch (settingsError) {
        // The association itself is created; they can set the type later in Settings.
        console.error('Could not save the association type at signup:', settingsError);
      }

      // With approval switched off in the platform settings, there is nobody to wait for: start the trial now.
      if (!needsApproval) await startTrialIfPending(result.assoc.id);

      // Send verification email (outside transaction)
      let verificationEmailSent = false;
      if (needsVerification) {
        try {
          await sendVerificationEmail(input.admin.email, verificationCode, input.association.name);
          verificationEmailSent = true;
        } catch (emailError: any) {
          // Don't fail the signup if email fails: they can ask for another code, and the platform owner can verify them by hand.
          console.error('❌ Failed to send verification email:', emailError?.message || emailError);
        }
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
          requiresVerification: needsVerification,
          pendingApproval: needsApproval,
          verificationEmailSent,
        },
        message: needsVerification
          ? 'Association created. Please check your email for a verification code.'
          : 'Association created.',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Invalid data', errors: error.errors });
      }
      console.error('❌ Association signup error:', error?.message || error);
      console.error('Full error stack:', error?.stack);

      // Provide more specific error messages for common issues
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Unique constraint') || errorMessage.includes('unique')) {
        return res.status(409).json({ success: false, message: 'An association with this subdomain or slug already exists', code: 'SUBDOMAIN_TAKEN' });
      }
      if (errorMessage.includes('Foreign key constraint')) {
        return res.status(500).json({ success: false, message: 'System configuration error. Please contact support.' });
      }

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
