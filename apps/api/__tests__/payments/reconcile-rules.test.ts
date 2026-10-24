/**
 * Matching bank money to charges. These guard the bugs this replaced: a match that recorded ₦0.00, one bank line paying several
 * charges, and an amount-only guess being treated as certain.
 */
import { Decimal } from '@prisma/client/runtime/library';
import {
  assertChargeOpen,
  assertLineFits,
  assertNotOwnMatch,
  availableOn,
  rankSuggestions,
  scoreMatch,
  statusAfterPayment,
  type MoneyIn,
  type OpenCharge,
} from '../../src/modules/nigerian-payments/reconcile-rules';

const d = (n: number) => new Decimal(n);
const line = (id: number, amount: number, description: string, over: Partial<MoneyIn> = {}): MoneyIn => ({
  key: `entry:${id}`, source: 'entry', id, amount: d(amount), reference: null, description, date: new Date(2026, 9, id), memberId: null, ...over,
});
const charge = (id: number, available: number, over: Partial<OpenCharge> = {}): OpenCharge => ({
  id, referenceNumber: `DUE-2026-000${id}`, memberId: id, firstName: 'Ada', lastName: `Obi${id}`, available: d(available), ...over,
});

describe('scoring one line against one charge', () => {
  it('a reference in the narration and the exact amount is certain', () => {
    const r = scoreMatch(line(1, 10000, 'NIP TRF DUE-2026-0001 FROM SOMEONE'), charge(1, 10000))!;
    expect(r.confidence).toBe(100);
    expect(r.kind).toBe('AUTO_REFERENCE');
  });

  it('a reference with a smaller amount is a part payment, still confident', () => {
    expect(scoreMatch(line(1, 4000, 'DUE20260001'), charge(1, 10000))!.confidence).toBe(90);
  });

  it("the member's name and the exact amount is confident; the name alone with a smaller amount is not", () => {
    expect(scoreMatch(line(1, 10000, 'NIP TRF FROM ADA OBI1'), charge(1, 10000, { referenceNumber: null }))!.confidence).toBe(90);
    expect(scoreMatch(line(1, 4000, 'NIP TRF FROM ADA OBI1'), charge(1, 10000, { referenceNumber: null }))!.confidence).toBe(60);
  });

  it("a member's own declared transfer counts as the member's name", () => {
    const transfer = line(3, 10000, 'declared', { source: 'transfer', key: 'transfer:3', memberId: 1 });
    expect(scoreMatch(transfer, charge(1, 10000, { referenceNumber: null }))!.confidence).toBe(90);
    expect(scoreMatch(transfer, charge(2, 10000, { referenceNumber: null }))!.confidence).toBe(40);
  });

  it('an amount alone is a weak hint', () => {
    expect(scoreMatch(line(1, 10000, 'NIP TRF FROM SOMEONE ELSE'), charge(1, 10000, { referenceNumber: null }))!.confidence).toBe(40);
  });

  it('a line larger than what the charge still owes can never match it, even with its reference', () => {
    expect(scoreMatch(line(1, 12000, 'DUE-2026-0001'), charge(1, 10000))).toBeNull();
    expect(scoreMatch(line(1, 0, 'DUE-2026-0001'), charge(1, 10000))).toBeNull();
  });

  it('a different amount with nothing to identify the member is not suggested', () => {
    expect(scoreMatch(line(1, 4000, 'NIP TRF FROM SOMEONE'), charge(1, 10000, { referenceNumber: null }))).toBeNull();
  });
});

describe('proposing matches', () => {
  it('ticks only the confident ones', () => {
    const out = rankSuggestions(
      [line(1, 10000, 'DUE-2026-0001'), line(2, 7500, 'NIP FROM NOBODY')],
      [charge(1, 10000), charge(2, 7500, { referenceNumber: null, firstName: 'Bola', lastName: 'Ade' })],
    );
    expect(out.map((s) => [s.line.id, s.charge.id, s.recommended])).toEqual([[1, 1, true], [2, 2, false]]);
  });

  it('never pays one charge twice: the second line for a charge already filled is left out', () => {
    const out = rankSuggestions([line(1, 10000, 'DUE-2026-0001'), line(2, 10000, 'DUE-2026-0001')], [charge(1, 10000)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.line.id).toBe(1);
  });

  it('lets two part payments fill one charge, and no more', () => {
    const out = rankSuggestions([line(1, 6000, 'DUE-2026-0001'), line(2, 4000, 'DUE-2026-0001'), line(3, 1000, 'DUE-2026-0001')], [charge(1, 10000)]);
    expect(out.map((s) => s.line.id).sort()).toEqual([1, 2]);
  });

  it('never uses one line for two charges', () => {
    const out = rankSuggestions([line(1, 5000, 'DUE-2026-0001 DUE-2026-0002')], [charge(1, 5000), charge(2, 5000)]);
    expect(out).toHaveLength(1);
  });

  it('does not guess between charges with the same amount when nothing tells them apart', () => {
    const charges = [charge(1, 10000, { referenceNumber: null, lastName: 'Aaa' }), charge(2, 10000, { referenceNumber: null, lastName: 'Bbb' })];
    expect(rankSuggestions([line(1, 10000, 'NIP FROM SOMEONE')], charges)).toEqual([]);
    expect(rankSuggestions([line(1, 10000, 'NIP FROM SOMEONE')], [charges[0]!])).toHaveLength(1);
  });
});

describe('the rules a match keeps', () => {
  it('what is available leaves out payments and matches already waiting', () => {
    expect(availableOn(10000, 2500, 3000).toString()).toBe('4500');
  });

  it('a charge that is cancelled, waived, for a disabled member, or already covered cannot be matched', () => {
    const ok = { isVoided: false, status: 'pending', member: { status: 'active' } };
    expect(() => assertChargeOpen(ok, d(100))).not.toThrow();
    expect(() => assertChargeOpen({ ...ok, isVoided: true }, d(100))).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_OPEN' }));
    expect(() => assertChargeOpen({ ...ok, status: 'waived' }, d(100))).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_OPEN' }));
    expect(() => assertChargeOpen({ ...ok, member: { status: 'terminated' } }, d(100))).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_OPEN' }));
    expect(() => assertChargeOpen(ok, d(0))).toThrow(expect.objectContaining({ code: 'CHARGE_NOT_OPEN' }));
  });

  it('a line larger than what is left is refused, and the message says how much', () => {
    expect(() => assertLineFits(d(12000), d(10000))).toThrow(expect.objectContaining({ code: 'LINE_TOO_LARGE', message: expect.stringContaining('₦10000.00') }));
    expect(() => assertLineFits(d(10000), d(10000))).not.toThrow();
  });

  it('the officer who proposed a match cannot confirm it', () => {
    expect(() => assertNotOwnMatch(5, 5)).toThrow(expect.objectContaining({ code: 'OWN_MATCH' }));
    expect(() => assertNotOwnMatch(5, 6)).not.toThrow();
    expect(() => assertNotOwnMatch(null, 6)).not.toThrow();
  });

  it('a charge is paid only when all of it is paid, otherwise part paid', () => {
    expect(statusAfterPayment(10000, 10000)).toBe('paid');
    expect(statusAfterPayment(10000, 4000)).toBe('partial');
  });
});
