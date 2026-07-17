/**
 * Tiny in-process L1 cache sitting in front of Redis. Redis (Upstash, a cloud
 * service) costs ~200ms+ round-trip from this dev machine's region — a memory
 * cache with a short TTL absorbs bursts of same-second requests without an
 * extra network hop, and costs nothing once colocated with Redis in prod.
 */
const store = new Map<string, { expiresAt: number; value: unknown }>();

export async function memoize<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fn();
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

export function invalidateMemo(key: string): void {
  store.delete(key);
}
