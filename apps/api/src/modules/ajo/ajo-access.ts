/**
 * Who may use the Ajo module, and when an expired add-on turns it read-only (T1.2).
 *
 * The existing module gate answers yes or no. Ajo needs a third answer: a group whose add-on has lapsed keeps its history, so reads and
 * exports still work and only writes are refused. This is the one place that decides it; routers use `requireAjoAccess()` and never
 * check expiry themselves. It looks only at what the tenant is entitled to, never at a payment provider: SocietyLedger does not move
 * contribution money, so there is no payment callback that could arrive after expiry.
 */
import { NextFunction, Response } from 'express';
import prisma from '../../lib/prisma';
import { TenantRequest } from '../../middleware/tenant.middleware';
import { requireFeature, tenantOf } from '../../middleware/module-feature.middleware';
import { ModuleFeatureService } from '../../services/module-feature.service';

export const AJO_MODULE = 'ajo';

export type AjoAccess = 'FULL' | 'READ_ONLY' | 'DISABLED';

export interface AjoAccessInput {
  /** Is the `ajo` module currently enabled for the tenant (add-on live, staff override on)? */
  moduleEnabled: boolean;
  /** Where the module decision came from; a staff override that switched Ajo off is not an expiry. */
  source: 'tenant_override' | 'plan' | 'addon' | 'default';
  /** Does the tenant have any Ajo groups, i.e. history worth keeping readable? */
  hasAjoData: boolean;
}

/** Pure: the tenant's level of access to Ajo. */
export function decideAjoAccess(input: AjoAccessInput): AjoAccess {
  if (input.moduleEnabled) return 'FULL';
  // Staff switched Ajo off for this tenant on purpose: that is a stop, not an expiry.
  if (input.source === 'tenant_override') return 'DISABLED';
  // The add-on lapsed (or was never bought). With history, keep it readable; without any, there is nothing to show.
  return input.hasAjoData ? 'READ_ONLY' : 'DISABLED';
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isReadRequest(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export interface AjoAccessOptions {
  /**
   * Let a non-GET request through while the add-on is expired. For read-only operations that happen to be sent as a POST
   * (a report export with a filter body). Never for anything that records, changes or approves.
   */
  allowWhenReadOnly?: boolean;
}

export type AjoRequest = TenantRequest & { ajoAccess?: AjoAccess };

/**
 * Gate for every route under /api/ajo. A tenant without the add-on gets MODULE_DISABLED; one whose add-on lapsed can read and export
 * but gets ADDON_EXPIRED on a write.
 */
export function requireAjoAccess(options: AjoAccessOptions = {}) {
  return async (req: AjoRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      // No tenant context is for the tenant middleware to refuse.
      if (!associationId) return next();

      const status = await ModuleFeatureService.getModuleStatus(associationId, AJO_MODULE);
      const hasAjoData = status.isEnabled ? false : (await prisma.ajoGroup.findFirst({ where: { associationId }, select: { id: true } })) !== null;
      const access = decideAjoAccess({ moduleEnabled: status.isEnabled, source: status.source, hasAjoData });
      req.ajoAccess = access;

      if (access === 'FULL') return next();

      // Same emergency switch as every other gate: in shadow mode, log what would be blocked but let it through.
      if (process.env.FEATURE_FLAG_MODE === 'shadow') {
        res.setHeader('X-Module-Shadow-Block', AJO_MODULE);
        return next();
      }

      if (access === 'READ_ONLY') {
        if (isReadRequest(req.method) || options.allowWhenReadOnly) return next();
        res.status(403).json({
          success: false,
          error: 'ADDON_EXPIRED',
          code: 'ADDON_EXPIRED',
          message: 'Your Ajo add-on has expired. You can still view and export your records, but you cannot add or change anything until you renew.',
          module: AJO_MODULE,
          upgradeRequired: true,
          readOnly: true,
        });
        return;
      }

      res.status(403).json({
        success: false,
        error: 'MODULE_DISABLED',
        code: 'MODULE_DISABLED',
        message: `The ${status.name} module is not available for your plan.`,
        module: AJO_MODULE,
        upgradeRequired: status.source !== 'tenant_override',
      });
    } catch (error) {
      // The check itself failed. Refusing is safer than guessing here: this gate protects money records.
      console.error('[AjoAccess] Error checking Ajo access:', error);
      res.status(503).json({ success: false, error: 'AJO_ACCESS_CHECK_FAILED', code: 'AJO_ACCESS_CHECK_FAILED', message: 'Could not check your Ajo access. Please try again.' });
    }
  };
}

/**
 * Feature gate for Ajo routes. While the add-on is expired (read-only) a feature is not switched off for reading, so reads of history are
 * never lost to a feature check; otherwise it is the ordinary feature gate.
 */
export function requireAjoFeature(featureCode: string) {
  const gate = requireFeature(featureCode);
  return (req: AjoRequest, res: Response, next: NextFunction): void | Promise<void> => {
    if (req.ajoAccess === 'READ_ONLY') return next();
    return gate(req, res, next);
  };
}
