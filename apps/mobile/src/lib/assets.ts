/** architecture.md §7.1 — "Logos: if `logo` is a relative `/uploads/...` path, prefix with API origin." */
const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
