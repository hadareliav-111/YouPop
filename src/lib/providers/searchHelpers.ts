// Shared helper for providers whose own search has no fuzzy tolerance at
// all (OMDb, and the mock movie dataset) — TVmaze already does real fuzzy
// matching server-side, confirmed by testing typo'd queries against it, so
// it doesn't need this.
//
// Two cheap, tightly-bounded fallback strategies, tried in order (highest
// confidence / cheapest first) only when the literal query returns nothing
// *relevant* (see hasRelevantMatch below — not merely a non-empty response).
// Each strategy has its own independent cap (not one shared pool) —
// sharing a single small pool was tried first and reverted: a long query
// needing, say, its 7th transposition position to land on the fix would
// never get there if a handful of unrelated deletion variants (tried
// first) had already used up the shared budget. Independent caps mean one
// strategy can never crowd another out, at the cost of a higher combined
// worst case — still small and fixed, only ever reached on a genuine,
// total miss, never on a query that resolves early.
//
//   1. Drop the last word, if the query has more than one — covers "the
//      user hasn't finished typing the last word yet" for multi-word
//      queries (e.g. "harry pot" -> "harry"). Confirmed live: OMDb's own
//      search for "harry pot" returns one real but useless result ("Harry
//      Putter and the Chamber Pot of Secrets"); this is exactly why the
//      stopping condition below checks relevance, not just non-empty —
//      that single junk result would otherwise have blocked the "harry"
//      retry that actually finds every Harry Potter film.
//   2. Adjacent-character transpositions (e.g. "inceptoin" -> "inception")
//      and single-character deletions (e.g. "inceptioon" -> "inception") —
//      genuine typo tolerance, cheap "try every position once" variants.
//
// Deliberately NOT attempted:
//   - Shrinking a single word letter-by-letter to find a shorter prefix
//     OMDb's index might recognize (e.g. "incept" -> "ince"). This was
//     tried and reverted after live testing: OMDb does return *something*
//     for a short fragment like "ince", exactly as an earlier investigation
//     found — but that something is unrelated junk ("Ince Cumali", "Uzun
//     Ince Bir Yol", ...), never the intended title, on the one page of
//     results we'd ever fetch. It cost the full request budget on every
//     single-word partial query for zero real benefit, which is exactly
//     backwards for a shared, rate-limited API — so it's not implemented.
//     A truncated single word with no other words to fall back to (e.g.
//     "incept", "aveng") is therefore a known, accepted limitation of
//     OMDb's free-tier search that this app does not attempt to paper
//     over with more requests.
//   - Single-character insertions or substitutions (a "missing" or "wrong"
//     character typo). Correcting those blindly means trying every letter
//     at every position — 26x the query length, per attempt — which is
//     exactly the unbounded request fan-out this module exists to avoid.

import { titleRelevance, RELEVANCE_TIERS } from "./relevance";

const MIN_FALLBACK_LENGTH = 4;
const MAX_FALLBACK_LENGTH = 30;
// Independent per-strategy caps — see note above on why these aren't one
// shared pool. Worst case combined is 1 (literal) + 1 (drop-last-word) + 7
// + 3 = 12 requests, only ever reached on a query that matches nothing at
// all, under any variant; a real hit almost always resolves in 1-2
// attempts. Both numbers are the exact minimums confirmed live against
// real proven cases, plus a small margin — not arbitrary round numbers:
// transposition=7 is exactly what "inceptoin" needs (the swap sits at
// position 6), and deletion=3 comfortably covers "inceptioon" (resolves on
// the first attempt, thanks to the duplicate-position-first ordering
// below) with a little headroom. Kept deliberately tight — this app has a
// single shared OMDb key across every user of the app.
const MAX_TRANSPOSITION_ATTEMPTS = 7;
const MAX_DELETION_ATTEMPTS = 3;

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function transpositionVariants(
  query: string,
  maxVariants: number,
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

// Positions where the character repeats its immediate neighbor (e.g. both
// "o"s in "inceptioon") are tried first — an accidentally double-pressed
// key is by far the most common real "one extra character" typo, and
// checking those positions first means the common case resolves in one
// attempt instead of sweeping the whole word first.
function deletionVariants(query: string, maxVariants: number): string[] {
  const duplicatePositions: number[] = [];
  const otherPositions: number[] = [];
  for (let i = 0; i < query.length; i++) {
    const isDuplicate = query[i] === query[i - 1] || query[i] === query[i + 1];
    (isDuplicate ? duplicatePositions : otherPositions).push(i);
  }

  const variants: string[] = [];
  for (const i of [...duplicatePositions, ...otherPositions]) {
    if (variants.length >= maxVariants) break;
    variants.push(query.slice(0, i) + query.slice(i + 1));
  }
  return variants;
}

function dropLastWord(query: string): string | null {
  const words = query.split(" ");
  if (words.length < 2) return null;
  const dropped = words.slice(0, -1).join(" ").trim();
  return dropped.length > 0 ? dropped : null;
}

// Builds the final, deduplicated, priority-ordered list of variants to try
// — highest-confidence/cheapest first. Each generator is independently
// capped (see constants above), so one strategy can never starve another
// out of the positions it actually needs to reach.
function buildFallbackCandidates(query: string): string[] {
  const seen = new Set([query.toLowerCase()]);
  const candidates: string[] = [];
  const push = (value: string | null) => {
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(value);
  };

  push(dropLastWord(query));
  transpositionVariants(query, MAX_TRANSPOSITION_ATTEMPTS).forEach(push);
  deletionVariants(query, MAX_DELETION_ATTEMPTS).forEach(push);

  return candidates;
}

function hasRelevantMatch<T extends { title: string }>(
  results: T[],
  originalQuery: string,
): boolean {
  return results.some(
    (r) => titleRelevance(r.title, originalQuery) > RELEVANCE_TIERS.NONE,
  );
}

export async function searchWithTypoFallback<T extends { title: string }>(
  query: string,
  doSearch: (q: string) => Promise<T[]>,
): Promise<T[]> {
  const normalized = normalizeQuery(query);
  const results = await doSearch(normalized);
  if (hasRelevantMatch(results, normalized)) return results;

  if (normalized.length < MIN_FALLBACK_LENGTH || normalized.length > MAX_FALLBACK_LENGTH) {
    return [];
  }

  for (const candidate of buildFallbackCandidates(normalized)) {
    const candidateResults = await doSearch(candidate);
    if (hasRelevantMatch(candidateResults, normalized)) return candidateResults;
  }

  return [];
}
