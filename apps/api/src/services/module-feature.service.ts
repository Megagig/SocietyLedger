/**
 * Module & Feature Service
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Service for checking module/feature enablement with resolution order:
 * TenantOverride → PlanModule → Default (enabled)
 * 
 * This service is the single source of truth for determining
 * what modules and features are available for a tenant.
 */

import prisma from '../lib/prisma';

export interface ModuleStatus {
  code: string;
  name: string;
  isEnabled: boolean;
  source: 'tenant_override' | 'plan' | 'default';
  expiresAt?: Date | null;
}

export interface FeatureStatus {
  code: string;
  name: string;
  moduleCode: string;
  isEnabled: boolean;
  source: 'tenant_override' | 'plan' | 'default';
  expiresAt?: Date | null;
}

export class ModuleFeatureService {
  /**
   * Check if a module is enabled for an association
   * Resolution order: TenantOverride → PlanModule → Default (enabled)
   */
  static async isModuleEnabled(associationId: number, moduleCode: string): Promise<boolean> {
    const status = await this.getModuleStatus(associationId, moduleCode);
    return status.isEnabled;
  }

  /**
   * Get detailed module status including source
   */
  static async getModuleStatus(associationId: number, moduleCode: string): Promise<ModuleStatus> {
    // 1. Check tenant override (highest priority)
    const tenantOverride = await prisma.tenantModule.findFirst({
      where: {
        associationId,
        module: { code: moduleCode },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { module: true }
    });

    if (tenantOverride) {
      return {
        code: moduleCode,
        name: tenantOverride.module.name,
        isEnabled: tenantOverride.isEnabled,
        source: 'tenant_override',
        expiresAt: tenantOverride.expiresAt,
      };
    }

    // 2. Check plan assignment
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: {
            plan: {
              include: {
                planModules: {
                  where: { module: { code: moduleCode } },
                  include: { module: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const planModule = association?.subscriptions[0]?.plan?.planModules[0];
    if (planModule) {
      return {
        code: moduleCode,
        name: planModule.module.name,
        isEnabled: planModule.isEnabled,
        source: 'plan',
      };
    }

    // 3. Get module info for default response
    const module = await prisma.platformModule.findUnique({
      where: { code: moduleCode }
    });

    // 4. Default when no explicit PlanModule row exists for this plan+module: core
    // modules only (G13) — this now matches getEnabledModules()'s batch default.
    // Previously defaulted to enabled unconditionally, which meant the UI (reading
    // the batch helper) could show a non-core module as locked while requireModule()
    // (reading this per-check path) still let the request through once enforce mode
    // actually started blocking anything.
    return {
      code: moduleCode,
      name: module?.name || moduleCode,
      isEnabled: module?.isCore ?? true,
      source: 'default',
    };
  }

  /**
   * Check if a feature is enabled for an association
   * Resolution order: TenantOverride → PlanFeature → Default (enabled)
   */
  static async isFeatureEnabled(associationId: number, featureCode: string): Promise<boolean> {
    const status = await this.getFeatureStatus(associationId, featureCode);
    return status.isEnabled;
  }

  /**
   * Get detailed feature status including source
   */
  static async getFeatureStatus(associationId: number, featureCode: string): Promise<FeatureStatus> {
    // 1. Check tenant override (highest priority)
    const tenantOverride = await prisma.tenantFeature.findFirst({
      where: {
        associationId,
        feature: { code: featureCode },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { 
        feature: {
          include: { module: true }
        }
      }
    });

    if (tenantOverride) {
      return {
        code: featureCode,
        name: tenantOverride.feature.name,
        moduleCode: tenantOverride.feature.module.code,
        isEnabled: tenantOverride.isEnabled,
        source: 'tenant_override',
        expiresAt: tenantOverride.expiresAt,
      };
    }

    // 2. Check plan assignment
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING'] } },
          include: {
            plan: {
              include: {
                planFeatures: {
                  where: { feature: { code: featureCode } },
                  include: { 
                    feature: {
                      include: { module: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const planFeature = association?.subscriptions[0]?.plan?.planFeatures[0];
    if (planFeature) {
      return {
        code: featureCode,
        name: planFeature.feature.name,
        moduleCode: planFeature.feature.module.code,
        isEnabled: planFeature.isEnabled,
        source: 'plan',
      };
    }

    // 3. Get feature info for default response
    const feature = await prisma.platformFeature.findUnique({
      where: { code: featureCode },
      include: { module: true }
    });

    // 4. Default when no explicit PlanFeature row exists: core features only (G13),
    // same reconciliation as getModuleStatus() above.
    return {
      code: featureCode,
      name: feature?.name || featureCode,
      moduleCode: feature?.module.code || 'unknown',
      isEnabled: feature?.isCore ?? true,
      source: 'default',
    };
  }

  /**
   * Get all enabled modules for an association (optimized batch query)
   */
  static async getEnabledModules(associationId: number): Promise<ModuleStatus[]> {
    // Batch fetch all data in parallel
    const [allModules, tenantOverrides, association] = await Promise.all([
      prisma.platformModule.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.tenantModule.findMany({
        where: {
          associationId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        include: { module: true }
      }),
      prisma.association.findUnique({
        where: { id: associationId },
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: {
              plan: {
                include: {
                  planModules: { include: { module: true } }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    ]);

    // Create lookup maps for O(1) access
    const overrideMap = new Map(tenantOverrides.map(o => [o.module.code, o]));
    const planModules = association?.subscriptions[0]?.plan?.planModules || [];
    const planModuleMap = new Map(planModules.map(pm => [pm.module.code, pm]));

    // Build status for each module
    return allModules.map(module => {
      const override = overrideMap.get(module.code);
      if (override) {
        return {
          code: module.code,
          name: module.name,
          isCore: module.isCore,
          isEnabled: override.isEnabled,
          source: 'tenant_override' as const,
          override: {
            reason: override.reason || '',
            expiresAt: override.expiresAt?.toISOString() || null,
          }
        };
      }

      const planModule = planModuleMap.get(module.code);
      if (planModule) {
        return {
          code: module.code,
          name: module.name,
          isCore: module.isCore,
          isEnabled: planModule.isEnabled,
          source: 'plan' as const,
        };
      }

      // Default: core modules enabled, others disabled
      return {
        code: module.code,
        name: module.name,
        isCore: module.isCore,
        isEnabled: module.isCore,
        source: 'default' as const,
      };
    });
  }

  /**
   * Get all enabled features for an association (optimized batch query)
   */
  static async getEnabledFeatures(associationId: number): Promise<FeatureStatus[]> {
    // Batch fetch all data in parallel
    const [allFeatures, tenantOverrides, association] = await Promise.all([
      prisma.platformFeature.findMany({
        include: { module: true },
        orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }]
      }),
      prisma.tenantFeature.findMany({
        where: {
          associationId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        },
        include: { feature: { include: { module: true } } }
      }),
      prisma.association.findUnique({
        where: { id: associationId },
        include: {
          subscriptions: {
            where: { status: { in: ['ACTIVE', 'TRIALING'] } },
            include: {
              plan: {
                include: {
                  planFeatures: { include: { feature: { include: { module: true } } } }
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    ]);

    // Create lookup maps
    const overrideMap = new Map(tenantOverrides.map(o => [o.feature.code, o]));
    const planFeatures = association?.subscriptions[0]?.plan?.planFeatures || [];
    const planFeatureMap = new Map(planFeatures.map(pf => [pf.feature.code, pf]));

    // Build status for each feature
    return allFeatures.map(feature => {
      const override = overrideMap.get(feature.code);
      if (override) {
        return {
          code: feature.code,
          name: feature.name,
          moduleCode: feature.module.code,
          isEnabled: override.isEnabled,
          source: 'tenant_override' as const,
          override: {
            reason: override.reason || '',
            expiresAt: override.expiresAt?.toISOString() || null,
          }
        };
      }

      const planFeature = planFeatureMap.get(feature.code);
      if (planFeature) {
        return {
          code: feature.code,
          name: feature.name,
          moduleCode: feature.module.code,
          isEnabled: planFeature.isEnabled,
          source: 'plan' as const,
        };
      }

      // Default: core features only (G13) — matches getEnabledModules()'s batch
      // default and the now-reconciled getFeatureStatus() per-check default.
      return {
        code: feature.code,
        name: feature.name,
        moduleCode: feature.module.code,
        isEnabled: feature.isCore,
        source: 'default' as const,
      };
    });
  }

  /**
   * Get modules grouped by enabled status
   */
  static async getModulesSummary(associationId: number): Promise<{
    enabled: ModuleStatus[];
    disabled: ModuleStatus[];
  }> {
    const allStatuses = await this.getEnabledModules(associationId);
    return {
      enabled: allStatuses.filter(s => s.isEnabled),
      disabled: allStatuses.filter(s => !s.isEnabled),
    };
  }

  /**
   * Set tenant module override
   */
  static async setModuleOverride(
    associationId: number,
    moduleCode: string,
    isEnabled: boolean,
    overriddenBy: number,
    options?: {
      reason?: string;
      overrideType?: 'MANUAL' | 'TRIAL' | 'PROMOTION' | 'SUPPORT' | 'COMPLIANCE';
      expiresAt?: Date;
    }
  ): Promise<void> {
    const module = await prisma.platformModule.findUnique({
      where: { code: moduleCode }
    });

    if (!module) {
      throw new Error(`Module '${moduleCode}' not found`);
    }

    // Don't allow disabling core modules
    if (module.isCore && !isEnabled) {
      throw new Error(`Cannot disable core module '${moduleCode}'`);
    }

    await prisma.tenantModule.upsert({
      where: {
        associationId_moduleId: {
          associationId,
          moduleId: module.id,
        }
      },
      update: {
        isEnabled,
        overrideType: options?.overrideType || 'MANUAL',
        reason: options?.reason,
        overriddenBy,
        expiresAt: options?.expiresAt,
      },
      create: {
        associationId,
        moduleId: module.id,
        isEnabled,
        overrideType: options?.overrideType || 'MANUAL',
        reason: options?.reason,
        overriddenBy,
        expiresAt: options?.expiresAt,
      }
    });
  }

  /**
   * Remove tenant module override (revert to plan default)
   */
  static async removeModuleOverride(associationId: number, moduleCode: string): Promise<void> {
    const module = await prisma.platformModule.findUnique({
      where: { code: moduleCode }
    });

    if (!module) {
      throw new Error(`Module '${moduleCode}' not found`);
    }

    await prisma.tenantModule.deleteMany({
      where: {
        associationId,
        moduleId: module.id,
      }
    });
  }

  /**
   * Set tenant feature override
   */
  static async setFeatureOverride(
    associationId: number,
    featureCode: string,
    isEnabled: boolean,
    overriddenBy: number,
    options?: {
      reason?: string;
      overrideType?: 'MANUAL' | 'TRIAL' | 'PROMOTION' | 'SUPPORT' | 'COMPLIANCE';
      expiresAt?: Date;
    }
  ): Promise<void> {
    const feature = await prisma.platformFeature.findUnique({
      where: { code: featureCode }
    });

    if (!feature) {
      throw new Error(`Feature '${featureCode}' not found`);
    }

    await prisma.tenantFeature.upsert({
      where: {
        associationId_featureId: {
          associationId,
          featureId: feature.id,
        }
      },
      update: {
        isEnabled,
        overrideType: options?.overrideType || 'MANUAL',
        reason: options?.reason,
        overriddenBy,
        expiresAt: options?.expiresAt,
      },
      create: {
        associationId,
        featureId: feature.id,
        isEnabled,
        overrideType: options?.overrideType || 'MANUAL',
        reason: options?.reason,
        overriddenBy,
        expiresAt: options?.expiresAt,
      }
    });
  }

  /**
   * Remove tenant feature override (revert to plan default)
   */
  static async removeFeatureOverride(associationId: number, featureCode: string): Promise<void> {
    const feature = await prisma.platformFeature.findUnique({
      where: { code: featureCode }
    });

    if (!feature) {
      throw new Error(`Feature '${featureCode}' not found`);
    }

    await prisma.tenantFeature.deleteMany({
      where: {
        associationId,
        featureId: feature.id,
      }
    });
  }

  /**
   * Get all platform modules (for admin UI)
   */
  static async getAllModules() {
    return prisma.platformModule.findMany({
      include: {
        features: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
  }

  /**
   * Get all platform features (for admin UI)
   */
  static async getAllFeatures() {
    return prisma.platformFeature.findMany({
      include: { module: true },
      orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }]
    });
  }
}
