// What a charge is actually for. The category only says the kind ("Levy", "Annual dues"); the campaign,
// donation cause, penalty rule or the officer's own title says which one. Every list shows it under the category.

const SOURCE_SELECT = {
  title: true,
  category: { select: { name: true } },
  levyAssignment: { select: { campaign: { select: { id: true, name: true } } } },
  donationRecord: { select: { allocation: { select: { id: true, name: true } } } },
} as const;

/** Spread into a Prisma `include` / `select` so `withPurpose` has what it needs. */
export const PURPOSE_INCLUDE = {
  levyAssignment: SOURCE_SELECT.levyAssignment,
  donationRecord: SOURCE_SELECT.donationRecord,
  asPenalty: {
    select: {
      rule: { select: { name: true } },
      sourceTransaction: { select: SOURCE_SELECT },
    },
  },
} as const;

interface PurposeSource {
  title?: string | null;
  category?: { name: string } | null;
  levyAssignment?: { campaign: { name: string } } | null;
  donationRecord?: { allocation: { name: string } | null } | null;
}

interface PurposeCharge extends PurposeSource {
  asPenalty?: { rule: { name: string }; sourceTransaction: PurposeSource | null } | null;
}

const clean = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);

function specificName(t: PurposeSource): string | null {
  return clean(t.levyAssignment?.campaign.name) ?? clean(t.donationRecord?.allocation?.name) ?? clean(t.title);
}

/** The campaign, cause, penalty or title for a charge, or null when there is nothing more specific than its category. */
export function purposeOf(t: PurposeCharge): string | null {
  const category = clean(t.category?.name)?.toLowerCase();
  let name: string | null;
  if (t.asPenalty) {
    const rule = clean(t.asPenalty.rule.name);
    const src = t.asPenalty.sourceTransaction;
    const on = src ? specificName(src) ?? clean(src.category?.name) : null;
    name = rule && on ? `${rule} · on ${on}` : rule ?? clean(t.title);
  } else {
    name = specificName(t);
  }
  return name && name.toLowerCase() !== category ? name : null;
}

export function withPurpose<T extends PurposeCharge>(t: T): T & { purpose: string | null } {
  return { ...t, purpose: purposeOf(t) };
}
