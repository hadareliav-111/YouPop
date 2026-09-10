import { useMemo, useState } from "react";
import type { MediaType, WatchlistItem } from "../types";
import { DEFAULT_FILTERS, type Filters } from "../types/filters";
import { ScreenHeader } from "../components/ScreenHeader";
import { WatchlistGrid } from "../components/WatchlistGrid";
import { ReorderableList } from "../components/ReorderableList";
import { useSwipeBack } from "../hooks/useSwipeBack";

const CATEGORY_TITLE: Record<MediaType, string> = {
  movie: "My Watchlist · Movies",
  tv: "My Watchlist · TV Shows",
};

function sortItems(items: WatchlistItem[], sort: Filters["sort"]): WatchlistItem[] {
  const sorted = [...items];
  switch (sort) {
    case "rating":
      return sorted.sort((a, b) => (b.externalRating ?? -1) - (a.externalRating ?? -1));
    case "recent":
      return sorted.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    case "year":
      return sorted.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
    case "manual":
    default:
      return sorted.sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

interface CategoryScreenProps {
  mediaType: MediaType;
  items: WatchlistItem[];
  onBack: () => void;
  onSelectItem: (item: WatchlistItem) => void;
  onAdd: () => void;
  onReorder: (mediaType: MediaType, orderedIds: string[]) => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

export function CategoryScreen({
  mediaType,
  items,
  onBack,
  onSelectItem,
  onAdd,
  onReorder,
  onSwipeActiveChange,
}: CategoryScreenProps) {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    mediaType,
  });
  const [editOrderMode, setEditOrderMode] = useState(false);

  // Edge-swipe-to-go-back — only this screen and FriendRecommendationsScreen
  // get it (see useSwipeBack's own comment for why it can't collide with
  // ReorderableList's drag-to-reorder below or normal scrolling).
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  const categoryItems = useMemo(
    () => items.filter((item) => item.mediaType === mediaType),
    [items, mediaType],
  );

  // This page represents Want to Watch specifically — each item has exactly
  // one active status, so a Currently Watching or Watched item has already
  // "moved on" and shouldn't linger (or count toward genre filters) here.
  const wantToWatchItems = useMemo(
    () => categoryItems.filter((item) => item.status === "want_to_watch"),
    [categoryItems],
  );

  // Genres come straight from whatever the items *currently shown on this
  // page* report (OMDb's Genre field for movies, TVmaze's for TV) — derived
  // from wantToWatchItems, not every item of this mediaType, so a genre
  // only represented among Watched/Currently Watching items never shows up
  // as a tab here (clicking it would otherwise always yield an empty list).
  // This also means the tabs update automatically whenever the underlying
  // list changes, since it's a plain derivation, not separate state. TV
  // additionally gets a synthetic "Reality" option derived from tvSubtype —
  // TVmaze's own genre list for a reality show usually doesn't include the
  // word "Reality" at all, so without this a reality show could otherwise
  // have no way to be filtered to on its own.
  const categoryGenres = useMemo(() => {
    const set = new Set<string>();
    wantToWatchItems.forEach((item) => {
      item.genres.forEach((g) => set.add(g));
      if (mediaType === "tv" && item.tvSubtype === "reality") set.add("Reality");
    });
    return Array.from(set).sort();
  }, [wantToWatchItems, mediaType]);

  const filteredItems = useMemo(() => {
    const filtered = wantToWatchItems.filter((item) => {
      // An item can carry several genres, so selecting one still surfaces
      // every item tagged with it, not just items where it's the only tag.
      // "Reality" additionally matches on tvSubtype, since it's a synthetic
      // filter option rather than a real genre tag.
      if (!filters.genre) return true;
      const matchesGenre = item.genres.includes(filters.genre);
      const matchesReality = filters.genre === "Reality" && item.tvSubtype === "reality";
      return matchesGenre || matchesReality;
    });
    return sortItems(filtered, filters.sort);
  }, [wantToWatchItems, filters]);

  const categoryFilterActive = Boolean(filters.genre);

  const manualOrderItems = useMemo(
    () => [...wantToWatchItems].sort((a, b) => a.sortOrder - b.sortOrder),
    [wantToWatchItems],
  );

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader
        title={CATEGORY_TITLE[mediaType]}
        // No Back in Edit Order — reordering saves immediately, so Done is
        // the only exit, same as Recommendations' own Edit Order.
        onBack={editOrderMode ? undefined : onBack}
        right={
          manualOrderItems.length > 1 ? (
            <button
              type="button"
              className={`btn btn--compact ${editOrderMode ? "btn--primary" : "btn--secondary"}`}
              onClick={() => setEditOrderMode((v) => !v)}
            >
              {editOrderMode ? "Done" : "Edit order"}
            </button>
          ) : undefined
        }
      />
      {!editOrderMode && categoryGenres.length > 0 && (
        <div className="category-screen__filter-tabs">
          <button
            type="button"
            className={`filter-tab ${!filters.genre ? "is-active" : ""}`}
            onClick={() => setFilters((f) => ({ ...f, genre: null }))}
          >
            All
          </button>
          {categoryGenres.map((genre) => (
            <button
              key={genre}
              type="button"
              className={`filter-tab ${filters.genre === genre ? "is-active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, genre }))}
            >
              {genre}
            </button>
          ))}
        </div>
      )}
      <div className="app-screen__scroll">
        {editOrderMode ? (
          <>
            <p className="text-muted reorder-hint">
              Drag the handle to reorder. First = what you want to watch most.
            </p>
            <ReorderableList
              items={manualOrderItems}
              onReorder={(orderedIds) => onReorder(mediaType, orderedIds)}
            />
          </>
        ) : (
          <WatchlistGrid
            items={filteredItems}
            hasAnyItems={categoryItems.length > 0}
            onSelect={onSelectItem}
            onAdd={onAdd}
            onClearFilters={() => setFilters({ ...DEFAULT_FILTERS, mediaType })}
            filtersActive={categoryFilterActive}
            eager
          />
        )}
      </div>
    </div>
  );
}
