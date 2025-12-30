/**
 * Platform Modules & Features Seed
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Seeds the platform modules, features, and plan-module assignments
 * that define what functionality is available per subscription tier.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Platform Module Definitions
const PLATFORM_MODULES = [
  {
    code: 'members',
    name: 'Member Management',
    description: 'Core member lifecycle management, profiles, and categorization',
    isCore: true,
    sortOrder: 1,
  },
  {
    code: 'ledger',
    name: 'Financial Ledger',
    description: 'Financial transactions, dues, levies, donations, and penalties',
    isCore: true,
    sortOrder: 2,
  },
  {
    code: 'payments',
    name: 'Payment Processing',
    description: 'Payment recording, receipts, and payment gateway integrations',
    isCore: true,
    sortOrder: 3,
  },
  {
    code: 'notifications',
    name: 'Notifications',
    description: 'In-app notifications, email notifications, and announcements',
    isCore: false,
    sortOrder: 4,
  },
  {
    code: 'reports',
    name: 'Reports & Analytics',
    description: 'Financial reports, member reports, and analytics dashboards',
    isCore: false,
    sortOrder: 5,
  },
  {
    code: 'audit',
    name: 'Audit & Compliance',
    description: 'Audit logs, activity tracking, and compliance tools',
    isCore: false,
    sortOrder: 6,
  },
  {
    code: 'welfare',
    name: 'Welfare & Social Funds',
    description: 'Welfare funds, contributions, and payout management',
    isCore: false,
    sortOrder: 7,
  },
  {
    code: 'voting',
    name: 'Voting & Elections',
    description: 'Elections, polls, candidates, and voting management',
    isCore: false,
    sortOrder: 8,
  },
  {
    code: 'meetings',
    name: 'Meetings & Attendance',
    description: 'Meeting scheduling, attendance tracking, and minutes',
    isCore: false,
    sortOrder: 9,
  },
  {
    code: 'sms',
    name: 'SMS & Bulk Communication',
    description: 'SMS messaging, campaigns, and bulk communication',
    isCore: false,
    sortOrder: 10,
  },
  {
    code: 'accounting',
    name: 'Accounting System',
    description: 'Chart of accounts, journal entries, P&L, balance sheet',
    isCore: false,
    sortOrder: 11,
  },
  {
    code: 'cooperatives',
    name: 'Cooperatives & Loans',
    description: 'Savings accounts, loan products, and loan management',
    isCore: false,
    sortOrder: 12,
  },
  {
    code: 'integrations',
    name: 'Integrations & API',
    description: 'API access, webhooks, and third-party integrations',
    isCore: false,
    sortOrder: 13,
  },
  {
    code: 'ai',
    name: 'AI Integration',
    description: 'AI financial assistant, smart reports, and natural language queries',
    isCore: false,
    sortOrder: 14,
  },
];

// Platform Feature Definitions (fine-grained)
const PLATFORM_FEATURES = [
  // Members module features
  { moduleCode: 'members', code: 'members.bulk_import', name: 'Bulk Member Import', description: 'Import members from CSV/Excel files' },
  { moduleCode: 'members', code: 'members.custom_roles', name: 'Custom Roles', description: 'Create and manage custom roles' },
  { moduleCode: 'members', code: 'members.export', name: 'Member Export', description: 'Export member data to CSV/Excel' },
  
  // Ledger module features
  { moduleCode: 'ledger', code: 'ledger.export', name: 'Ledger Export', description: 'Export ledger data to PDF/Excel' },
  { moduleCode: 'ledger', code: 'ledger.bulk_transactions', name: 'Bulk Transactions', description: 'Create transactions in bulk' },
  { moduleCode: 'ledger', code: 'ledger.advanced_penalties', name: 'Advanced Penalties', description: 'Automated late fee calculation and penalty rules' },
  
  // Reports module features
  { moduleCode: 'reports', code: 'reports.custom', name: 'Custom Reports', description: 'Build custom report templates' },
  { moduleCode: 'reports', code: 'reports.scheduled', name: 'Scheduled Reports', description: 'Schedule automatic report generation' },
  { moduleCode: 'reports', code: 'reports.export_pdf', name: 'PDF Export', description: 'Export reports to PDF with branding' },
  { moduleCode: 'reports', code: 'reports.export_excel', name: 'Excel Export', description: 'Export reports to Excel' },
  
  // Audit module features
  { moduleCode: 'audit', code: 'audit.export', name: 'Audit Export', description: 'Export audit logs' },
  { moduleCode: 'audit', code: 'audit.advanced', name: 'Advanced Audit', description: 'Advanced audit analytics and filtering' },
  
  // Integrations module features
  { moduleCode: 'integrations', code: 'integrations.api_access', name: 'API Access', description: 'REST API access for integrations' },
  { moduleCode: 'integrations', code: 'integrations.webhooks', name: 'Webhooks', description: 'Configure webhook endpoints' },
  
  // AI module features
  { moduleCode: 'ai', code: 'ai.financial_assistant', name: 'Financial Assistant', description: 'AI-powered financial queries' },
  { moduleCode: 'ai', code: 'ai.smart_reports', name: 'Smart Reports', description: 'AI-generated report summaries' },
  { moduleCode: 'ai', code: 'ai.document_qa', name: 'Document Q&A', description: 'AI-powered document question answering' },
];

// Plan-Module Assignments
// Defines which modules are available for each plan
const PLAN_MODULE_ASSIGNMENTS: Record<string, string[]> = {
  STARTER: [
    'members',
    'ledger',
    'payments',
    'notifications',
  ],
  PROFESSIONAL: [
    'members',
    'ledger',
    'payments',
    'notifications',
    'reports',
    'audit',
    'welfare',
    'voting',
    'meetings',
    'sms',
  ],
  ENTERPRISE: [
    'members',
    'ledger',
    'payments',
    'notifications',
    'reports',
    'audit',
    'welfare',
    'voting',
    'meetings',
    'sms',
    'accounting',
    'cooperatives',
    'integrations',
    'ai',
  ],
};

// Plan-Feature Assignments
// Defines which features are available for each plan
const PLAN_FEATURE_ASSIGNMENTS: Record<string, string[]> = {
  STARTER: [
    'members.export',
  ],
  PROFESSIONAL: [
    'members.bulk_import',
    'members.custom_roles',
    'members.export',
    'ledger.export',
    'ledger.bulk_transactions',
    'ledger.advanced_penalties',
    'reports.export_pdf',
    'reports.export_excel',
    'audit.export',
  ],
  ENTERPRISE: [
    'members.bulk_import',
    'members.custom_roles',
    'members.export',
    'ledger.export',
    'ledger.bulk_transactions',
    'ledger.advanced_penalties',
    'reports.custom',
    'reports.scheduled',
    'reports.export_pdf',
    'reports.export_excel',
    'audit.export',
    'audit.advanced',
    'integrations.api_access',
    'integrations.webhooks',
    'ai.financial_assistant',
    'ai.smart_reports',
    'ai.document_qa',
  ],
};

export async function seedPlatformModules() {
  console.log('🌱 Seeding platform modules...');

  // Create or update modules
  for (const moduleData of PLATFORM_MODULES) {
    await prisma.platformModule.upsert({
      where: { code: moduleData.code },
      update: {
        name: moduleData.name,
        description: moduleData.description,
        isCore: moduleData.isCore,
        sortOrder: moduleData.sortOrder,
      },
      create: moduleData,
    });
  }

  console.log(`✅ Created/updated ${PLATFORM_MODULES.length} platform modules`);

  // Create or update features
  for (const featureData of PLATFORM_FEATURES) {
    const module = await prisma.platformModule.findUnique({
      where: { code: featureData.moduleCode },
    });

    if (!module) {
      console.warn(`⚠️ Module ${featureData.moduleCode} not found for feature ${featureData.code}`);
      continue;
    }

    await prisma.platformFeature.upsert({
      where: { code: featureData.code },
      update: {
        name: featureData.name,
        description: featureData.description,
        moduleId: module.id,
      },
      create: {
        code: featureData.code,
        name: featureData.name,
        description: featureData.description,
        moduleId: module.id,
      },
    });
  }

  console.log(`✅ Created/updated ${PLATFORM_FEATURES.length} platform features`);

  // Get all plans
  const plans = await prisma.plan.findMany();
  
  if (plans.length === 0) {
    console.warn('⚠️ No plans found. Run plan seed first.');
    return;
  }

  // Create plan-module assignments
  let planModuleCount = 0;
  for (const plan of plans) {
    const planCode = plan.code.toUpperCase();
    const moduleAssignments = PLAN_MODULE_ASSIGNMENTS[planCode] || PLAN_MODULE_ASSIGNMENTS.STARTER;

    for (const moduleCode of moduleAssignments) {
      const module = await prisma.platformModule.findUnique({
        where: { code: moduleCode },
      });

      if (!module) continue;

      await prisma.planModule.upsert({
        where: {
          planId_moduleId: {
            planId: plan.id,
            moduleId: module.id,
          },
        },
        update: { isEnabled: true },
        create: {
          planId: plan.id,
          moduleId: module.id,
          isEnabled: true,
        },
      });
      planModuleCount++;
    }
  }

  console.log(`✅ Created/updated ${planModuleCount} plan-module assignments`);

  // Create plan-feature assignments
  let planFeatureCount = 0;
  for (const plan of plans) {
    const planCode = plan.code.toUpperCase();
    const featureAssignments = PLAN_FEATURE_ASSIGNMENTS[planCode] || PLAN_FEATURE_ASSIGNMENTS.STARTER;

    for (const featureCode of featureAssignments) {
      const feature = await prisma.platformFeature.findUnique({
        where: { code: featureCode },
      });

      if (!feature) continue;

      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: plan.id,
            featureId: feature.id,
          },
        },
        update: { isEnabled: true },
        create: {
          planId: plan.id,
          featureId: feature.id,
          isEnabled: true,
        },
      });
      planFeatureCount++;
    }
  }

  console.log(`✅ Created/updated ${planFeatureCount} plan-feature assignments`);
  console.log('🎉 Platform modules seed completed!');
}

// Run if executed directly
if (require.main === module) {
  seedPlatformModules()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
