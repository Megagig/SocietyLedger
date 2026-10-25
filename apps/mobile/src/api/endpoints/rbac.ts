import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AuditFiltersDTO,
  AuditPageDTO,
  AuditParams,
  PermissionListDTO,
  RoleDTO,
  RoleListDTO,
  RolePayload,
  RoleUpdatePayload,
  UserListDTO,
} from '@/types/api/rbac';

/**
 * Roles and who holds them. Reading needs `roles.view`; creating, editing and giving roles need `roles.create`, `roles.edit` and
 * `roles.assign`. The server refuses a role that carries a permission the giver does not hold (403 CANNOT_GRANT), a change to your
 * own roles (403 OWN_ROLE), and taking the last Administrator away (409 LAST_ADMIN).
 */
export const rbacApi = {
  async listRoles(): Promise<RoleListDTO> {
    return unwrap<RoleListDTO>(client.get('/rbac/roles'));
  },

  async listPermissions(): Promise<PermissionListDTO> {
    return unwrap<PermissionListDTO>(client.get('/rbac/permissions'));
  },

  async createRole(payload: RolePayload): Promise<RoleDTO> {
    return unwrap<RoleDTO>(client.post('/rbac/roles', payload));
  },

  /** PUT /rbac/roles/:id — 403 ADMIN_ROLE_LOCKED for the Administrator's permissions. */
  async updateRole(id: number, payload: RoleUpdatePayload): Promise<RoleDTO> {
    return unwrap<RoleDTO>(client.put(`/rbac/roles/${id}`, payload));
  },

  /** DELETE /rbac/roles/:id — 400 while anyone holds it, and for a built-in role. */
  async deleteRole(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`/rbac/roles/${id}`));
  },

  async listUsers(params: { page: number; limit: number; search?: string }): Promise<UserListDTO> {
    return unwrap<UserListDTO>(client.get('/rbac/users', { params }));
  },

  /** POST /rbac/assign — when the association allows one role per person, this replaces their other roles. */
  async assignRole(payload: { userId: number; roleId: number }): Promise<unknown> {
    return unwrap<unknown>(client.post('/rbac/assign', payload));
  },

  /** POST /rbac/remove — a person left with no role becomes a member again. */
  async removeRole(payload: { userId: number; roleId: number }): Promise<unknown> {
    return unwrap<unknown>(client.post('/rbac/remove', payload));
  },
};

/** The association's activity log. Needs `audit.view`. */
export const auditApi = {
  async list(params: AuditParams): Promise<AuditPageDTO> {
    return unwrap<AuditPageDTO>(client.get('/settings/audit-logs', { params }));
  },

  /** GET /settings/audit-logs/filters — the areas this association has recorded activity in. */
  async filters(): Promise<AuditFiltersDTO> {
    return unwrap<AuditFiltersDTO>(client.get('/settings/audit-logs/filters'));
  },
};
