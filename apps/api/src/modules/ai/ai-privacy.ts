/**
 * What the AI model is allowed to see about people: nothing that says who they are.
 *
 * Members go to the model as stand-ins ("Member 3"), never by name, and phone numbers and emails never go at all. The server swaps the
 * stand-ins back to real names in the answer before the officer sees it. Kept free of the database so it can be tested on its own.
 */

const ALIAS = /\bMember (\d{1,4})\b/g;

/** Stands real members in for aliases within one request, and puts the real names back into what the model wrote. */
export class Pseudonymizer {
  private numberOf = new Map<number, number>();
  private nameOf = new Map<number, string>();

  /** "Member 3" for this member, the same one every time within the request. */
  alias(memberId: number, name: string): string {
    let n = this.numberOf.get(memberId);
    if (n === undefined) {
      n = this.numberOf.size + 1;
      this.numberOf.set(memberId, n);
      this.nameOf.set(n, name.trim());
    }
    return `Member ${n}`;
  }

  /** Replaces every "Member 3" in the model's words with the real name. A number it never handed out is left alone. */
  restore(text: string): string {
    return text.replace(ALIAS, (whole, n: string) => this.nameOf.get(Number(n)) ?? whole);
  }

  get size(): number {
    return this.numberOf.size;
  }
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Nigerian numbers (0803..., +234 803...), and any other run of 7 or more digits with the usual separators
const PHONE = /(?:\+?234[\s-]?|0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}|\+?\d[\d\s().-]{7,}\d/g;

/** Takes emails and phone numbers out of text before it goes to the model. Amounts like ₦1,250,000.00 are not phone numbers and stay. */
export function scrubContacts(text: string): string {
  return text
    .replace(EMAIL, '[email removed]')
    .replace(PHONE, (match) => (/^[₦\s]*\d{1,3}(,\d{3})+(\.\d+)?$/.test(match.trim()) || /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(match.trim()) ? match : '[number removed]'));
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Swaps any member's full name found in the text for an alias ("Ada Obi" or "Obi Ada"), so a name the officer typed, or one the answer
 * showed earlier in the conversation, never reaches the model. Returns the new text and the members it found.
 */
export function aliasKnownNames(text: string, members: ReadonlyArray<{ id: number; firstName: string; lastName: string }>, pseudo: Pseudonymizer): { text: string; found: number[] } {
  let result = text;
  const found: number[] = [];
  const lower = text.toLowerCase();
  for (const m of members) {
    const first = m.firstName.trim();
    const last = m.lastName.trim();
    if (!first || !last) continue;
    const forward = `${first} ${last}`;
    const backward = `${last} ${first}`;
    if (!lower.includes(forward.toLowerCase()) && !lower.includes(backward.toLowerCase())) continue;
    const alias = pseudo.alias(m.id, forward);
    const pattern = new RegExp(`\\b(?:${escapeRegExp(forward)}|${escapeRegExp(backward)})\\b`, 'gi');
    result = result.replace(pattern, alias);
    found.push(m.id);
  }
  return { text: result, found };
}

/** What an officer typed, made safe to send: contacts removed, member names swapped for aliases. */
export function sanitizeForModel(text: string, members: ReadonlyArray<{ id: number; firstName: string; lastName: string }>, pseudo: Pseudonymizer): { text: string; found: number[] } {
  const named = aliasKnownNames(scrubContacts(text), members, pseudo);
  return { text: named.text.slice(0, 1000), found: named.found };
}
