import { useMemo, useState } from "react";
import type { WatchlistItem } from "../types";
import { DEFAULT_FILTERS, type Filters } from "../types/filters";
import { ScreenHeader } from "../components/ScreenHeader";
import { FilterBar } from "../components/FilterBar";
import { WatchlistGrid } from "../components/WatchlistGrid";

interface WatchedScreenProps {
  items: WatchlistItem[];
  onBack: () => void;
  onSelectItem: (item: WatchlistItem) => void;
}

const BASE_FILTERS: Filters = { ...DEFAULT_FILTERS, status: "watched", sort: "recent" };

export function WatchedScreen({ items, onBack, onSelectItem }: WatchedScreenProps) {
  const [filters, setFilters] = useState<Filters>(BASE_FILTERS);

  const watchedItems = useMemo(
    () => items.filter((item) => item.status === "watched"),
    [items],
  );

  const genres = useMemo(() => {
    const set = new Set<string>();
    watchedItems.forEach((item) => item.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [watchedItems]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    watchedItems.forEach((item) => item.personalTags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [watchedItems]);

  const recommenders = useMemo(() => {
    const set = new Set<string>();
    watchedItems.forEach((item) => {
      if (item.recommendedBy) set.add(item.recommendedBy);
    });
    return Array.from(set).sort();
  }, [watchedItems]);

  const filteredItems = useMemo(() => {
    const filtered = watchedItems.filter((item) => {
      if (filters.mediaType !== "all" && item.mediaType !== filters.mediaType) return false;
      if (filters.genre && !item.genres.includes(filters.genre)) return false;
      if (filters.tag && !item.personalTags.includes(filters.tag)) return false;
      if (filters.recommended === "yes" && !item.isRecommendation) return false;
      if (filters.recommended === "no" && item.isRecommendation) return false;
      if (filters.recommender && item.recommendedBy !== filters.recommender) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (filters.sort) {
      case "rating":
        return sorted.sort((a, b) => (b.personalRating ?? -1) - (a.personalRating ?? -1));
      case "year":
        return sorted.sort((a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0));
      case "manual":
        return sorted.sort((a, b) => a.sortOrder - b.sortOrder);
      case "recent":
      default:
        return sorted.sort((a, b) => (b.dateWatched ?? "").localeCompare(a.dateWatched ?? ""));
    }
  }, [watchedItems, filters]);

  const filtersActive =
    filters.mediaType !== "all" ||
    Boolean(filters.genre) ||
    Boolean(filters.tag) ||
    filters.recommended !== "all" ||
    Boolean(filters.recommender);

  return (
    <div className="app-screen">
      <ScreenHeader title="Watched" onBack={onBack} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        genres={genres}
        tags={tags}
        recommenders={recommenders}
        hideMoreFilters
      />
      <div className="app-screen__scroll">
        <WatchlistGrid
          items={filteredItems}
          hasAnyItems={watchedItems.length > 0}
          onSelect={onSelectItem}
          onAdd={() => {}}
          onClearFilters={() => setFilters(BASE_FILTERS)}
          filtersActive={filtersActive}
          emptyIcon="✅"
          emptyTitle="Nothing watched yet"
          emptyMessage="Once you mark something as watched, it'll show up here."
          emptyActionLabel={null}
        />
      </div>
    </div>
  );
}
