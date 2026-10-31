/** The same limits the API enforces on a proof or evidence file, checked first so the person is told before uploading. */
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** A plain-words problem with the file, or null when it is fine. */
export function validateProof(file: File): string | null {
  if (!PROOF_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or PDF file.';
  if (file.size > MAX_PROOF_BYTES) return 'That file is bigger than 5 MB. Use a smaller photo.';
  return null;
}
