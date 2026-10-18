export async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/bff/${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown;
  if (
    typeof json === 'object' &&
    json !== null &&
    'data' in json &&
    (json as Record<string, unknown>).data !== undefined
  ) {
    return (json as Record<string, unknown>).data as T;
  }
  return json as T;
}
