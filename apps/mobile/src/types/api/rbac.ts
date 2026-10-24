/** Users, roles and the audit log (project-overview.md §6.9 ST7–ST9). Shapes verified against rbac.controller.ts and settings.controller.ts. */

export type RoleSummaryDTO = { id: number; name: string; displayName: string; isSystemRole: boolean };

/** GET /rbac/roles — this association's own roles, each with the keys of its permissions. */
export type RoleDTO = {
  id: number;
  name: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  userCount: number;
  permissions: string[];
};
export type RoleListDTO = { roles: RoleDTO[]; total: number };

export type PermissionDTO = { id: number; key: string; description: string; module: string };
export type PermissionListDTO = { permissions: PermissionDTO[]; total: number };

/** GET /rbac/users — people with a login who are active. */
export type UserWithRolesDTO = {
  id: number;
  email: string;
  name: string;
  memberId?: string | null;
  /** Set for people who work for the platform itself, not the association (for example a platform administrator). */
  platformRole?: string | null;
  roles: RoleSummaryDTO[];
  isActive: boolean;
  createdAt: string;
};
export type UserListDTO = {
  users: UserWithRolesDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type RolePayload = { name: string; displayName?: string; description?: string | null; permissions: string[] };
export type RoleUpdatePayload = { displayName?: string; description?: string | null; permissions?: string[] };

/** GET /settings/audit-logs — values have secret-looking fields replaced with "[hidden]" by the server. */
export type AuditLogDTO = {
  id: number;
  action: string;
  tableName: string | null;
  recordId: number | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
  user: { email: string; member: { firstName: string; lastName: string } | null } | null;
};
export type AuditPageDTO = {
  logs: AuditLogDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
export type AuditFiltersDTO = { actions: string[]; tables: string[] };
export type AuditParams = { page: number; limit: number; search?: string; action?: string; tableName?: string; from?: string; to?: string };
