/**
 * The messages an association gets about its subscription: onboarding, reminders before it ends, expiry, payments that need attention,
 * a successful resubscription, plan changes. Each goes to every administrator of the association, in the app and by email.
 *
 * A failed notification must never undo or block the billing change that caused it, so everything here logs and moves on.
 */
import prisma from '../../lib/prisma';
import { sendEmail } from '../../lib/email';
import { tenantBaseUrl } from '../../lib/tenant-url';
import { dispatchNotification } from '../notification-preferences.service';

export type BillingEvent =
  | { type: 'ONBOARDING_STARTED'; associationId: number; endsAt: Date; policy: 'TRIAL' | 'COMPLIMENTARY' | 'BILLABLE'; planName: string }
  | { type: 'EXPIRY_REMINDER'; associationId: number; daysLeft: number; endsAt: Date }
  | { type: 'SUBSCRIPTION_EXPIRED'; associationId: number; graceEndsAt?: Date }
  | { type: 'SUBSCRIPTION_ACTIVATED'; associationId: number; periodEnd?: Date }
  | { type: 'ADDON_ACTIVATED'; associationId: number; periodEnd?: Date }
  | { type: 'PAYMENT_PENDING'; associationId: number }
  | { type: 'PAYMENT_FAILED'; associationId: number }
  | { type: 'PAYMENT_NEEDS_REVIEW'; associationId: number }
  | { type: 'PLAN_CHANGED'; associationId: number; planName: string; direction: 'upgrade' | 'downgrade' | 'scheduled'; effectiveAt?: Date }
  | { type: 'PLAN_TERMS_CHANGED'; associationId: number; planName: string; effectiveAt: Date };

interface Message {
  title: string;
  body: string;
  heading: string;
  paragraphs: string[];
  facts?: { label: string; value: string }[];
  cta: 'plans' | 'subscription';
  ctaLabel: string;
}

const dateText = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

