/**
 * Prices a checkout on the server. The browser only says WHICH plan, billing cycle and add-ons; every amount, version and date rule
 * comes from here, from the published catalog and the tenant's current subscription. The result is stored with the pending payment, and a
 * verified payment only activates anything if it matches that stored quote to the kobo.
 *
 * Rules (all amounts in kobo):
 *  - SUBSCRIBE  no running paid period (new, trial, expired, in grace): full price of the latest published version, term starts now.
 *  - RENEW      running paid period, same plan and cycle: full price of the version the tenant already holds, the term is added on after
 *               the current end, and held add-ons come along at full price.
 *  - CHANGE     running paid period, different plan or cycle: full price of the new plan's latest version, a new term starts now, minus a
 *               credit for the unused part of the current plan (and of each held add-on). A cheaper plan is a deferred downgrade, not a charge.
 *  - ADDON      running paid period: the add-on's price prorated for the days left until the plan's renewal date.
 */
import type { BillingCycle } from '@prisma/client';
import prisma from '../../lib/prisma';
import { attachLevyToQuote } from '../../modules/ajo/ajo-levy.service';
import { evaluateAccess, pickDecidingSubscription } from '../subscription-access.service';
import {
  type CatalogAddon,
  type CatalogPlan,
  addonFitsPlan,
  getPlanVersionTerms,
  listPurchasableAddons,
  listPurchasablePlans,
  pricesOf,
} from './catalog.service';
import { addonProrationKobo, creditKobo, cycleDaysLeft, formatNaira, periodEndFor, priceForCycle } from './money';

export type QuoteKind = 'SUBSCRIBE' | 'RENEW' | 'CHANGE' | 'ADDON';

export class BillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export interface QuoteLine {
  /** LEVY is SocietyLedger's Ajo platform levy: its own line, never part of the plan or add-on price. */
  type: 'PLAN' | 'ADDON' | 'CREDIT' | 'LEVY';
  label: string;
  amountKobo: number;
  amount: string;
  /** Set on an add-on's own line and on a credit for that add-on, so each add-on's net price can be recorded. */
  addonId?: number;
}

export interface QuoteAddon {
  addonId: number;
  addonVersionId: number;
  code: string;
  amountKobo: number;
  /** True when the charge covers only the days left until the plan renewal date. */
  prorated: boolean;
  /** The tenant's existing row for this add-on, when it is being renewed rather than bought. */
  tenantAddonId: number | null;
  /** Rows of another tier in the same family that this purchase replaces (they end when it is applied). */
  replacesTenantAddonIds?: number[];
}

export interface Quote {
  kind: QuoteKind;
  planId: number;
  planCode: string;
  planName: string;
  planVersionId: number;
  billingCycle: BillingCycle;
  /** RENEW: the new term is added after the current end instead of starting today. */
  extend: boolean;
  addons: QuoteAddon[];
  lines: QuoteLine[];
  totalKobo: number;
  total: string;
  /** When the paid period will end once this is applied. */
  periodEndsAt: string;
  /** The Ajo levy on this quote, if any: which assessments it carries, and how much it adds to the total. */
  levy?: { assessmentIds: number[]; totalKobo: number };
  /** A downgrade does not charge anything now: it is scheduled for the end of the current period. */
  deferred: boolean;
  deferredEffectiveAt: string | null;
  createdAt: string;
}

