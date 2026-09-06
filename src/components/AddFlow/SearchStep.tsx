import { useEffect, useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import {
  searchAll,
  type MediaSource,
  type SearchResultItem,
} from "../../lib/providers";
import { mediaTypeLabel } from "../../lib/mediaTypeLabel";

// TVmaze and OMDb's catalogs are effectively English/Latin-script only —
// there's no free source we use that indexes titles in other scripts. When
// a query has letters but none of them are Latin (Hebrew, Arabic, Cyrillic,
// CJK...), and it genuinely returns nothing, that's a real, explainable
// limitation of the free data sources — not a technical failure — so it
// gets its own honest message instead of a generic "no results".
function isNonLatinScript(value: string): boolean {
  const hasAnyLetter = /\p{L}/u.test(value);
  const hasLatinLetter = /[A-Za-z]/.test(value);
  return hasAnyLetter && !hasLatinLetter;
}

interface SearchStepProps {
  onSelect: (result: SearchResultItem) => void;
  isAlreadyAdded: (source: MediaSource, externalId: string) => boolean;
  alreadyAddedLabel?: string;
}

export function SearchStep({
  onSelect,
  isAlreadyAdded,
  alreadyAddedLabel = "Already in your watchlist",
}: SearchStepProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setPartialFailure(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPartialFailure(false);

    searchAll(trimmed, controller.signal)
      .then(({ results, failedSources }) => {
        setResults(results);
        setPartialFailure(failedSources.length > 0);
        setLoading(false);
        if (results.length === 0 && failedSources.length > 0) {
          setError("Couldn't search right now. Please try again.");
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't search right now. Please try again.",
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  return (
    <div className="search-step">
      {/* Fixed row: stays in place (and keeps focus, so the on-screen
          keyboard stays open) while the results below scroll independently —
          this is the one thing that makes Add feel like a native app search
          rather than a webpage form. */}
      <div className="search-step__input-row">
        <p className="search-step__hint">
          Search for any movie or show to add.
        </p>
        <input
          autoFocus
          type="search"
          dir="auto"
          className="search-step__input"
          placeholder="e.g. Fleabag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="search-step__scroll">
        {loading && <p className="search-step__status">Searching…</p>}
        {error && <p className="search-step__status search-step__status--error">{error}</p>}
        {!loading && !error && partialFailure && results.length > 0 && (
          <p className="search-step__status">
            Some results may be missing — one data source didn't respond.
          </p>
        )}
        {!loading && !error && debouncedQuery.trim() && results.length === 0 && (
          <p className="search-step__status">
            {isNonLatinScript(debouncedQuery.trim())
              ? "No results — the free movie/TV databases this app uses don't index titles in this script yet. Try searching by the English/original title instead."
              : `No results for "${debouncedQuery}".`}
          </p>
        )}

        <ul className="search-results">
        {results.map((result) => {
          const added = isAlreadyAdded(result.source, result.externalId);
          return (
            <li key={`${result.source}-${result.externalId}`}>
              <button
                type="button"
                className="search-result"
                onClick={() => onSelect(result)}
              >
                {result.posterUrl ? (
                  <img
                    className="search-result__poster"
                    src={result.posterUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className="search-result__poster search-result__poster--placeholder">
                    🎬
                  </div>
                )}
                <div className="search-result__info">
                  <p className="search-result__title">{result.title}</p>
                  <p className="search-result__meta">
                    {mediaTypeLabel(result.mediaType, result.tvSubtype)}
                    {result.year ? ` · ${result.year}` : ""}
                  </p>
                  {result.isMockData && (
                    <span className="search-result__mock-badge">
                      Preview data
                    </span>
                  )}
                  {added && (
                    <span className="search-result__added-badge">
                      {alreadyAddedLabel}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        </ul>
      </div>
    </div>
  );
}