function compose(event: BillingEvent): Message {
  switch (event.type) {
    case 'ONBOARDING_STARTED': {
      if (event.policy === 'BILLABLE') {
        return {
          title: 'Choose a plan to get started',
          body: 'Your association is approved. Choose a plan to start using SocietyLedger.',
          heading: 'Choose your plan',
          paragraphs: ['Your association has been approved. To start using SocietyLedger, choose a plan and pay for your first period.'],
          cta: 'plans',
          ctaLabel: 'Choose a plan',
        };
      }
      const free = event.policy === 'COMPLIMENTARY' ? 'complimentary access' : 'a free trial';
      return {
        title: `Your ${event.planName} ${event.policy === 'COMPLIMENTARY' ? 'access' : 'trial'} has started`,
        body: `You have ${free} of the ${event.planName} plan until ${dateText(event.endsAt)}.`,
        heading: `Welcome to SocietyLedger`,
        paragraphs: [
          `Your association has ${free} of the ${event.planName} plan, with everything that plan includes.`,
          'When it ends, access pauses until you choose a plan and pay. Your records are never deleted.',
        ],
        facts: [
          { label: 'Plan', value: event.planName },
          { label: 'Ends on', value: dateText(event.endsAt) },
        ],
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
    }
    case 'EXPIRY_REMINDER':
      return {
        title: `Your subscription ends in ${event.daysLeft} ${event.daysLeft === 1 ? 'day' : 'days'}`,
        body: `Renew before ${dateText(event.endsAt)} to keep access without a break.`,
        heading: 'Your subscription is ending soon',
        paragraphs: [`Your subscription ends on ${dateText(event.endsAt)}. Renew before then so you and your members keep access without a break.`],
        facts: [{ label: 'Ends on', value: dateText(event.endsAt) }],
        cta: 'plans',
        ctaLabel: 'Renew now',
      };
    case 'SUBSCRIPTION_EXPIRED':
      if (event.graceEndsAt) {
        return {
          title: 'Your subscription has ended',
          body: `Renew by ${dateText(event.graceEndsAt)} to keep access without a break.`,
          heading: 'Your subscription has ended',
          paragraphs: [
            `Your subscription period has ended, but you can still use SocietyLedger until ${dateText(event.graceEndsAt)}. After that, access pauses until you choose a plan and pay. Nothing is ever deleted.`,
          ],
          facts: [{ label: 'Access continues until', value: dateText(event.graceEndsAt) }],
          cta: 'plans',
          ctaLabel: 'Renew now',
        };
      }
      return {
        title: 'Your subscription has ended',
        body: 'Access is paused. Choose a plan to restore it. Your records are safe.',
        heading: 'Your subscription has ended',
        paragraphs: ['Access for you and your members is paused until you choose a plan and pay. Nothing has been deleted: all your records are kept.'],
        cta: 'plans',
        ctaLabel: 'Resubscribe now',
      };
    case 'SUBSCRIPTION_ACTIVATED':
      return {
        title: 'Your subscription is active',
        body: event.periodEnd ? `Thank you. You have access until ${dateText(event.periodEnd)}.` : 'Thank you. Your subscription is active.',
        heading: 'Subscription active',
        paragraphs: ['Your payment was confirmed and your access has been restored.'],
        facts: event.periodEnd ? [{ label: 'Next renewal', value: dateText(event.periodEnd) }] : undefined,
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
    case 'ADDON_ACTIVATED':
      return {
        title: 'Your add-on is active',
        body: 'Your add-on payment was confirmed. It renews with your plan.',
        heading: 'Add-on active',
        paragraphs: ['Your add-on payment was confirmed. It now runs until your plan renewal date and renews with your plan.'],
        facts: event.periodEnd ? [{ label: 'Renews with your plan on', value: dateText(event.periodEnd) }] : undefined,
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
    case 'PAYMENT_PENDING':
      return {
        title: 'Your payment is still pending',
        body: 'We have not been able to confirm your payment yet. Access is restored as soon as it is confirmed.',
        heading: 'Payment pending',
        paragraphs: ['We have not been able to confirm your payment yet. As soon as it is confirmed your subscription is activated. You do not need to pay again.'],
        cta: 'subscription',
        ctaLabel: 'Check status',
      };
    case 'PAYMENT_FAILED':
      return {
        title: 'Your payment did not go through',
        body: 'No money was taken for your subscription. Try again to restore access.',
        heading: 'Payment failed',
        paragraphs: ['Your payment did not go through, so your subscription was not changed. You can try again at any time.'],
        cta: 'plans',
        ctaLabel: 'Try again',
      };
    case 'PAYMENT_NEEDS_REVIEW':
      return {
        title: 'Your payment needs a manual check',
        body: 'We received a payment that does not match your order. Our team is reviewing it.',
        heading: 'We are checking your payment',
        paragraphs: ['We received a payment, but its amount does not match your order, so your subscription was not changed yet. Our team is reviewing it and will contact you. Please do not pay again.'],
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
    case 'PLAN_CHANGED':
      return {
        title: event.direction === 'scheduled' ? `Your move to ${event.planName} is scheduled` : `You are now on ${event.planName}`,
        body:
          event.direction === 'scheduled' && event.effectiveAt
            ? `You move to ${event.planName} on ${dateText(event.effectiveAt)}. Until then your current plan stays.`
            : `Your plan was changed to ${event.planName}.`,
        heading: 'Your plan changed',
        paragraphs:
          event.direction === 'scheduled' && event.effectiveAt
            ? [`Your move to ${event.planName} takes effect on ${dateText(event.effectiveAt)}. Until then your current plan stays as it is.`]
            : [`Your plan was changed to ${event.planName}.`],
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
    case 'PLAN_TERMS_CHANGED':
      return {
        title: `Changes to your ${event.planName} plan`,
        body: `The terms of your ${event.planName} plan change on ${dateText(event.effectiveAt)}.`,
        heading: 'Changes to your plan',
        paragraphs: [`The prices or contents of your ${event.planName} plan are changing on ${dateText(event.effectiveAt)}. You will see the details on your subscription page.`],
        cta: 'subscription',
        ctaLabel: 'View your subscription',
      };
  }
}

/** Send one billing message to every administrator of the association. Never throws. */
export async function notifyBillingEvent(event: BillingEvent): Promise<void> {
  try {
    const association = await prisma.association.findUnique({
      where: { id: event.associationId },
      select: { name: true, subdomain: true },
    });
    if (!association) return;
    const admins = await prisma.user.findMany({
      where: { associationId: event.associationId, role: 'admin', isActive: true },
      select: { id: true, email: true },
    });
    if (admins.length === 0) return;

    const msg = compose(event);
    const base = tenantBaseUrl(association.subdomain);
    const ctaUrl = `${base}/dashboard/subscription${msg.cta === 'plans' ? '/plans' : ''}`;

    for (const admin of admins) {
      try {
        await dispatchNotification({
          associationId: event.associationId,
          userId: admin.id,
          title: msg.title,
          message: msg.body,
          kind: 'system',
          sendEmail: true,
          emailSubject: msg.title,
          emailTemplate: 'billing-notice',
          emailData: {
            heading: msg.heading,
            associationName: association.name,
            paragraphs: msg.paragraphs,
            facts: msg.facts,
            ctaUrl,
            ctaLabel: msg.ctaLabel,
          },
        });
      } catch (error) {
        console.error(`Billing notification (${event.type}) failed for user ${admin.id}:`, error);
      }
    }
  } catch (error) {
    console.error(`Billing notification (${event.type}) failed:`, error);
  }
}

/** Direct email for callers that have no user context (kept for the cron jobs' existing templates). */
export async function sendBillingEmail(to: string, subject: string, data: Record<string, unknown>): Promise<void> {
  try {
    await sendEmail({ to, subject, template: 'billing-notice', data });
  } catch (error) {
    console.error('Billing email failed:', error);
  }
}
