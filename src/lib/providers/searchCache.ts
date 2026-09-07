// Shared, session-lifetime, in-memory cache of provider search results,
// keyed by "<providerId>::<normalized query>". Shared between the
// top-level per-provider search (see index.ts's searchAll) and the
// internal fallback variants tried by searchWithTypoFallback (see
// searchHelpers.ts) — a variant tried internally for one query (e.g.
// "ince", tried while searching "incept") is now reused instantly if the
// user later searches that exact text directly, and vice versa, instead
// of the two paths keeping separate, disconnected caches.
const cache = new Map<string, unknown>();

function cacheKey(providerId: string, query: string): string {
  return `${providerId}::${query.trim().toLowerCase()}`;
}

export async function withSearchCache<T>(
  providerId: string,
  query: string,
  run: () => Promise<T>,
): Promise<T> {
  const key = cacheKey(providerId, query);
  const cached = cache.get(key);
  if (cached !== undefined) return cached as T;
  const result = await run();
  cache.set(key, result);
  return result;
}
