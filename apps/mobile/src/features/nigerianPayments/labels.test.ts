import { isImageMime, isPdfMime, methodLabel, proofBacking, proofMemberName, PROOF_STATUS_LABELS } from './labels';

describe('proof labels', () => {
  it('words the statuses from the officer queue', () => {
    expect(PROOF_STATUS_LABELS.PENDING).toBe('Waiting');
    expect(PROOF_STATUS_LABELS.APPROVED).toBe('Verified');
    expect(PROOF_STATUS_LABELS.REJECTED).toBe('Rejected');
  });

  it('names payment methods, including ones we do not list', () => {
    expect(methodLabel('bank_transfer')).toBe('Bank transfer');
    expect(methodLabel('pos_terminal')).toBe('Pos terminal');
    expect(methodLabel(null)).toBe('Not stated');
  });

  it('tells images from PDFs', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isPdfMime('application/pdf')).toBe(true);
    expect(isPdfMime(null)).toBe(false);
  });

  it('says how a proof is backed', () => {
    expect(proofBacking({ hasFile: true, declarationNote: null })).toBe('file');
    expect(proofBacking({ hasFile: false, declarationNote: 'Paid cash to the treasurer on Monday' })).toBe('declaration');
    expect(proofBacking({ hasFile: false, declarationNote: null })).toBe('none');
  });

  it('joins the member name', () => {
    expect(proofMemberName({ member: { id: 1, memberId: 'M1', firstName: 'Ngozi', lastName: 'Eze' } })).toBe('Ngozi Eze');
  });
});
