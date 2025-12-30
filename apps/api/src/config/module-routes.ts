/**
 * Module Routes Configuration
 * Phase 19: SaaS Owner / Super Admin Platform Controls
 * 
 * Maps API routes to their required modules and features.
 * Used for automatic module/feature enforcement.
 */

export interface RouteModuleMapping {
  pattern: string | RegExp;
  module?: string;
  feature?: string;
  description?: string;
}

/**
 * Route to module/feature mappings
 * Routes are matched in order - first match wins
 */
export const routeModuleMappings: RouteModuleMapping[] = [
  // Core modules (always enabled for all plans)
  { pattern: /^\/api\/members/, module: 'members', description: 'Member management' },
  { pattern: /^\/api\/auth/, module: 'members', description: 'Authentication' },
  
  // Financial modules
  { pattern: /^\/api\/finance\/transactions/, module: 'ledger', description: 'Financial transactions' },
  { pattern: /^\/api\/finance\/categories/, module: 'ledger', description: 'Financial categories' },
  { pattern: /^\/api\/finance\/payments/, module: 'payments', description: 'Payment processing' },
  { pattern: /^\/api\/finance\/dashboard/, module: 'ledger', description: 'Financial dashboard' },
  
  // Advanced financial features
  { pattern: /^\/api\/finance\/levies/, module: 'levies', description: 'Levy campaigns' },
  { pattern: /^\/api\/finance\/donations/, module: 'donations', description: 'Donation management' },
  { pattern: /^\/api\/finance\/penalties/, module: 'penalties', description: 'Penalty management' },
  
  // Accounting module (Professional+)
  { pattern: /^\/api\/accounting/, module: 'accounting', description: 'Full accounting system' },
  
  // Welfare module (Professional+)
  { pattern: /^\/api\/welfare\/payouts/, module: 'welfare', feature: 'welfare_payouts', description: 'Welfare payouts' },
  { pattern: /^\/api\/welfare/, module: 'welfare', description: 'Welfare fund management' },
  
  // Governance modules (Professional+)
  { pattern: /^\/api\/elections/, module: 'voting', description: 'Elections management' },
  { pattern: /^\/api\/polls/, module: 'voting', feature: 'quick_polls', description: 'Quick polls' },
  { pattern: /^\/api\/meetings/, module: 'meetings', description: 'Meetings & attendance' },
  
  // Communication modules
  { pattern: /^\/api\/sms/, module: 'sms', description: 'SMS messaging' },
  { pattern: /^\/api\/notifications/, module: 'notifications', description: 'Notifications' },
  
  // Reporting & exports
  { pattern: /^\/api\/reports/, module: 'reports', description: 'Reports generation' },
  { pattern: /^\/api\/exports/, module: 'reports', feature: 'advanced_exports', description: 'Data exports' },
  
  // Cooperative features (Enterprise only)
  { pattern: /^\/api\/cooperatives\/loans/, module: 'loans', description: 'Loan management' },
  { pattern: /^\/api\/cooperatives\/savings/, module: 'savings', description: 'Savings accounts' },
  { pattern: /^\/api\/cooperatives/, module: 'cooperatives', description: 'Cooperative features' },
  
  // AI features
  { pattern: /^\/api\/ai/, module: 'ai_assistant', description: 'AI assistant' },
  
  // Settings & configuration
  { pattern: /^\/api\/settings/, module: 'settings', description: 'Association settings' },
];

/**
 * Get the module/feature requirement for a given route
 */
export function getRouteRequirement(path: string): RouteModuleMapping | null {
  for (const mapping of routeModuleMappings) {
    if (typeof mapping.pattern === 'string') {
      if (path.startsWith(mapping.pattern)) {
        return mapping;
      }
    } else if (mapping.pattern instanceof RegExp) {
      if (mapping.pattern.test(path)) {
        return mapping;
      }
    }
  }
  return null;
}

/**
 * Module codes and their descriptions
 */
export const moduleDefinitions = {
  // Core modules (Starter+)
  members: { name: 'Member Management', tier: 'STARTER', isCore: true },
  ledger: { name: 'Financial Ledger', tier: 'STARTER', isCore: true },
  payments: { name: 'Payment Processing', tier: 'STARTER', isCore: true },
  notifications: { name: 'Notifications', tier: 'STARTER', isCore: true },
  settings: { name: 'Settings', tier: 'STARTER', isCore: true },
  
  // Standard modules (Starter+)
  levies: { name: 'Levy Campaigns', tier: 'STARTER', isCore: false },
  donations: { name: 'Donations', tier: 'STARTER', isCore: false },
  penalties: { name: 'Penalties', tier: 'STARTER', isCore: false },
  reports: { name: 'Reports', tier: 'STARTER', isCore: false },
  
  // Professional modules
  accounting: { name: 'Full Accounting', tier: 'PROFESSIONAL', isCore: false },
  welfare: { name: 'Welfare Funds', tier: 'PROFESSIONAL', isCore: false },
  voting: { name: 'Voting & Elections', tier: 'PROFESSIONAL', isCore: false },
  meetings: { name: 'Meetings & Attendance', tier: 'PROFESSIONAL', isCore: false },
  sms: { name: 'SMS Messaging', tier: 'PROFESSIONAL', isCore: false },
  
  // Enterprise modules
  cooperatives: { name: 'Cooperatives', tier: 'ENTERPRISE', isCore: false },
  loans: { name: 'Loan Management', tier: 'ENTERPRISE', isCore: false },
  savings: { name: 'Savings Accounts', tier: 'ENTERPRISE', isCore: false },
  ai_assistant: { name: 'AI Assistant', tier: 'ENTERPRISE', isCore: false },
  api_access: { name: 'API Access', tier: 'ENTERPRISE', isCore: false },
  white_label: { name: 'White Label', tier: 'ENTERPRISE', isCore: false },
} as const;

/**
 * Feature codes and their parent modules
 */
export const featureDefinitions = {
  // Welfare features
  welfare_payouts: { name: 'Welfare Payouts', module: 'welfare', tier: 'PROFESSIONAL' },
  welfare_bereavement: { name: 'Bereavement Support', module: 'welfare', tier: 'PROFESSIONAL' },
  
  // Voting features
  quick_polls: { name: 'Quick Polls', module: 'voting', tier: 'PROFESSIONAL' },
  election_management: { name: 'Election Management', module: 'voting', tier: 'PROFESSIONAL' },
  
  // Report features
  advanced_exports: { name: 'Advanced Exports', module: 'reports', tier: 'PROFESSIONAL' },
  custom_reports: { name: 'Custom Reports', module: 'reports', tier: 'ENTERPRISE' },
  
  // Accounting features
  journal_entries: { name: 'Journal Entries', module: 'accounting', tier: 'PROFESSIONAL' },
  budget_management: { name: 'Budget Management', module: 'accounting', tier: 'PROFESSIONAL' },
  
  // Loan features
  loan_applications: { name: 'Loan Applications', module: 'loans', tier: 'ENTERPRISE' },
  loan_guarantors: { name: 'Loan Guarantors', module: 'loans', tier: 'ENTERPRISE' },
  
  // AI features
  ai_financial_assistant: { name: 'AI Financial Assistant', module: 'ai_assistant', tier: 'ENTERPRISE' },
  ai_report_generation: { name: 'AI Report Generation', module: 'ai_assistant', tier: 'ENTERPRISE' },
} as const;

export type ModuleCode = keyof typeof moduleDefinitions;
export type FeatureCode = keyof typeof featureDefinitions;
