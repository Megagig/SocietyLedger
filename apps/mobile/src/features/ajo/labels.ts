import type { CaseDTO } from '@/types/api/ajo';

/** A default case's status in words, and the badge status it is drawn with. */
export const CASE_STATUS: Record<CaseDTO['status'], string> = { OPEN: 'Open', PLAN_AGREED: 'Plan agreed', RESOLVED: 'Resolved', CLOSED_UNRESOLVED: 'Closed, not resolved' };

export const caseBadge = (status: CaseDTO['status']) => (status === 'OPEN' ? 'PENDING' : status === 'PLAN_AGREED' ? 'DUE' : status === 'RESOLVED' ? 'CONFIRMED' : 'REVERSED');
