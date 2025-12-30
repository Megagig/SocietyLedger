/**
 * RBAC Monitoring and Analytics Utility
 * 
 * This utility helps monitor the RBAC migration and provides insights
 * into permission usage, mismatches, and system health.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PermissionMismatch {
  userId: number;
  associationId: number | null;
  permission: string;
  legacyResult: boolean;
  newResult: boolean;
  timestamp: Date;
  route?: string;
  method?: string;
}

export interface RBACAnalytics {
  totalPermissionChecks: number;
  totalMismatches: number;
  mismatchRate: number;
  topMismatchedPermissions: Array<{
    permission: string;
    count: number;
  }>;
  usersMostAffected: Array<{
    userId: number;
    mismatchCount: number;
  }>;
  associationBreakdown: Array<{
    associationId: number;
    mismatchCount: number;
  }>;
}

export class RBACMonitor {
  private static mismatches: PermissionMismatch[] = [];
  private static readonly MAX_MISMATCHES = 10000; // Prevent memory issues

  /**
   * Log a permission mismatch for analysis
   */
  static logMismatch(mismatch: PermissionMismatch): void {
    this.mismatches.push(mismatch);
    
    // Prevent memory overflow
    if (this.mismatches.length > this.MAX_MISMATCHES) {
      this.mismatches = this.mismatches.slice(-this.MAX_MISMATCHES / 2);
    }

    // Log critical mismatches immediately
    if (this.isCriticalMismatch(mismatch)) {
      console.error('🚨 Critical RBAC Mismatch:', mismatch);
    }
  }

  /**
   * Get analytics about RBAC mismatches
   */
  static getAnalytics(timeRange?: { start: Date; end: Date }): RBACAnalytics {
    let relevantMismatches = this.mismatches;

    if (timeRange) {
      relevantMismatches = this.mismatches.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const totalChecks = relevantMismatches.length;
    const totalMismatches = relevantMismatches.length;
    const mismatchRate = totalChecks > 0 ? (totalMismatches / totalChecks) * 100 : 0;

    // Count mismatches by permission
    const permissionCounts = new Map<string, number>();
    relevantMismatches.forEach(m => {
      permissionCounts.set(m.permission, (permissionCounts.get(m.permission) || 0) + 1);
    });

    const topMismatchedPermissions = Array.from(permissionCounts.entries())
      .map(([permission, count]) => ({ permission, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count mismatches by user
    const userCounts = new Map<number, number>();
    relevantMismatches.forEach(m => {
      userCounts.set(m.userId, (userCounts.get(m.userId) || 0) + 1);
    });

    const usersMostAffected = Array.from(userCounts.entries())
      .map(([userId, mismatchCount]) => ({ userId, mismatchCount }))
      .sort((a, b) => b.mismatchCount - a.mismatchCount)
      .slice(0, 10);

    // Count mismatches by association
    const associationCounts = new Map<number, number>();
    relevantMismatches.forEach(m => {
      if (m.associationId) {
        associationCounts.set(m.associationId, (associationCounts.get(m.associationId) || 0) + 1);
      }
    });

    const associationBreakdown = Array.from(associationCounts.entries())
      .map(([associationId, mismatchCount]) => ({ associationId, mismatchCount }))
      .sort((a, b) => b.mismatchCount - a.mismatchCount);

    return {
      totalPermissionChecks: totalChecks,
      totalMismatches,
      mismatchRate,
      topMismatchedPermissions,
      usersMostAffected,
      associationBreakdown
    };
  }

  /**
   * Generate a detailed RBAC health report
   */
  static async generateHealthReport(): Promise<any> {
    const analytics = this.getAnalytics();
    
    // Get database statistics
    const dbStats = await this.getDatabaseStats();
    
    // Get permission usage statistics
    const usageStats = await this.getPermissionUsageStats();

    return {
      timestamp: new Date().toISOString(),
      rbacMode: process.env.RBAC_MODE || 'legacy',
      analytics,
      database: dbStats,
      usage: usageStats,
      recommendations: this.generateRecommendations(analytics)
    };
  }

  /**
   * Get database statistics
   */
  private static async getDatabaseStats(): Promise<any> {
    try {
      const [
        permissionCount,
        roleCount,
        userRoleCount,
        activeUserCount,
        associationCount
      ] = await Promise.all([
        prisma.permission.count({ where: { isActive: true } }),
        prisma.role.count({ where: { isActive: true } }),
        prisma.userRole.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.association.count()
      ]);

      return {
        permissions: permissionCount,
        roles: roleCount,
        userRoles: userRoleCount,
        activeUsers: activeUserCount,
        associations: associationCount
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return { error: 'Unable to fetch database statistics' };
    }
  }

  /**
   * Get permission usage statistics from audit logs
   */
  private static async getPermissionUsageStats(): Promise<any> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: { in: ['PERMISSION_GRANTED', 'PERMISSION_DENIED'] },
          createdAt: { gte: last24Hours }
        },
        select: {
          action: true,
          newValues: true,
          createdAt: true
        }
      });

      const granted = auditLogs.filter(log => log.action === 'PERMISSION_GRANTED').length;
      const denied = auditLogs.filter(log => log.action === 'PERMISSION_DENIED').length;
      const total = granted + denied;

      return {
        last24Hours: {
          total,
          granted,
          denied,
          denialRate: total > 0 ? (denied / total) * 100 : 0
        }
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      return { error: 'Unable to fetch usage statistics' };
    }
  }

  /**
   * Generate recommendations based on analytics
   */
  private static generateRecommendations(analytics: RBACAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.mismatchRate > 10) {
      recommendations.push(
        `High mismatch rate (${analytics.mismatchRate.toFixed(1)}%). Review permission mappings before switching to hybrid mode.`
      );
    }

    if (analytics.mismatchRate < 1) {
      recommendations.push(
        `Low mismatch rate (${analytics.mismatchRate.toFixed(1)}%). Consider switching to hybrid mode.`
      );
    }

    if (analytics.topMismatchedPermissions.length > 0) {
      const topPermission = analytics.topMismatchedPermissions[0];
      recommendations.push(
        `Most problematic permission: "${topPermission.permission}" (${topPermission.count} mismatches). Review its mapping.`
      );
    }

    if (analytics.usersMostAffected.length > 0) {
      recommendations.push(
        `${analytics.usersMostAffected.length} users experiencing multiple mismatches. Consider user-specific role review.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('RBAC system appears to be functioning well. No immediate action required.');
    }

    return recommendations;
  }

  /**
   * Check if a mismatch is critical (affects admin operations)
   */
  private static isCriticalMismatch(mismatch: PermissionMismatch): boolean {
    const criticalPermissions = [
      'members.create',
      'members.edit_all',
      'members.disable',
      'ledger.create',
      'ledger.edit',
      'payments.approve',
      'roles.assign',
      'permissions.manage'
    ];

    return criticalPermissions.includes(mismatch.permission);
  }

  /**
   * Export mismatches to CSV for analysis
   */
  static exportMismatchesToCSV(): string {
    const headers = [
      'Timestamp',
      'User ID',
      'Association ID',
      'Permission',
      'Legacy Result',
      'New Result',
      'Route',
      'Method'
    ];

    const rows = this.mismatches.map(m => [
      m.timestamp.toISOString(),
      m.userId.toString(),
      m.associationId?.toString() || '',
      m.permission,
      m.legacyResult.toString(),
      m.newResult.toString(),
      m.route || '',
      m.method || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Clear stored mismatches (useful for testing)
   */
  static clearMismatches(): void {
    this.mismatches = [];
  }

  /**
   * Get current mismatch count
   */
  static getMismatchCount(): number {
    return this.mismatches.length;
  }
}

/**
 * Express middleware to monitor RBAC health
 */
export function rbacHealthMiddleware() {
  return async (req: any, res: any, next: any) => {
    if (req.path === '/api/health/rbac' && req.method === 'GET') {
      try {
        const healthReport = await RBACMonitor.generateHealthReport();
        return res.json({
          success: true,
          data: healthReport
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate RBAC health report',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    next();
  };
}