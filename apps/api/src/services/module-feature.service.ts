/**
 * Module & Feature Service
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 *
 * Answers "is this module/feature enabled for this tenant" for the middleware and the admin screens. The answer is computed by the
 * entitlements service (core + the subscription's plan version + live add-ons, then per-tenant overrides), so there is exactly one rule
 * and it follows the plan version each tenant was sold, never the plan's latest definition.
 */

import prisma from '../lib/prisma';
import { getEntitlements, invalidateEntitlements } from './billing/entitlements.service';

export interface ModuleStatus {
  code: string;
  name: string;
  isEnabled: boolean;
  source: 'tenant_override' | 'plan' | 'addon' | 'default';
  expiresAt?: Date | null;
}

export interface FeatureStatus {
  code: string;
  name: string;
  moduleCode: string;
  isEnabled: boolean;
  source: 'tenant_override' | 'plan' | 'addon' | 'default';
  expiresAt?: Date | null;
}

export class ModuleFeatureService {
  /**
   * Check if a module is enabled for an association
   */
  static async isModuleEnabled(associationId: number, moduleCode: string): Promise<boolean> {
    const status = await this.getModuleStatus(associationId, moduleCode);
    return status.isEnabled;
  }

  /**
   * Get detailed module status including where the answer came from
   */
  static async getModuleStatus(associationId: number, moduleCode: string): Promise<ModuleStatus> {
    const ent = await getEntitlements(associationId);
    const m = ent.modules.get(moduleCode);
    if (!m) {
      // An unknown module code is not part of the catalog, so nothing grants it.
      return { code: moduleCode, name: moduleCode, isEnabled: false, source: 'default' };
    }
    return {
      code: m.code,
      name: m.name,
      isEnabled: m.isEnabled,
      source: m.source,
      expiresAt: m.override?.expiresAt ? new Date(m.override.expiresAt) : null,
    };
  }

  /**
   * Check if a feature is enabled for an association
   */
  static async isFeatureEnabled(associationId: number, featureCode: string): Promise<boolean> {
    const status = await this.getFeatureStatus(associationId, featureCode);
    return status.isEnabled;
  }

  /**
   * Get detailed feature status including where the answer came from
   */
  static async getFeatureStatus(associationId: number, featureCode: string): Promise<FeatureStatus> {
    const ent = await getEntitlements(associationId);
    const f = ent.features.get(featureCode);
    if (!f) {
      return { code: featureCode, name: featureCode, moduleCode: 'unknown', isEnabled: false, source: 'default' };
    }
    return {
      code: f.code,
      name: f.name,
      moduleCode: f.moduleCode,
      isEnabled: f.isEnabled,
      source: f.source,
      expiresAt: f.override?.expiresAt ? new Date(f.override.expiresAt) : null,
    };
  }

  /**
   * Get every module with its status for an association
   */
  static async getEnabledModules(associationId: number): Promise<ModuleStatus[]> {
    const ent = await getEntitlements(associationId);
    return [...ent.modules.values()].map((m) => ({
      code: m.code,
      name: m.name,
      isCore: m.isCore,
      isEnabled: m.isEnabled,
      source: m.source,
      ...(m.override ? { override: m.override } : {}),
    }));
  }

  /**
   * Get every feature with its status for an association
   */
  static async getEnabledFeatures(associationId: number): Promise<FeatureStatus[]> {
    const ent = await getEntitlements(associationId);
    return [...ent.features.values()].map((f) => ({
      code: f.code,
      name: f.name,
      moduleCode: f.moduleCode,
      isEnabled: f.isEnabled,
      source: f.source,
      ...(f.override ? { override: f.override } : {}),
    }));
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
    invalidateEntitlements(associationId);
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
    invalidateEntitlements(associationId);
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
    invalidateEntitlements(associationId);
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
    invalidateEntitlements(associationId);
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
