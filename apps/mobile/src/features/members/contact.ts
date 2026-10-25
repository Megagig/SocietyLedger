import { Linking } from 'react-native';

// code-standards.md §16 — external URLs open only after their scheme is allow-listed.
const ALLOWED_SCHEMES = ['https:', 'tel:', 'mailto:'];

/**
 * Digits only, with Nigeria's country code (234) — what `wa.me` and `tel:` both accept. Handles `0803 123 4567`,
 * `+234 803 123 4567`, `234803…` and a bare 10-digit `803…`; anything too short to be a phone number gives null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `234${digits}`;
  return digits.length >= 8 ? digits : null;
}

export function telUrl(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `tel:+${normalized}` : null;
}

export function whatsappUrl(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `https://wa.me/${normalized}` : null;
}

export function mailUrl(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed ? `mailto:${trimmed}` : null;
}

/** Opens a call / WhatsApp / email link. Resolves false (so the caller can toast) when the scheme isn't allowed or nothing can handle it. */
export async function openContactUrl(url: string): Promise<boolean> {
  if (!ALLOWED_SCHEMES.some((scheme) => url.startsWith(scheme))) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
