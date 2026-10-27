// Platform-role → section map for navigation guards (§10.7)
// The API enforces actual permissions; this file mirrors them for navigation only.

export const ADMIN_SECTIONS = {
  dashboard: true,
  associations: true,
  tenants: true,
  approvals: true,
  analytics: true,
  settlements: true,
  modules: true,
  actionLogs: true,
  auditLogs: true,
  settings: true,
  webhooks: true,
  jobs: true,
  blog: true,
  downloads: true,
  helpContent: true,
  support: true,
  impersonation: true,
  account: true,
} as const;

export type AdminSection = keyof typeof ADMIN_SECTIONS;
