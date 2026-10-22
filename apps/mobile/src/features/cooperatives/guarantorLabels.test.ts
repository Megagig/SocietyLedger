import { COOPERATIVE_GUARANTOR_ACCESS, canAny } from '@/lib/permissions';
import { getStatusTone } from '@/components/ui/StatusChip';

describe('guarantor access', () => {
  it('lets a member with only cooperatives.guarantor_own answer requests', () => {
    expect(canAny(['cooperatives.guarantor_own'], COOPERATIVE_GUARANTOR_ACCESS)).toBe(true);
    expect(canAny(['cooperatives.view_own'], COOPERATIVE_GUARANTOR_ACCESS)).toBe(false);
  });
});

describe('guarantee and application status tones', () => {
  it('colours the statuses a guarantor and an applicant will see', () => {
    expect(getStatusTone('accepted')).toBe('success');
    expect(getStatusTone('declined')).toBe('danger');
    expect(getStatusTone('pending_guarantors')).toBe('warning');
    expect(getStatusTone('pending_review')).toBe('warning');
    expect(getStatusTone('paid_off')).toBe('success');
    expect(getStatusTone('written_off')).toBe('neutral');
  });
});
