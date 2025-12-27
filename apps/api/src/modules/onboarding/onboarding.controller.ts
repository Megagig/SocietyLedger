import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';

const completeStepSchema = z.object({
  step: z.number().min(1).max(5),
  stepName: z.enum(['profile', 'team', 'members', 'finance', 'complete']),
});

export class OnboardingController {
  /**
   * Get onboarding status for the current association
   */
  async getStatus(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      // Use upsert to avoid race condition with unique constraint
      const onboarding = await prisma.onboardingProgress.upsert({
        where: { associationId },
        create: {
          associationId,
          currentStep: 1,
          completedSteps: [],
        },
        update: {}, // No update needed, just return existing
      });

      // Get association details for context
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: {
          id: true,
          name: true,
          logo: true,
          primaryColor: true,
          _count: {
            select: {
              users: true,
              members: true,
            },
          },
        },
      });

      // Check financial categories
      const hasFinancialCategories = await prisma.financialCategory.count({
        where: { associationId },
      });

      return res.json({
        success: true,
        data: {
          onboarding,
          association,
          context: {
            hasLogo: !!association?.logo,
            hasTeamMembers: (association?._count.users || 0) > 1,
            hasMembers: (association?._count.members || 0) > 0,
            hasFinancialSetup: hasFinancialCategories > 0,
          },
        },
      });
    } catch (error) {
      console.error('Get onboarding status error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Complete an onboarding step
   */
  async completeStep(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const { step, stepName } = completeStepSchema.parse(req.body);

      // Use upsert to avoid race condition with unique constraint
      let onboarding = await prisma.onboardingProgress.upsert({
        where: { associationId },
        create: {
          associationId,
          currentStep: 1,
          completedSteps: [],
        },
        update: {}, // No update needed for initial fetch
      });

      // Update completed steps
      const completedSteps = onboarding.completedSteps as number[];
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }

      // Determine step-specific flags
      const updateData: any = {
        completedSteps,
        currentStep: Math.max(onboarding.currentStep, step + 1),
      };

      switch (stepName) {
        case 'profile':
          updateData.profileCompleted = true;
          break;
        case 'team':
          updateData.teamInvited = true;
          break;
        case 'members':
          updateData.membersImported = true;
          break;
        case 'finance':
          updateData.financeConfigured = true;
          break;
        case 'complete':
          updateData.onboardingComplete = true;
          updateData.completedAt = new Date();
          break;
      }

      const updated = await prisma.onboardingProgress.update({
        where: { associationId },
        data: updateData,
      });

      // Log the action
      if (userId) {
        await prisma.auditLog.create({
          data: {
            associationId,
            userId,
            action: 'ONBOARDING_STEP_COMPLETED',
            tableName: 'onboarding_progress',
            recordId: updated.id,
            newValues: { step, stepName },
          },
        });
      }

      return res.json({
        success: true,
        message: `Step ${step} (${stepName}) completed`,
        data: updated,
      });
    } catch (error) {
      console.error('Complete step error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Skip onboarding
   */
  async skip(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const updated = await prisma.onboardingProgress.upsert({
        where: { associationId },
        create: {
          associationId,
          currentStep: 5,
          completedSteps: [],
          skippedAt: new Date(),
          onboardingComplete: true,
        },
        update: {
          skippedAt: new Date(),
          onboardingComplete: true,
        },
      });

      // Log the action
      if (userId) {
        await prisma.auditLog.create({
          data: {
            associationId,
            userId,
            action: 'ONBOARDING_SKIPPED',
            tableName: 'onboarding_progress',
            recordId: updated.id,
            newValues: { skippedAt: updated.skippedAt },
          },
        });
      }

      return res.json({
        success: true,
        message: 'Onboarding skipped',
        data: updated,
      });
    } catch (error) {
      console.error('Skip onboarding error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Reset onboarding (for testing or re-onboarding)
   */
  async reset(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const updated = await prisma.onboardingProgress.upsert({
        where: { associationId },
        create: {
          associationId,
          currentStep: 1,
          completedSteps: [],
        },
        update: {
          currentStep: 1,
          completedSteps: [],
          profileCompleted: false,
          teamInvited: false,
          membersImported: false,
          financeConfigured: false,
          onboardingComplete: false,
          skippedAt: null,
          completedAt: null,
        },
      });

      // Log the action
      if (userId) {
        await prisma.auditLog.create({
          data: {
            associationId,
            userId,
            action: 'ONBOARDING_RESET',
            tableName: 'onboarding_progress',
            recordId: updated.id,
            newValues: { reset: true },
          },
        });
      }

      return res.json({
        success: true,
        message: 'Onboarding reset',
        data: updated,
      });
    } catch (error) {
      console.error('Reset onboarding error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