export interface HeldAddon {
  id: number;
  addonId: number;
  addonVersionId: number;
  code: string;
  name: string;
  family: string | null;
  prices: { priceMonthlyKobo: number; priceAnnualKobo: number };
  startsAt: Date;
  endsAt: Date;
  /** What the tenant actually paid for the running add-on term (0 if it was granted). */
  amountPaidKobo: number;
  cancelAtPeriodEnd: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left of a term that started at `start` and ends at `end`, against the term's own length (never more than one term). */
function unusedShare(start: Date, end: Date, now: Date): { remainingDays: number; totalDays: number } {
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  return { remainingDays: Math.min(totalDays, remaining), totalDays };
}

function addMonthsUtcForCycle(periodEnd: Date, cycle: BillingCycle): Date {
  const { totalDays } = cycleDaysLeft(periodEnd, cycle, periodEnd);
  return new Date(periodEnd.getTime() - totalDays * DAY_MS);
}

export interface QuoteContext {
  now: Date;
  subscription: {
    id: number;
    status: string;
    planId: number;
    planCode: string;
    planVersionId: number;
    billingCycle: BillingCycle;
    currentPeriodEnd: Date;
    trialEndsAt: Date | null;
  } | null;
  /** The terms of the version the subscription is on (not the latest). */
  heldPlan: CatalogPlan | null;
  /** True when the tenant has a paid or complimentary period that has not ended yet. */
  hasRunningPeriod: boolean;
  subscriptionSource: string | null;
  /** The recorded term that covers today: what it cost and when it runs. Null for a subscription from before terms were recorded. */
  currentTerm: { amountKobo: number; startsAt: Date; endsAt: Date } | null;
  heldAddons: HeldAddon[];
  purchasablePlans: CatalogPlan[];
  purchasableAddons: CatalogAddon[];
}

const line = (type: QuoteLine['type'], label: string, amountKobo: number, addonId?: number): QuoteLine => ({
  type,
  label,
  amountKobo,
  amount: formatNaira(amountKobo),
  ...(addonId !== undefined ? { addonId } : {}),
});

function cycleLabel(cycle: BillingCycle): string {
  return cycle === 'ANNUAL' ? 'annual' : 'monthly';
}

/** Pure: price a plan checkout from already-loaded state. */
export function buildPlanQuote(
  ctx: QuoteContext,
  input: { planId: number; billingCycle: BillingCycle; addonIds?: number[] },
): Quote {
  const { now, subscription: sub } = ctx;
  const cycle = input.billingCycle;
  if (cycle !== 'MONTHLY' && cycle !== 'ANNUAL') throw new BillingError('INVALID_CYCLE', 'Choose monthly or annual billing.');

  const running = ctx.hasRunningPeriod && !!sub && sub.status !== 'TRIALING';
  const samePlan = !!sub && sub.planId === input.planId;

  // The plan being bought: the published catalog, or (for an existing customer renewing the plan they are on) the plan they hold even
  // if it has since been hidden or deactivated.
  let target = ctx.purchasablePlans.find((p) => p.id === input.planId) ?? null;
  const renewingHeldPlan = running && samePlan && sub!.billingCycle === cycle && !!ctx.heldPlan;
  if (!target && renewingHeldPlan) target = ctx.heldPlan;
  if (!target) throw new BillingError('PLAN_UNAVAILABLE', 'That plan is not available to buy right now.', 404);

  let kind: QuoteKind;
  if (!running) kind = 'SUBSCRIBE';
  else if (samePlan && sub!.billingCycle === cycle) kind = 'RENEW';
  else kind = 'CHANGE';

  // RENEW keeps the version the tenant already holds; everything else is sold at the latest published version.
  const priced = kind === 'RENEW' && ctx.heldPlan ? ctx.heldPlan : target;
  const planPrice = priceForCycle({ priceMonthlyKobo: priced.prices.monthlyKobo, priceAnnualKobo: priced.prices.annualKobo }, cycle);

  const currentEnd = sub?.currentPeriodEnd ?? now;
  const extend = kind === 'RENEW';
  const termStart = extend ? currentEnd : now;
  const newEnd = periodEndFor(termStart, cycle);

  // ---- add-ons that come along with this checkout
  const held = new Map(ctx.heldAddons.map((a) => [a.addonId, a]));
  const wanted = input.addonIds ?? ctx.heldAddons.filter((a) => !a.cancelAtPeriodEnd).map((a) => a.addonId);
  assertOnePerFamily(wanted, ctx);
  const addons: QuoteAddon[] = [];
  const lines: QuoteLine[] = [line('PLAN', `${priced.name} (${cycleLabel(cycle)})`, planPrice)];
  let total = planPrice;

  for (const addonId of [...new Set(wanted)]) {
    const heldAddon = held.get(addonId);
    const catalog = ctx.purchasableAddons.find((a) => a.id === addonId) ?? null;
    if (!catalog && !heldAddon) {
      if (input.addonIds) throw new BillingError('ADDON_UNAVAILABLE', 'One of the selected add-ons is not available.', 404);
      continue;
    }
    if (catalog && !addonFitsPlan(catalog, target.code)) {
      // A held add-on the new plan does not allow is dropped on a plan change; asking for it by name is an error.
      if (input.addonIds?.includes(addonId)) throw new BillingError('ADDON_NOT_ELIGIBLE', `${catalog.name} is not available on the ${target.name} plan.`);
      continue;
    }

    // Held add-ons renew at the version they were bought on while the plan is being renewed; otherwise the latest published version.
    const useHeldTerms = kind === 'RENEW' && !!heldAddon;
    const prices = useHeldTerms ? heldAddon!.prices : catalog ? { priceMonthlyKobo: catalog.prices.monthlyKobo, priceAnnualKobo: catalog.prices.annualKobo } : null;
    const versionId = useHeldTerms ? heldAddon!.addonVersionId : catalog!.versionId;
    if (!prices) continue;
    const name = catalog?.name ?? heldAddon!.name;
    const code = catalog?.code ?? heldAddon!.code;
    const fullPrice = priceForCycle(prices, cycle);

    // A brand-new add-on added while the plan is simply being extended only runs from today, so it is prorated to the new end.
    const prorated = kind === 'RENEW' && !heldAddon;
    const amount = prorated ? addonProrationKobo(fullPrice, newEnd, cycle, now) : fullPrice;
    // Buying another tier of a product the tenant already holds replaces that tier.
    const family = catalog?.family ?? heldAddon?.family ?? null;
    const siblings = family ? ctx.heldAddons.filter((h) => h.family === family && h.addonId !== addonId) : [];
    addons.push({
      addonId,
      addonVersionId: versionId,
      code,
      amountKobo: amount,
      prorated,
      tenantAddonId: heldAddon?.id ?? null,
      ...(siblings.length ? { replacesTenantAddonIds: siblings.map((h) => h.id) } : {}),
    });
    lines.push(line('ADDON', `${name} (${cycleLabel(cycle)}${prorated ? ', prorated' : ''})`, amount, addonId));
    total += amount;
  }

  // ---- credit for the unused part of what is being replaced
  let deferred = false;
  let deferredEffectiveAt: string | null = null;
  if (kind === 'CHANGE' && sub && ctx.heldPlan) {
    const currentPrice = priceForCycle(
      { priceMonthlyKobo: ctx.heldPlan.prices.monthlyKobo, priceAnnualKobo: ctx.heldPlan.prices.annualKobo },
      sub.billingCycle,
    );
    // The credit is the unused share of what was actually PAID for the running term. A complimentary or trial term paid nothing, so it
    // credits nothing; a migrated subscription with no recorded term falls back to its list price.
    const term = ctx.currentTerm;
    const planPaid = term ? term.amountKobo : ctx.subscriptionSource === 'PURCHASE' ? currentPrice : 0;
    const termStart = term ? term.startsAt : addMonthsUtcForCycle(sub.currentPeriodEnd, sub.billingCycle);
    const termEnd = term ? term.endsAt : sub.currentPeriodEnd;
    const left = unusedShare(termStart, termEnd, now);
    const planCredit = creditKobo(planPaid, left.remainingDays, left.totalDays);
    if (planCredit > 0) {
      lines.push(line('CREDIT', `Unused part of ${ctx.heldPlan.name} (${left.remainingDays} days)`, -planCredit));
      total -= planCredit;
    }
    // Held add-ons are re-bought above for the new term, so their unused days are credited back.
    for (const a of ctx.heldAddons) {
      if (!addons.find((x) => x.addonId === a.addonId)) continue;
      const share = unusedShare(a.startsAt, a.endsAt, now);
      const addonCredit = creditKobo(a.amountPaidKobo, share.remainingDays, share.totalDays);
      if (addonCredit > 0) {
        lines.push(line('CREDIT', `Unused part of ${a.name} (${share.remainingDays} days)`, -addonCredit, a.addonId));
        total -= addonCredit;
      }
    }
    // Paying less than before is a downgrade: nothing is charged now, the change waits for the end of the period.
    if (planPrice < currentPrice || total <= 0) {
      deferred = true;
      deferredEffectiveAt = sub.currentPeriodEnd.toISOString();
    }
  }

  const totalKobo = Math.max(0, total);
  return {
    kind,
    planId: target.id,
    planCode: target.code,
    planName: target.name,
    planVersionId: priced.versionId,
    billingCycle: cycle,
    extend,
    addons,
    lines,
    totalKobo: deferred ? 0 : totalKobo,
    total: formatNaira(deferred ? 0 : totalKobo),
    periodEndsAt: (deferred && sub ? sub.currentPeriodEnd : newEnd).toISOString(),
    deferred,
    deferredEffectiveAt,
    createdAt: now.toISOString(),
  };
}

/** Two tiers of one product cannot be bought together. */
function assertOnePerFamily(addonIds: number[], ctx: QuoteContext): void {
  const seen = new Set<string>();
  for (const addonId of new Set(addonIds)) {
    const family = ctx.purchasableAddons.find((a) => a.id === addonId)?.family ?? ctx.heldAddons.find((a) => a.addonId === addonId)?.family ?? null;
    if (!family) continue;
    if (seen.has(family)) throw new BillingError('ADDON_FAMILY_CONFLICT', 'Choose one tier of this add-on, not two.');
    seen.add(family);
  }
}

/** Pure: price adding add-ons to a running subscription, aligned to its renewal date. */
export function buildAddonQuote(ctx: QuoteContext, input: { addonIds: number[] }): Quote {
  const { now, subscription: sub } = ctx;
  if (!sub || !ctx.hasRunningPeriod || sub.status === 'TRIALING' || !ctx.heldPlan) {
    throw new BillingError('NO_ACTIVE_SUBSCRIPTION', 'Add-ons can be bought while you have an active subscription.', 403);
  }
  if (input.addonIds.length === 0) throw new BillingError('NO_ADDONS', 'Choose at least one add-on.');

  const held = new Map(ctx.heldAddons.map((a) => [a.addonId, a]));
  const addons: QuoteAddon[] = [];
  const lines: QuoteLine[] = [];
  let total = 0;

  for (const addonId of [...new Set(input.addonIds)]) {
    const catalog = ctx.purchasableAddons.find((a) => a.id === addonId);
    if (!catalog) throw new BillingError('ADDON_UNAVAILABLE', 'One of the selected add-ons is not available.', 404);
    if (!addonFitsPlan(catalog, sub.planCode)) throw new BillingError('ADDON_NOT_ELIGIBLE', `${catalog.name} is not available on your plan.`);
    const existing = held.get(addonId);
    if (existing && !existing.cancelAtPeriodEnd) throw new BillingError('ADDON_ALREADY_HELD', `You already have ${catalog.name}.`, 409);

    const full = priceForCycle({ priceMonthlyKobo: catalog.prices.monthlyKobo, priceAnnualKobo: catalog.prices.annualKobo }, sub.billingCycle);
    const amount = addonProrationKobo(full, sub.currentPeriodEnd, sub.billingCycle, now);
    // Another tier of the same product already held: this is a tier change. Only a bigger tier can start mid-term (the unused part of the
    // old tier is credited); a smaller one waits for renewal, because a credit larger than the charge would be lost.
    const sibling = catalog.family ? ctx.heldAddons.find((h) => h.family === catalog.family && h.addonId !== addonId) : undefined;
    if (sibling) {
      const oldFull = priceForCycle(sibling.prices, sub.billingCycle);
      if (full < oldFull) {
        throw new BillingError('ADDON_TIER_DOWNGRADE', `You are on ${sibling.name}. You can move to a smaller tier when you renew.`, 409);
      }
    }
    addons.push({
      addonId,
      addonVersionId: catalog.versionId,
      code: catalog.code,
      amountKobo: amount,
      prorated: true,
      tenantAddonId: existing?.id ?? null,
      ...(sibling ? { replacesTenantAddonIds: [sibling.id] } : {}),
    });
    const { remainingDays } = cycleDaysLeft(sub.currentPeriodEnd, sub.billingCycle, now);
    lines.push(line('ADDON', `${catalog.name} (${remainingDays} days until your renewal date)`, amount, addonId));
    total += amount;
    if (sibling) {
      const share = unusedShare(sibling.startsAt, sibling.endsAt, now);
      const credit = Math.min(creditKobo(sibling.amountPaidKobo, share.remainingDays, share.totalDays), amount);
      if (credit > 0) {
        // Tagged with the NEW add-on so its recorded net price is the charge minus this credit.
        lines.push(line('CREDIT', `Unused part of ${sibling.name} (${share.remainingDays} days)`, -credit, addonId));
        total -= credit;
      }
    }
  }

  return {
    kind: 'ADDON',
    planId: sub.planId,
    planCode: sub.planCode,
    planName: ctx.heldPlan.name,
    planVersionId: sub.planVersionId,
    billingCycle: sub.billingCycle,
    extend: false,
    addons,
    lines,
    totalKobo: total,
    total: formatNaira(total),
    periodEndsAt: sub.currentPeriodEnd.toISOString(),
    deferred: false,
    deferredEffectiveAt: null,
    createdAt: now.toISOString(),
  };
}

/** Load everything a quote depends on for one association. */
export async function loadQuoteContext(associationId: number, now = new Date()): Promise<QuoteContext> {
  // A standalone thrift group is offered its own plan; an association is offered the association plans.
  const kind = (await prisma.association.findUnique({ where: { id: associationId }, select: { kind: true } }))?.kind ?? 'ASSOCIATION';
  const [subs, purchasablePlans, purchasableAddons] = await Promise.all([
    prisma.subscription.findMany({
      where: { associationId },
      select: {
        id: true,
        source: true,
        status: true,
        planId: true,
        planVersionId: true,
        billingCycle: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        createdAt: true,
        plan: { select: { code: true } },
      },
    }),
    listPurchasablePlans(kind),
    listPurchasableAddons(),
  ]);

  const deciding = pickDecidingSubscription(subs);
  const subscription = deciding
    ? {
        id: deciding.id,
        status: deciding.status,
        planId: deciding.planId,
        planCode: deciding.plan.code,
        planVersionId: deciding.planVersionId,
        billingCycle: deciding.billingCycle,
        currentPeriodEnd: deciding.currentPeriodEnd,
        trialEndsAt: deciding.trialEndsAt,
      }
    : null;

  // A period is "running" when its stored end is still ahead. Grace days do not count: after the end, buying starts a fresh term.
  const state = deciding ? evaluateAccess(deciding, now, false, 0) : null;
  const hasRunningPeriod = !!deciding && !!state?.allowed && deciding.currentPeriodEnd.getTime() > now.getTime();

  const heldPlan = deciding ? await getPlanVersionTerms(deciding.planVersionId) : null;
  const currentTermRow = deciding
    ? await prisma.subscriptionTerm.findFirst({
        where: { subscriptionId: deciding.id, startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: { startsAt: 'desc' },
        select: { amountKobo: true, startsAt: true, endsAt: true },
      })
    : null;

  const heldRows = deciding
    ? await prisma.tenantAddon.findMany({
        where: { associationId, subscriptionId: deciding.id, status: 'ACTIVE', endsAt: { gt: now } },
        include: { addonVersion: { include: { addon: true } } },
      })
    : [];
  const heldAddons: HeldAddon[] = heldRows.map((r) => ({
    id: r.id,
    addonId: r.addonVersion.addonId,
    addonVersionId: r.addonVersionId,
    code: r.addonVersion.addon.code,
    name: r.addonVersion.addon.name,
    family: r.addonVersion.addon.family,
    prices: { priceMonthlyKobo: r.addonVersion.priceMonthlyKobo, priceAnnualKobo: r.addonVersion.priceAnnualKobo },
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    amountPaidKobo: r.amountPaidKobo,
    cancelAtPeriodEnd: r.cancelAtPeriodEnd,
  }));

  return {
    now,
    subscription,
    heldPlan,
    hasRunningPeriod,
    subscriptionSource: deciding?.source ?? null,
    currentTerm: currentTermRow,
    heldAddons,
    purchasablePlans,
    purchasableAddons,
  };
}

export async function quotePlanCheckout(associationId: number, input: { planId: number; billingCycle: BillingCycle; addonIds?: number[] }): Promise<Quote> {
  return attachLevyToQuote(associationId, buildPlanQuote(await loadQuoteContext(associationId), input));
}

export async function quoteAddonCheckout(associationId: number, input: { addonIds: number[] }): Promise<Quote> {
  return attachLevyToQuote(associationId, buildAddonQuote(await loadQuoteContext(associationId), input));
}

export { pricesOf };
