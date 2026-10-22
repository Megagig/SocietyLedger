/**
 * Digits only, with Nigeria's country code (234) — what `wa.me` and `tel:` both accept. Handles `0803 123 4567`,
 * `+234 803 123 4567`, `234803…` and a bare 10-digit `803…`; anything too short to be a phone number gives null.
 * Mirrors the mobile app's `features/members/contact.ts`, so both platforms dial the same number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  return digits.length >= 8 ? digits : null;
}

export function telHref(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `tel:+${normalized}` : null;
}

export function whatsappHref(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `https://wa.me/${normalized}` : null;
}

export function mailHref(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed ? `mailto:${trimmed}` : null;
}
