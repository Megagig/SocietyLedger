/**
 * Platform Modules & Features Seed
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Seeds the catalog of platform modules and features (the things a plan can include).
 * Plan contents are NOT set here: they live on plan versions, managed in the Plan Builder.
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
    code: 'ai',
    name: 'AI Integration',
    description: 'AI financial assistant, smart reports, and natural language queries',
    isCore: false,
    sortOrder: 14,
  },
  {
    // Add-on only: in no default plan. Sold as the four Ajo tiers (see ajo-addons.seed.ts).
    code: 'ajo',
    name: 'Ajo / Thrift',
    description: 'Savings circles: collector thrift and rotating pots, with contributions, payouts and reports',
    isCore: false,
    sortOrder: 15,
  },
];

// Platform Feature Definitions (fine-grained)
const PLATFORM_FEATURES = [
  // Members module features
  { moduleCode: 'members', code: 'members.bulk_import', name: 'Bulk Member Import', description: 'Import many members at once from a spreadsheet' },
  { moduleCode: 'members', code: 'members.custom_roles', name: 'Custom Roles', description: 'Create, edit and delete your own roles with custom permissions' },
  { moduleCode: 'members', code: 'members.export', name: 'Member Export', description: 'Export members to Excel and download member statements as PDF' },
  
  // Ledger module features
  { moduleCode: 'ledger', code: 'ledger.export', name: 'Ledger Export', description: 'Download a member ledger statement as PDF' },
  { moduleCode: 'ledger', code: 'ledger.bulk_transactions', name: 'Bulk Transactions', description: 'Create, edit, delete and mark many transactions as paid at once' },
  { moduleCode: 'ledger', code: 'ledger.advanced_penalties', name: 'Advanced Penalties', description: 'Penalty rules and automatic late fees' },
  
  // Reports module features
  { moduleCode: 'reports', code: 'reports.custom', name: 'Custom Reports', description: 'Export a report with the fields you choose' },
  { moduleCode: 'reports', code: 'reports.export_pdf', name: 'Financial PDF Export', description: 'Export the financial summary as a PDF' },
  { moduleCode: 'reports', code: 'reports.export_excel', name: 'Financial Excel Export', description: 'Export the financial summary as an Excel file' },
  
  // Audit module features
  
  // Integrations module features
  
  // AI module features
  { moduleCode: 'ai', code: 'ai.financial_assistant', name: 'Financial Assistant', description: 'Ask the assistant questions about your finances and chat with it' },
  { moduleCode: 'ai', code: 'ai.smart_reports', name: 'Smart Reports', description: 'Have the assistant write a report summary for you' },

  // Ajo module features
  { moduleCode: 'ajo', code: 'ajo.collector_thrift', name: 'Collector management', description: 'Assign collectors to contributors, record daily collections, cash hand-overs and targets' },
  { moduleCode: 'ajo', code: 'ajo.rotating_pot', name: 'Rotating pots', description: 'Rotating pot groups with a recorded draw, swaps and payout order' },
  { moduleCode: 'ajo', code: 'ajo.guarantors', name: 'Guarantors', description: 'Record a guarantor\'s consent before a member joins a group' },
  { moduleCode: 'ajo', code: 'ajo.reminders', name: 'Automated reminders', description: 'Reminders before and after a contribution is due' },
  { moduleCode: 'ajo', code: 'ajo.advanced_reports', name: 'Advanced reports', description: 'Collector performance, defaults and arrears, and fees and revenue reports with CSV and PDF exports' },
  { moduleCode: 'ajo', code: 'ajo.audit_reports', name: 'Audit reports', description: 'The audit and activity report: approvals, reversals, waivers and changes, with who, when and why' },
];

/**
 * Things that were once in the catalog but have nothing behind them in the product, so a plan must not be able to promise them.
 * Removing a row also removes it from any plan version that included it.
 */
const RETIRED_FEATURES = ['reports.scheduled', 'audit.export', 'audit.advanced', 'integrations.api_access', 'integrations.webhooks', 'ai.document_qa'];
const RETIRED_MODULES = ['integrations'];

export async function seedPlatformModules() {
  console.log('🌱 Seeding platform modules...');

  const retiredFeatures = await prisma.platformFeature.deleteMany({ where: { code: { in: RETIRED_FEATURES } } });
  const retiredModules = await prisma.platformModule.deleteMany({ where: { code: { in: RETIRED_MODULES } } });
  if (retiredFeatures.count + retiredModules.count > 0) {
    console.log(`🧹 Retired ${retiredModules.count} module(s) and ${retiredFeatures.count} feature(s) that had nothing behind them`);
  }

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

  // Which plan includes which module is configured in the Plan Builder (and created once by plans.seed.ts); this script only
  // maintains the catalog of what exists, so running it never changes what a plan includes.
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
