import { canonicalSlots, drawOrder, earlyPositionCount, newSeed, rosterFingerprint, seededShuffle, type SlotKey, verifyDraw } from '../../src/modules/ajo/ajo-draw';

const slots = (shares: Record<number, number>): SlotKey[] => Object.entries(shares).flatMap(([m, n]) => Array.from({ length: n }, (_, i) => ({ membershipId: Number(m), shareNo: i + 1 })));
const key = (p: { membershipId: number; shareNo: number }) => `${p.membershipId}:${p.shareNo}`;

describe('Ajo draw', () => {
  const roster = slots({ 11: 1, 12: 2, 13: 1, 14: 1, 15: 2, 16: 1 }); // 8 slots

  it('is reproducible: the same seed and slots give the same order, whatever order the slots arrive in', () => {
    const seed = 'seed-for-a-test';
    const a = drawOrder({ slots: roster, seed });
    const b = drawOrder({ slots: [...roster].reverse(), seed });
    expect(a.positions).toEqual(b.positions);
  });

  it('gives every slot exactly one position, 1..N, so a person with two shares gets two positions', () => {
    const { positions } = drawOrder({ slots: roster, seed: newSeed() });
    expect(positions.map((p) => p.position).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(positions.map(key)).size).toBe(8);
    expect(positions.filter((p) => p.membershipId === 12)).toHaveLength(2);
    expect(positions.filter((p) => p.membershipId === 15)).toHaveLength(2);
  });

  it('different seeds give different orders (over many seeds, not every order is the same)', () => {
    const orders = new Set(Array.from({ length: 20 }, (_, i) => drawOrder({ slots: roster, seed: `s${i}` }).positions.map(key).join(',')));
    expect(orders.size).toBeGreaterThan(10);
  });

  it('makes a fresh 128-bit seed each time', () => {
    const a = newSeed();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newSeed()).not.toBe(a);
  });

  it('puts each slot in each position about equally often (no bias)', () => {
    const three = slots({ 1: 1, 2: 1, 3: 1 });
    const counts: Record<string, number> = {};
    const runs = 6000;
    for (let i = 0; i < runs; i++) {
      const first = drawOrder({ slots: three, seed: `bias-${i}` }).positions[0];
      counts[key(first)] = (counts[key(first)] ?? 0) + 1;
    }
    for (const k of ['1:1', '2:1', '3:1']) expect(Math.abs(counts[k] / runs - 1 / 3)).toBeLessThan(0.03);
  });

  it('shuffles without losing or repeating anything', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const out = seededShuffle(items, 'x');
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items[0]).toBe(0); // the input is untouched
  });

  it('fingerprints who holds how many shares, and changes when that changes', () => {
    const a = rosterFingerprint(roster);
    expect(rosterFingerprint([...roster].reverse())).toBe(a);
    expect(rosterFingerprint(slots({ 11: 1, 12: 2, 13: 1, 14: 1, 15: 2, 16: 2 }))).not.toBe(a); // someone took another share
    expect(rosterFingerprint(slots({ 11: 1, 12: 2, 13: 1, 14: 1, 15: 2 }))).not.toBe(a); // someone left
    expect(canonicalSlots(roster)[0]).toEqual({ membershipId: 11, shareNo: 1 });
  });

  describe('the optional At-risk rule', () => {
    const many = slots({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }); // 9 slots, early = first 3

    it('keeps At-risk people out of the early positions when the rule is on', () => {
      expect(earlyPositionCount(9)).toBe(3);
      for (let i = 0; i < 30; i++) {
        const { positions, atRiskRuleFullyApplied } = drawOrder({ slots: many, seed: `r${i}`, blockAtRiskEarly: true, atRisk: new Set([1, 2, 3]) });
        expect(atRiskRuleFullyApplied).toBe(true);
        expect(positions.filter((p) => p.position <= 3).some((p) => [1, 2, 3].includes(p.membershipId))).toBe(false);
      }
    });

    it('does nothing when the rule is off, or nobody is At risk (which is every group until trust scores exist)', () => {
      const plain = drawOrder({ slots: many, seed: 'same' });
      expect(drawOrder({ slots: many, seed: 'same', blockAtRiskEarly: false, atRisk: new Set([1, 2, 3]) })).toEqual(plain);
      expect(drawOrder({ slots: many, seed: 'same', blockAtRiskEarly: true, atRisk: new Set() })).toEqual(plain);
      expect(drawOrder({ slots: many, seed: 'same', blockAtRiskEarly: true })).toEqual(plain);
    });

    it('says so when it cannot fully apply the rule instead of pretending', () => {
      const small = slots({ 1: 1, 2: 1, 3: 1 });
      const result = drawOrder({ slots: small, seed: 'q', blockAtRiskEarly: true, atRisk: new Set([1, 2, 3]) });
      expect(result.atRiskRuleFullyApplied).toBe(false);
      expect(result.positions).toHaveLength(3);
    });
  });
});

describe('verifyDraw', () => {
  const roster = [
    { membershipId: 11, shareNo: 1 },
    { membershipId: 12, shareNo: 1 },
    { membershipId: 12, shareNo: 2 },
    { membershipId: 13, shareNo: 1 },
    { membershipId: 14, shareNo: 1 },
    { membershipId: 15, shareNo: 1 },
  ];
  const saved = () => {
    const placed = drawOrder({ slots: roster, seed: 'a-saved-seed' });
    return { seed: 'a-saved-seed', positions: placed.positions };
  };

  it('says a draw matches when running it again from its seed gives the same order', () => {
    expect(verifyDraw(saved())).toEqual({ matches: true, reason: null });
  });

  it('says it does not match when the result was changed after the draw', () => {
    const s = saved();
    const [first, second] = s.positions;
    const tampered = s.positions.map((p) => (p === first ? { ...p, position: second.position } : p === second ? { ...p, position: first.position } : p));
    expect(verifyDraw({ ...s, positions: tampered }).matches).toBe(false);
  });

  it('says it does not match when the seed is not the one that made the order', () => {
    expect(verifyDraw({ ...saved(), seed: 'another-seed' }).matches).toBe(false);
  });

  it('re-checks a draw that used the At-risk rule when the people it applied to were saved, and says so when they were not', () => {
    const placed = drawOrder({ slots: roster, seed: 'risk-seed', blockAtRiskEarly: true, atRisk: new Set([11]) });
    expect(verifyDraw({ seed: 'risk-seed', positions: placed.positions, blockAtRiskEarly: true, atRiskMembershipIds: [11] }).matches).toBe(true);
    expect(verifyDraw({ seed: 'risk-seed', positions: placed.positions, blockAtRiskEarly: true }).matches).toBeNull();
  });

  it('cannot check something that saved nothing', () => {
    expect(verifyDraw({ seed: '', positions: [] }).matches).toBeNull();
  });
});
