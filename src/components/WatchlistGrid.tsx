import type { WatchlistItem } from "../types";
import { ItemCard } from "./ItemCard";
import { EmptyState } from "./EmptyState";

interface WatchlistGridProps {
  items: WatchlistItem[];
  hasAnyItems: boolean;
  onSelect: (item: WatchlistItem) => void;
  onAdd: () => void;
  onClearFilters: () => void;
  filtersActive: boolean;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string | null;
}

export function WatchlistGrid({
  items,
  hasAnyItems,
  onSelect,
  onAdd,
  onClearFilters,
  filtersActive,
  emptyIcon = "🍿",
  emptyTitle = "Your watchlist is empty",
  emptyMessage = "Add a movie or show you want to watch.",
  emptyActionLabel = "+ Add something",
}: WatchlistGridProps) {
  if (!hasAnyItems) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        message={emptyMessage}
        actionLabel={emptyActionLabel ?? undefined}
        onAction={emptyActionLabel ? onAdd : undefined}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="No matches"
        message={
          filtersActive
            ? "Nothing matches these filters. Try loosening them up."
            : "Nothing matches your search."
        }
        actionLabel={filtersActive ? "Clear filters" : undefined}
        onAction={filtersActive ? onClearFilters : undefined}
      />
    );
  }

  return (
    <div className="watchlist-grid">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onClick={() => onSelect(item)} />
      ))}
    </div>
  );
}
