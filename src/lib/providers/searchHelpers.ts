// Shared helper for providers whose own search has no fuzzy tolerance at
// all (OMDb, and the mock movie dataset) — TVmaze already does real fuzzy
// matching server-side, confirmed by testing typo'd queries against it, so
// it doesn't need this.
//
// Empirically testing OMDb directly (not guessing) showed its search is
// stricter than a simple "contains" or even "prefix" match: "incept" (a
// genuine, correctly-spelled prefix of "Inception") returns nothing, while
// "ince" (shorter) does — it behaves like IMDb's own word-level find index,
// not a literal substring/prefix scan. That rules out the "shrink the query
// from the end" approach as generally effective: shrinking a typo'd word
// almost never lands on something long enough for OMDb's index to still
// recognize.
//
// What actually works, and is cheap and bounded: trying adjacent-character
// transpositions. Swapping two adjacent letters is one of the most common
// real typos (e.g. "inceptoin" -> "inception"), and checking every adjacent
// pair costs at most (query length - 1) extra requests, only on a genuine
// zero-result miss, stopping at the first hit.

const MIN_TYPO_FALLBACK_LENGTH = 4;
const MAX_TYPO_FALLBACK_LENGTH = 30;
const MAX_TRANSPOSITION_ATTEMPTS = 10;

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function transpositionVariants(
  query: string,
  maxVariants: number = MAX_TRANSPOSITION_ATTEMPTS,
): string[] {
  const variants: string[] = [];
  for (let i = 0; i < query.length - 1 && variants.length < maxVariants; i++) {
    if (query[i] === query[i + 1]) continue; // swapping identical chars is a no-op
    const chars = query.split("");
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    variants.push(chars.join(""));
  }
  return variants;
}

export async function searchWithTypoFallback<T>(
  query: string,
  doSearch: (q: string) => Promise<T[]>,
): Promise<T[]> {
  const normalized = normalizeQuery(query);
  const results = await doSearch(normalized);
  if (results.length > 0) return results;

  if (normalized.length < MIN_TYPO_FALLBACK_LENGTH || normalized.length > MAX_TYPO_FALLBACK_LENGTH) {
    return [];
  }

  for (const variant of transpositionVariants(normalized)) {
    const variantResults = await doSearch(variant);
    if (variantResults.length > 0) return variantResults;
  }

  return [];
}
