import type { Page } from '@playwright/test';
import { ajoCaptureInstant } from '../constants';
import type { Flow, Shot } from './dashboard';

/**
 * Thrift (Ajo) screenshots (T11). They run on the demo tenant after `demo-ajo.seed.ts` (see seed-demo.md): a rotating pot, "Umuoji
 * Market Women Ajo", and a collector-thrift group, "Umuoji Daily Savers". Circle ids change every time the seed is rebuilt, so a shot
 * finds its circle by name from the circles list instead of a fixed address.
 *
 *   pnpm -F @societyledger/docs screenshots --section=ajo-thrift
 */
const POT = 'Umuoji Market Women Ajo';
const THRIFT = 'Umuoji Daily Savers';

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

/** Open a circle (or one of its tabs) from the circles list, by the circle's name. */
async function openCircle(page: Page, name: string, tab = '') {
  await page.goto('/dashboard/ajo');
  await settle(page);
  const href = await page.getByRole('link', { name, exact: true }).first().getAttribute('href');
  if (!href) throw new Error(`The circle "${name}" is not on the circles list. Has demo-ajo.seed.ts been run?`);
  await page.goto(`${href}${tab}`);
  await settle(page);
}

/** Open the signed-in person's own circle (or one of its pages) from My Thrift. */
async function openMyCircle(page: Page, tab = '') {
  await page.goto('/dashboard/my-thrift');
  await settle(page);
  const links = await page.locator('a[href^="/dashboard/my-thrift/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  const href = links.find((h) => /^\/dashboard\/my-thrift\/\d+$/.test(h));
  if (!href) throw new Error('No circle on My Thrift for this login. Has demo-ajo.seed.ts been run?');
  await page.goto(`${href}${tab}`);
  await settle(page);
}

const ajo = (shot: Shot): Shot => ({ instant: ajoCaptureInstant, ...shot });

export const flow: Flow = {
  section: 'ajo-thrift',
  shots: [
    // ---- The group admin or officer
    ajo({ name: 'circles-list', role: 'officer', url: '/dashboard/ajo' }),
    ajo({ name: 'new-circle', role: 'officer', url: '/dashboard/ajo/new' }),
    ajo({ name: 'pot-overview', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, POT) }),
    ajo({ name: 'pot-rules', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/rules') }),
    ajo({ name: 'pot-members', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/members') }),
    ajo({ name: 'thrift-members', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, THRIFT, '/members') }),
    ajo({ name: 'pot-order', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/order') }),
    ajo({ name: 'pot-payments', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, POT, '/payments') }),
    ajo({ name: 'pot-payouts', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/payouts') }),
    ajo({ name: 'pot-arrears-fees', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, POT, '/arrears') }),
    ajo({
      name: 'pot-arrears-claims',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/arrears');
        await p.getByRole('tab', { name: /Claims/ }).click();
        await settle(p);
      },
    }),
    ajo({
      name: 'pot-arrears-cases',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/arrears');
        await p.getByRole('tab', { name: /Default cases/ }).click();
        await settle(p);
      },
    }),
    ajo({ name: 'pot-board', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/board') }),
    ajo({ name: 'pot-accountability', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, POT, '/accountability') }),
    ajo({ name: 'thrift-overview', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, THRIFT) }),
    ajo({ name: 'thrift-collectors', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, THRIFT, '/collectors') }),
    ajo({ name: 'thrift-handovers', role: 'officer', url: '/dashboard/ajo', prepare: (p) => openCircle(p, THRIFT, '/handovers') }),
    ajo({ name: 'thrift-cycle', role: 'officer', url: '/dashboard/ajo', fullPage: true, prepare: (p) => openCircle(p, THRIFT, '/cycle') }),
    ajo({ name: 'reports-hub', role: 'officer', url: '/dashboard/ajo/reports' }),
    ajo({ name: 'report-contributions', role: 'officer', url: '/dashboard/ajo/reports/contributions', fullPage: true }),
    ajo({ name: 'report-collectors', role: 'officer', url: '/dashboard/ajo/reports/collectors', fullPage: true }),
    ajo({ name: 'report-audit', role: 'officer', url: '/dashboard/ajo/reports/audit', fullPage: true }),
    ajo({ name: 'subscription-addon', role: 'admin', url: '/dashboard/subscription', fullPage: true }),

    // Dialogs (opened, never submitted: the demo data must stay as it is)
    ajo({
      name: 'thrift-count-handover',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, THRIFT, '/handovers');
        await p.getByRole('button', { name: /Count and reconcile/ }).first().click();
        await settle(p);
      },
    }),
    ajo({
      name: 'pot-confirm-payment',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/payments');
        await p.getByRole('button', { name: 'Confirm' }).first().click();
        await settle(p);
      },
    }),
    ajo({
      name: 'pot-add-person',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/members');
        await p.getByRole('button', { name: 'Add a person' }).click();
        await settle(p);
      },
    }),
    ajo({
      name: 'pot-record-payout',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/payouts');
        await p.getByRole('button', { name: 'Record as paid' }).first().click();
        await settle(p);
      },
    }),

    // ---- The collector
    ajo({ name: 'collect-today', role: 'collector', url: '/dashboard/ajo/collect', fullPage: true }),
    ajo({
      name: 'collect-record-cash',
      role: 'collector',
      url: '/dashboard/ajo/collect',
      prepare: async (p) => {
        await p.getByRole('button', { name: 'Record cash' }).first().click();
        await settle(p);
      },
    }),

    // ---- A member of the rotating pot (Ngozi)
    ajo({ name: 'my-thrift', role: 'member', url: '/dashboard/my-thrift' }),
    ajo({ name: 'my-circle', role: 'member', url: '/dashboard/my-thrift', fullPage: true, prepare: (p) => openMyCircle(p) }),
    ajo({ name: 'my-circle-pay', role: 'member', url: '/dashboard/my-thrift', fullPage: true, prepare: (p) => openMyCircle(p, '/pay') }),
    ajo({ name: 'my-circle-rules', role: 'member', url: '/dashboard/my-thrift', fullPage: true, prepare: (p) => openMyCircle(p, '/rules') }),
    ajo({ name: 'my-payout-account', role: 'member', url: '/dashboard/my-thrift/payout-account', fullPage: true }),

    // ---- A collector-thrift saver (Chukwuemeka)
    ajo({ name: 'saver-my-thrift', role: 'saver', url: '/dashboard/my-thrift' }),
    ajo({ name: 'saver-savings', role: 'saver', url: '/dashboard/my-thrift', fullPage: true, prepare: (p) => openMyCircle(p, '/savings') }),

    // ---- Added after the T11 review (pages that had no screenshot)
    ajo({
      name: 'pot-guarantor',
      role: 'officer',
      url: '/dashboard/ajo',
      prepare: async (p) => {
        await openCircle(p, POT, '/members');
        await p.getByRole('button', { name: 'Guarantor', exact: true }).first().click();
        await settle(p);
      },
    }),
    ajo({
      name: 'collect-hand-over',
      role: 'collector',
      url: '/dashboard/ajo/collect',
      prepare: async (p) => {
        await p.getByRole('button', { name: 'Hand over cash' }).first().click();
        await settle(p);
      },
    }),
    ajo({
      name: 'saver-cash-trail',
      role: 'saver',
      url: '/dashboard/my-thrift',
      fullPage: true,
      prepare: async (p) => {
        await openMyCircle(p, '/savings');
        await p.getByRole('tab', { name: 'Where my cash is' }).click();
        await settle(p);
      },
    }),
    ajo({
      name: 'saver-query',
      role: 'saver',
      url: '/dashboard/my-thrift',
      prepare: async (p) => {
        await openMyCircle(p, '/savings');
        await p.getByRole('tab', { name: 'Where my cash is' }).click();
        await settle(p);
        await p.getByRole('button', { name: 'Ask about this payment' }).first().click();
        await settle(p);
      },
    }),
    ajo({
      name: 'my-leave',
      role: 'member',
      url: '/dashboard/my-thrift',
      prepare: async (p) => {
        await openMyCircle(p);
        await p.getByRole('button', { name: 'Leave this circle' }).click();
        await settle(p);
      },
    }),
    ajo({
      name: 'saver-statements',
      role: 'saver',
      url: '/dashboard/my-thrift',
      fullPage: true,
      prepare: async (p) => {
        await openMyCircle(p, '/savings');
        await p.getByRole('tab', { name: 'Statements' }).click();
        await settle(p);
      },
    }),
    ajo({ name: 'subscription-addons', role: 'admin', url: '/dashboard/subscription/addons', fullPage: true }),
    ajo({ name: 'onboarding-thrift', role: 'admin', url: '/onboarding/thrift', fullPage: true }),
  ],
};
