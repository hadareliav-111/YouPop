// Title-relevance scoring used to rank and filter combined search results
// across providers. Tiers (highest wins, roughly matching how a person
// judges "did this actually answer my search"):
//   1. Exact title match
//   2. Very close match (off by ~1 character — a stray accent, apostrophe,
//      punctuation difference)
//   3. Title starts with the query
//   4. The query matches one whole word inside the title
//   5. Small spelling mistake / typo (a few characters off)
//   6. Weak — query merely appears as a substring somewhere
// Anything that doesn't clear even the weakest tier scores 0 and is
// dropped entirely, so a handful of loosely-related titles don't drown out
// real matches.

// Combining diacritical marks block (U+0300–U+036F), built from char codes
// rather than a literal regex range to avoid any ambiguity with how
// combining characters render/paste in source.
const COMBINING_MARKS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS_RE, "") // strip accents (after NFKD decomposition)
    .replace(/[^a-z0-9\s]/g, " ") // punctuation -> space, so "Wicked: For Good" ~ "wicked for good"
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export const RELEVANCE_TIERS = {
  EXACT: 100,
  // A title that's an exact match once a leading grammatical article is
  // set aside — "The Office" for query "office" — is effectively the
  // same title, not just "close" to it, so this sits just under true
  // EXACT rather than down with VERY_CLOSE's off-by-one-character
  // tolerance. See stripLeadingArticle() below.
  EXACT_AFTER_ARTICLE: 96,
  VERY_CLOSE: 92,
  STARTS_WITH: 80,
  WORD_MATCH: 62,
  SMALL_TYPO: 40,
  WEAK: 18,
  // A real (non-empty) query written entirely in a script normalizeForMatch
  // can't represent (Hebrew, Arabic, Cyrillic, CJK, ...) normalizes to "" —
  // see titleRelevance below for why that's judged as "we can't score
  // this", not "no match". Sits just above NONE: still the lowest tier, but
  // enough to survive the "> NONE" filters callers use to drop irrelevant
  // results.
  UNSCORABLE: 10,
  NONE: 0,
} as const;

// English titles very commonly lead with a grammatical article ("The
// Office", "A Star is Born") that a short, natural query never includes
// ("office", "star is born") — without accounting for that, such a title
// only ever qualifies for STARTS_WITH or WORD_MATCH further down, letting
// an unrelated title that happens to literally start with the query
// outrank it. Narrowly scoped on purpose: this only strips a single
// leading article for the exact-match check immediately below: it does
// not loosen STARTS_WITH, WORD_MATCH, or the typo tolerance further down.
const LEADING_ARTICLES = ["the ", "a ", "an "];

function stripLeadingArticle(value: string): string | null {
  for (const article of LEADING_ARTICLES) {
    if (value.startsWith(article) && value.length > article.length) {
      return value.slice(article.length);
    }
  }
  return null;
}

export function titleRelevance(title: string, rawQuery: string): number {
  const t = normalizeForMatch(title);
  const q = normalizeForMatch(rawQuery);
  if (!q) {
    // A genuinely empty/whitespace-only query has nothing to match at all
    // (every caller already guards against ever reaching here with one in
    // practice — e.g. tvmaze.ts's own `if (!query.trim()) return [];`).
    // But a real query that normalizes to "" is a *non-Latin-script* query
    // (Hebrew, Arabic, Cyrillic, CJK, ...): normalizeForMatch's [a-z0-9]
    // filter strips it entirely, leaving nothing to text-compare against
    // an English/Latin title with. Providers like TVmaze already resolve
    // these server-side against data (aliases/native titles) we never see
    // in the response — e.g. TVmaze's own alias index correctly matches
    // the Hebrew query "להיות איתה" to "The Baker and the Beauty", a show
    // whose title shares not one character with the query, so no amount
    // of client-side text comparison could ever confirm that match
    // ourselves. Treating "we can't score this" as "definitely not a
    // match" silently discarded that already-correct result. Trusting
    // whatever the provider itself decided to return instead — rather
    // than fetching each candidate's aliases just to re-verify it
    // ourselves — is what keeps this a same-request-count fix.
    return rawQuery.trim() ? RELEVANCE_TIERS.UNSCORABLE : RELEVANCE_TIERS.NONE;
  }
  if (t === q) return RELEVANCE_TIERS.EXACT;
  if (stripLeadingArticle(t) === q) return RELEVANCE_TIERS.EXACT_AFTER_ARTICLE;

  const dist = editDistance(t, q);
  if (dist <= 1) return RELEVANCE_TIERS.VERY_CLOSE;
  if (t.startsWith(q)) return RELEVANCE_TIERS.STARTS_WITH;

  if (t.split(" ").includes(q)) return RELEVANCE_TIERS.WORD_MATCH;

  // Typo tolerance is scaled *relative to the query's own length*, not a
  // flat edit count — a flat "distance <= 2" threshold turned out to also
  // accept things like "incept" ~ "Vincent" (distance 2, but on a 6-letter
  // query that's a third of it being different — a different word, not a
  // typo), while still needing to accept "inceptoin" ~ "Inception"
  // (distance 2 on a 9-letter query — one small transposition). Requiring
  // the distance to be a small fraction of the query length separates
  // these correctly; verified against both directly.
  const withinTypoRatio = dist / q.length <= 0.3;
  if (q.length >= 4 && withinTypoRatio) return RELEVANCE_TIERS.SMALL_TYPO;

  if (t.includes(q)) return RELEVANCE_TIERS.WEAK;

  return RELEVANCE_TIERS.NONE;
}
