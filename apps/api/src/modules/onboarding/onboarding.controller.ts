import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ANY_ONBOARDING_STEP_KEYS, onboardingFlowFor, onboardingStepsFor, onboardingTeamInviteSchema, teamRolesAllowedFor } from '@societyledger/shared';
import { applyStep, readProgress } from './onboarding-rules';
import { createMemberInvite, sendMemberInviteEmail } from '../member-invites/member-invites.service';
import { SettingsService } from '../settings/settings.service';
import { assertMemberCapacity, MemberLimitError } from '../../middleware/subscription.middleware';

const completeStepSchema = z.object({
  step: z.number().int().min(1).max(5),
  stepName: z.enum(ANY_ONBOARDING_STEP_KEYS),
  // true when the admin chose to skip the step instead of finishing it
  skipped: z.boolean().optional().default(false),
});

/** The tenant's kind decides which setup flow it walks through. */
async function kindOf(associationId: number): Promise<string> {
  return (await prisma.association.findUnique({ where: { id: associationId }, select: { kind: true } }))?.kind ?? 'ASSOCIATION';
}

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

      const kind = await kindOf(associationId);

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

      // Check financial categories and the bank account members pay into
      const [hasFinancialCategories, bankAccounts] = await Promise.all([
        prisma.financialCategory.count({ where: { associationId } }),
        prisma.associationBankAccount.count({ where: { associationId } }),
      ]);

      return res.json({
        success: true,
        data: {
          onboarding,
          association,
          /** Which setup this account walks through, and its steps. */
          flow: onboardingFlowFor(kind),
          steps: onboardingStepsFor(kind),
          context: {
            hasLogo: !!association?.logo,
            hasTeamMembers: (association?._count.users || 0) > 1,
            hasMembers: (association?._count.members || 0) > 0,
            hasFinancialSetup: hasFinancialCategories > 0,
            hasBankAccount: bankAccounts > 0,
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

      const { step, stepName, skipped } = completeStepSchema.parse(req.body);
      const kind = await kindOf(associationId);

      // Use upsert to avoid race condition with unique constraint
      const onboarding = await prisma.onboardingProgress.upsert({
        where: { associationId },
        create: {
          associationId,
          currentStep: 1,
          completedSteps: [],
        },
        update: {}, // No update needed for initial fetch
      });

      let move;
      try {
        move = applyStep(readProgress(onboarding), step, stepName, skipped, kind);
      } catch (mismatch) {
        return res.status(400).json({ success: false, message: mismatch instanceof Error ? mismatch.message : 'Invalid step' });
      }

      const updateData: Record<string, unknown> = {
        completedSteps: move.completedSteps,
        skippedSteps: move.skippedSteps,
        currentStep: move.currentStep,
      };
      if (move.flag) updateData[move.flag] = true;
      if (move.complete) {
        updateData.onboardingComplete = true;
        updateData.completedAt = new Date();
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
            action: skipped ? 'ONBOARDING_STEP_SKIPPED' : 'ONBOARDING_STEP_COMPLETED',
            tableName: 'onboarding_progress',
            recordId: updated.id,
            newValues: { step, stepName, skipped },
          },
        });
      }

      return res.json({
        success: true,
        message: skipped ? `Step ${step} (${stepName}) skipped` : `Step ${step} (${stepName}) completed`,
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
   * Invite the officers who will help run the association (setup wizard, team step). Each person becomes a member, gets an emailed invite,
   * and receives the chosen role when they accept. Someone already on the list is reported back, not invited twice.
   */
  async inviteTeam(req: AuthRequest, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const { invites } = onboardingTeamInviteSchema.parse(req.body);
      // Each kind of account can only invite with its own roles (a thrift group cannot hand out Treasurer, an association cannot hand out Collector).
      const allowedRoles = teamRolesAllowedFor(await kindOf(associationId));
      const notAllowed = invites.find((i) => !allowedRoles.includes(i.role));
      if (notAllowed) return res.status(400).json({ success: false, message: `That role is not available here: ${notAllowed.role}.` });
      const results: Array<{ email: string; status: 'invited' | 'invited_email_failed' | 'already_member' | 'failed'; message?: string }> = [];

      const prefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';
      let count = await prisma.member.count({ where: { associationId } });

      for (const person of invites) {
        try {
          const existing = await prisma.member.findFirst({ where: { associationId, email: { equals: person.email, mode: 'insensitive' } } });
          if (existing) {
            results.push({ email: person.email, status: 'already_member', message: 'Someone with this email is already a member. Invite them from Members instead.' });
            continue;
          }

          try {
            await assertMemberCapacity(associationId);
          } catch (limitError) {
            if (!(limitError instanceof MemberLimitError)) throw limitError;
            results.push({ email: person.email, status: 'failed', message: limitError.message });
            continue;
          }

          // Next free member number: the count can lag behind when members were deleted.
          let memberId: string;
          do {
            count += 1;
            memberId = `${prefix}${String(count).padStart(4, '0')}`;
          } while (await prisma.member.findFirst({ where: { associationId, memberId }, select: { id: true } }));

          const member = await prisma.member.create({
            data: {
              associationId,
              memberId,
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.email,
              status: 'active',
              joinDate: new Date(),
            },
          });

          const { invite, token } = await createMemberInvite({
            memberId: member.id,
            associationId,
            invitedById: userId,
            email: person.email,
            roleName: person.role,
          });

          let emailSent = false;
          try {
            await sendMemberInviteEmail(
              person.email,
              token,
              `${person.firstName} ${person.lastName}`,
              invite.association.name,
              invite.association.subdomain,
              invite.inviteTokenExpiresAt,
            );
            emailSent = true;
          } catch (emailError) {
            console.error('Failed to send team invite email:', emailError);
          }
          results.push({ email: person.email, status: emailSent ? 'invited' : 'invited_email_failed' });
        } catch (personError) {
          console.error('Team invite failed for one person:', personError);
          results.push({ email: person.email, status: 'failed', message: 'This invite could not be created. Please try again.' });
        }
      }

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'ONBOARDING_TEAM_INVITED',
          tableName: 'member_invites',
          newValues: { invited: results.filter((r) => r.status === 'invited' || r.status === 'invited_email_failed').length, total: invites.length },
        },
      });

      return res.status(201).json({ success: true, data: { results } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0]?.message ?? 'Validation error', errors: error.errors });
      }
      console.error('Invite team error:', error);
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
          skippedSteps: [],
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
