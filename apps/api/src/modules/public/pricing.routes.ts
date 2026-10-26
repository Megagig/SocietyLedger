import { Router, Request, Response } from 'express';
import { listPurchasableAddons, listPurchasablePlans } from '../../services/billing/catalog.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';

const router: Router = Router();

/**
 * The one source of pricing for every public surface: the landing page, homepage, pricing page and sign-up.
 * Published, visible, purchasable plans and add-ons only. Drafts, hidden and archived plans never appear here.
 * No sign-in and no tenant: it is the same for everyone.
 */
router.get('/pricing', async (_req: Request, res: Response) => {
  try {
    const [plans, addons, settings] = await Promise.all([listPurchasablePlans(), listPurchasableAddons(), PlatformSettingsService.getSettings()]);
    const onboardingPlan = plans.find((p) => p.code === settings.onboardingPlanCode) ?? null;

    // Short shared caching: a publish refreshes the website at once (see the revalidation hook), and even if that fails this
    // keeps any page no more than about a minute behind.
    res.set('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
    res.json({
      success: true,
      data: {
        currency: 'NGN',
        plans,
        addons,
        onboarding: {
          policy: settings.onboardingPolicy,
          days: settings.defaultTrialDays,
          planCode: settings.onboardingPlanCode,
          planName: onboardingPlan?.name ?? null,
        },
      },
    });
  } catch (error) {
    console.error('Error loading public pricing:', error);
    res.status(500).json({ success: false, message: 'Could not load pricing' });
  }
});

export default router;
