/**
 * Module & Feature Middleware
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Middleware for enforcing module and feature access.
 * Access is ENFORCED by default: a tenant only reaches the modules and features its plan version (plus add-ons) includes.
 *
 * Environment Variables:
 * - FEATURE_FLAG_MODE: set to 'shadow' only as an emergency switch (log what would be blocked, but let it through), for example if a
 *   bad plan configuration locks tenants out. Anything else, or unset, enforces.
 */

import { NextFunction, Response } from 'express';
import { TenantRequest } from './tenant.middleware';
import { ModuleFeatureService } from '../services/module-feature.service';

// Enforce unless the emergency switch is set to 'shadow'
const getFeatureFlagMode = (): 'shadow' | 'enforce' => {
  const mode = process.env.FEATURE_FLAG_MODE;
  return mode === 'shadow' ? 'shadow' : 'enforce';
};

/**
 * The association a request belongs to. The tenant resolver sets `tenantId`, but a few routers (exports) skip it and rely on the signed-in
 * user's association instead. Reading only `tenantId` made a check on those routers silently pass, so fall back to the user.
 */
export function tenantOf(req: TenantRequest): number | undefined {
  return req.tenantId ?? (req as TenantRequest & { user?: { associationId?: number | null } }).user?.associationId ?? undefined;
}

/**
 * Middleware factory to require a specific module
 * 
 * Usage:
 * router.get('/welfare', requireModule('welfare'), welfareController.list);
 */
export function requireModule(moduleCode: string) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      
      // Skip check if no tenant context (handled by tenant middleware)
      if (!associationId) {
        return next();
      }

      const status = await ModuleFeatureService.getModuleStatus(associationId, moduleCode);
      const mode = getFeatureFlagMode();

      if (!status.isEnabled) {
        // Log the access attempt
        console.log(`[ModuleCheck] Module '${moduleCode}' disabled for tenant ${associationId}. ` +
          `Source: ${status.source}. Mode: ${mode}. Path: ${req.path}`);

        if (mode === 'enforce') {
          res.status(403).json({
            success: false,
            error: 'MODULE_DISABLED',
            message: `The ${status.name} module is not available for your plan.`,
            module: moduleCode,
            // Upgrading helps unless this specific tenant was overridden off — a
            // plan-sourced OR default-fallback block is always plan-related (G13:
            // previously only 'plan' counted, so a default-fallback block told the
            // frontend "don't bother showing Upgrade" even though it's exactly the fix)
            upgradeRequired: status.source !== 'tenant_override',
          });
          return;
        }
        
        // Shadow mode: log but allow through
        // Add header to indicate shadow block
        res.setHeader('X-Module-Shadow-Block', moduleCode);
      }

      // Add module status to request for downstream use
      (req as TenantRequest & { moduleStatus?: typeof status }).moduleStatus = status;
      
      next();
    } catch (error) {
      console.error(`[ModuleCheck] Error checking module '${moduleCode}':`, error);
      // On error, allow through (fail open for backward compatibility)
      next();
    }
  };
}

/**
 * Middleware factory to require a specific feature
 * 
 * Usage:
 * router.post('/welfare/payouts', requireFeature('welfare_payouts'), payoutController.create);
 */
export function requireFeature(featureCode: string) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      
      // Skip check if no tenant context
      if (!associationId) {
        return next();
      }

      const status = await ModuleFeatureService.getFeatureStatus(associationId, featureCode);
      const mode = getFeatureFlagMode();

      if (!status.isEnabled) {
        // Log the access attempt
        console.log(`[FeatureCheck] Feature '${featureCode}' disabled for tenant ${associationId}. ` +
          `Source: ${status.source}. Mode: ${mode}. Path: ${req.path}`);

        if (mode === 'enforce') {
          res.status(403).json({
            success: false,
            error: 'FEATURE_DISABLED',
            message: `The ${status.name} feature is not available for your plan.`,
            feature: featureCode,
            module: status.moduleCode,
            upgradeRequired: status.source !== 'tenant_override',
          });
          return;
        }
        
        // Shadow mode: log but allow through
        res.setHeader('X-Feature-Shadow-Block', featureCode);
      }

      // Add feature status to request for downstream use
      (req as TenantRequest & { featureStatus?: typeof status }).featureStatus = status;
      
      next();
    } catch (error) {
      console.error(`[FeatureCheck] Error checking feature '${featureCode}':`, error);
      // On error, allow through (fail open)
      next();
    }
  };
}

/**
 * Middleware to require multiple modules (all must be enabled)
 */
export function requireModules(...moduleCodes: string[]) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      
      if (!associationId) {
        return next();
      }

      const mode = getFeatureFlagMode();
      const disabledModules: string[] = [];

      for (const moduleCode of moduleCodes) {
        const status = await ModuleFeatureService.getModuleStatus(associationId, moduleCode);
        if (!status.isEnabled) {
          disabledModules.push(moduleCode);
        }
      }

      if (disabledModules.length > 0) {
        console.log(`[ModuleCheck] Modules disabled for tenant ${associationId}: ${disabledModules.join(', ')}. ` +
          `Mode: ${mode}. Path: ${req.path}`);

        if (mode === 'enforce') {
          res.status(403).json({
            success: false,
            error: 'MODULES_DISABLED',
            message: 'One or more required modules are not available for your plan.',
            disabledModules,
            upgradeRequired: true,
          });
          return;
        }
        
        res.setHeader('X-Modules-Shadow-Block', disabledModules.join(','));
      }

      next();
    } catch (error) {
      console.error('[ModuleCheck] Error checking modules:', error);
      next();
    }
  };
}

/**
 * Middleware to require at least one of the specified modules
 */
export function requireAnyModule(...moduleCodes: string[]) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      
      if (!associationId) {
        return next();
      }

      const mode = getFeatureFlagMode();
      let hasEnabledModule = false;

      for (const moduleCode of moduleCodes) {
        const status = await ModuleFeatureService.getModuleStatus(associationId, moduleCode);
        if (status.isEnabled) {
          hasEnabledModule = true;
          break;
        }
      }

      if (!hasEnabledModule) {
        console.log(`[ModuleCheck] None of modules [${moduleCodes.join(', ')}] enabled for tenant ${associationId}. ` +
          `Mode: ${mode}. Path: ${req.path}`);

        if (mode === 'enforce') {
          res.status(403).json({
            success: false,
            error: 'NO_MODULE_AVAILABLE',
            message: 'None of the required modules are available for your plan.',
            requiredModules: moduleCodes,
            upgradeRequired: true,
          });
          return;
        }
        
        res.setHeader('X-Modules-Shadow-Block', moduleCodes.join(','));
      }

      next();
    } catch (error) {
      console.error('[ModuleCheck] Error checking modules:', error);
      next();
    }
  };
}

/**
 * Helper middleware to check module/feature and add status to request
 * without blocking (useful for conditional UI rendering info)
 */
export function checkModuleStatus(moduleCode: string) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const associationId = tenantOf(req);
      
      if (associationId) {
        const status = await ModuleFeatureService.getModuleStatus(associationId, moduleCode);
        (req as TenantRequest & { moduleStatuses?: Record<string, typeof status> }).moduleStatuses = 
          (req as TenantRequest & { moduleStatuses?: Record<string, typeof status> }).moduleStatuses || {};
        (req as TenantRequest & { moduleStatuses: Record<string, typeof status> }).moduleStatuses[moduleCode] = status;
      }
      
      next();
    } catch (error) {
      console.error(`[ModuleCheck] Error checking module status '${moduleCode}':`, error);
      next();
    }
  };
}
