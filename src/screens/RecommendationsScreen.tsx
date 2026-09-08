import { useMemo, useState } from "react";
import type { Recommendation } from "../types";
import { Header } from "../components/Header";
import { RecommendationCard } from "../components/RecommendationCard";
import { ReorderableGrid } from "../components/ReorderableGrid";
import { EmptyState } from "../components/EmptyState";
import { TabBar } from "../components/TabBar";

interface RecommendationsScreenProps {
  items: Recommendation[];
  onSelect: (recommendation: Recommendation) => void;
  onAdd: () => void;
  onReorder: (orderedIds: string[]) => void;
  onSwitchTab: (tab: "watchlist" | "recommendations" | "friends") => void;
  onOpenMenu: () => void;
  friendRequestCount: number;
}

export function RecommendationsScreen({
  items,
  onSelect,
  onAdd,
  onReorder,
  onSwitchTab,
  onOpenMenu,
  friendRequestCount,
}: RecommendationsScreenProps) {
  const [editOrderMode, setEditOrderMode] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    [items],
  );

  return (
    <div className="app-screen">
      {/* Same shared Header as Home/Watchlist — identical title position,
          typography, and header height, so the two tabs feel like one app.
          Add hides during Edit Order, matching the previous behavior. */}
      <Header
        title="My Recommendations"
        onAdd={editOrderMode ? undefined : onAdd}
        onOpenMenu={onOpenMenu}
      />

      {sorted.length > 1 && (
        <div className="category-screen__filter-tabs">
          <button
            type="button"
            className="filter-tab"
            onClick={() => setEditOrderMode((v) => !v)}
          >
            {editOrderMode ? "Done" : "Edit order"}
          </button>
        </div>
      )}

      <div className="app-screen__scroll">
        {sorted.length === 0 ? (
          <EmptyState
            icon="⭐"
            title="No recommendations yet"
            message="Search for a movie or show you'd recommend to others."
            actionLabel="+ Add Recommendation"
            onAction={onAdd}
          />
        ) : editOrderMode ? (
          <>
            <p className="text-muted reorder-hint">
              Press and drag a poster to reorder.
            </p>
            <ReorderableGrid items={sorted} onReorder={onReorder} />
          </>
        ) : (
          <div className="watchlist-grid">
            {sorted.map((rec) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onClick={() => onSelect(rec)}
                eager
              />
            ))}
          </div>
        )}
      </div>

      <TabBar activeTab="recommendations" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
    </div>
  );
}
