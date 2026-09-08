import type { ReactNode } from "react";
import type { PosterEntry } from "../types";
import { RailTile } from "./RailTile";

interface PosterRailProps<T extends PosterEntry> {
  title: string;
  items: T[];
  onSelect: (item: T) => void;
  onSeeAll?: () => void;
  badges?: Record<string, string>;
  emptyState: ReactNode;
  grow?: number;
  // See RailTile's own comment. Passed through unchanged to every tile in
  // this rail.
  eager?: boolean;
}

export function PosterRail<T extends PosterEntry>({
  title,
  items,
  onSelect,
  onSeeAll,
  badges,
  emptyState,
  grow = 1,
  eager,
}: PosterRailProps<T>) {
  return (
    <section className="poster-rail" style={{ flexGrow: grow }}>
      <div className="poster-rail__header">
        <h2 className="poster-rail__title">{title}</h2>
        {onSeeAll && items.length > 0 && (
          <button type="button" className="poster-rail__see-all" onClick={onSeeAll}>
            See all ›
          </button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="poster-rail__scroll">
          {items.map((item) => (
            <RailTile
              key={item.id}
              item={item}
              badge={badges?.[item.id]}
              onClick={() => onSelect(item)}
              eager={eager}
            />
          ))}
        </div>
      ) : (
        <div className="poster-rail__empty">{emptyState}</div>
      )}
    </section>
  );
}
