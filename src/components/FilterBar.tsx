import { useState } from "react";
import {
  countActiveExtraFilters,
  DEFAULT_FILTERS,
  type Filters,
  type MediaTypeFilter,
} from "../types/filters";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  genres: string[];
  tags: string[];
  recommenders: string[];
  hideMediaTypeTabs?: boolean;
  showTvSubtypeFilter?: boolean;
  // Watched only wants the plain All/Movies/TV Shows tabs — the "Filters"
  // button (sort/status/genre/tag/recommender panel) is more than that
  // screen needs.
  hideMoreFilters?: boolean;
}

const MEDIA_TYPE_TABS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
];

export function FilterBar({
  filters,
  onChange,
  genres,
  tags,
  recommenders,
  hideMediaTypeTabs,
  showTvSubtypeFilter,
  hideMoreFilters,
}: FilterBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const activeExtra = countActiveExtraFilters(filters);

  const patch = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="filter-bar">
      <div className="filter-bar__tabs">
        {!hideMediaTypeTabs &&
          MEDIA_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`filter-tab ${filters.mediaType === tab.value ? "is-active" : ""}`}
              onClick={() => patch({ mediaType: tab.value })}
            >
              {tab.label}
            </button>
          ))}
        {showTvSubtypeFilter && (
          <>
            <button
              type="button"
              className={`filter-tab ${filters.tvSubtype === "all" ? "is-active" : ""}`}
              onClick={() => patch({ tvSubtype: "all" })}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-tab ${filters.tvSubtype === "scripted" ? "is-active" : ""}`}
              onClick={() => patch({ tvSubtype: "scripted" })}
            >
              Scripted
            </button>
            <button
              type="button"
              className={`filter-tab ${filters.tvSubtype === "reality" ? "is-active" : ""}`}
              onClick={() => patch({ tvSubtype: "reality" })}
            >
              Reality
            </button>
          </>
        )}
        {!hideMoreFilters && (
          <button
            type="button"
            className={`filter-tab filter-tab--more ${activeExtra > 0 ? "is-active" : ""}`}
            onClick={() => setPanelOpen((v) => !v)}
          >
            Filters{activeExtra > 0 ? ` (${activeExtra})` : ""}
          </button>
        )}
      </div>

      {!hideMoreFilters && panelOpen && (
        <div className="filter-panel">
          <div className="filter-panel__field">
            <label htmlFor="filter-sort">Sort by</label>
            <select
              id="filter-sort"
              value={filters.sort}
              onChange={(e) => patch({ sort: e.target.value as Filters["sort"] })}
            >
              <option value="manual">My order</option>
              <option value="rating">Rating</option>
              <option value="recent">Recently added</option>
              <option value="year">Release year</option>
            </select>
          </div>

          <div className="filter-panel__field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) =>
                patch({ status: e.target.value as Filters["status"] })
              }
            >
              <option value="all">All</option>
              <option value="want_to_watch">Want to watch</option>
              <option value="currently_watching">Currently watching</option>
              <option value="watched">Watched</option>
            </select>
          </div>

          <div className="filter-panel__field">
            <label htmlFor="filter-genre">Genre</label>
            <select
              id="filter-genre"
              value={filters.genre ?? ""}
              onChange={(e) => patch({ genre: e.target.value || null })}
            >
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-panel__field">
            <label htmlFor="filter-tag">Personal tag</label>
            <select
              id="filter-tag"
              value={filters.tag ?? ""}
              onChange={(e) => patch({ tag: e.target.value || null })}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-panel__field">
            <label htmlFor="filter-recommended">Recommended</label>
            <select
              id="filter-recommended"
              value={filters.recommended}
              onChange={(e) =>
                patch({ recommended: e.target.value as Filters["recommended"] })
              }
            >
              <option value="all">All</option>
              <option value="yes">Recommended</option>
              <option value="no">Not recommended</option>
            </select>
          </div>

          <div className="filter-panel__field">
            <label htmlFor="filter-recommender">Recommender</label>
            <select
              id="filter-recommender"
              value={filters.recommender ?? ""}
              onChange={(e) => patch({ recommender: e.target.value || null })}
            >
              <option value="">Anyone</option>
              {recommenders.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {(activeExtra > 0 || (!hideMediaTypeTabs && filters.mediaType !== "all")) && (
            <button
              type="button"
              className="btn btn--ghost btn--compact filter-panel__clear"
              onClick={() =>
                onChange(
                  hideMediaTypeTabs
                    ? { ...DEFAULT_FILTERS, mediaType: filters.mediaType }
                    : DEFAULT_FILTERS,
                )
              }
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
