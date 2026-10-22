import type { MemberCategory, MemberListItemDTO, MemberLoginStatus, MemberStatus } from '@/types/api/membersManage';

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

export const CATEGORY_LABELS: Record<MemberCategory, string> = {
  regular: 'Regular',
  executive: 'Executive',
  honorary: 'Honorary',
  student: 'Student',
};

export const LOGIN_STATUS_LABELS: Record<MemberLoginStatus, string> = {
  active: 'Can sign in',
  invited: 'Invited',
  no_login: 'No login',
};

export const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as MemberStatus[];
export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as MemberCategory[];
export const LOGIN_STATUS_OPTIONS = Object.keys(LOGIN_STATUS_LABELS) as MemberLoginStatus[];

/** Free-form columns can hold a value we don't list (an imported category, say) — show it capitalised rather than hide it. */
function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export function statusLabel(status: string): string {
  return labelFor(STATUS_LABELS, status);
}

export function categoryLabel(category: string): string {
  return labelFor(CATEGORY_LABELS, category);
}

export function loginStatusLabel(loginStatus: string): string {
  return labelFor(LOGIN_STATUS_LABELS, loginStatus);
}

export function loginStatusTone(loginStatus: string): 'success' | 'info' | 'neutral' {
  if (loginStatus === 'active') return 'success';
  if (loginStatus === 'invited') return 'info';
  return 'neutral';
}

export function memberFullName(member: Pick<MemberListItemDTO, 'firstName' | 'lastName'>): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export type MemberFilterValues = {
  status?: MemberStatus;
  category?: MemberCategory;
  loginStatus?: MemberLoginStatus;
};

/** Number of filters currently narrowing the list — the badge on the filter button. */
export function countActiveFilters(values: MemberFilterValues): number {
  return [values.status, values.category, values.loginStatus].filter(Boolean).length;
}
