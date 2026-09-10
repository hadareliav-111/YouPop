import { useMemo, useState } from "react";
import type { Recommendation } from "../types";
import { Header } from "../components/Header";
import { RecommendationCard } from "../components/RecommendationCard";
import { ReorderableList } from "../components/ReorderableList";
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

      {sorted.length === 0 ? (
        // Same shared .screen-empty wrapper Home's own empty state uses
        // (sits outside .app-screen__scroll, same as Home's — see that
        // class's own comment) rather than centering independently inside
        // the scroll container, so the two screens' empty states share one
        // real layout instead of two separately-tuned ones.
        <div className="screen-empty">
          <EmptyState
            icon="⭐"
            title="No recommendations yet"
            message="Search for a movie or show you'd recommend to others."
            actionLabel="+ Add Recommendation"
            onAction={onAdd}
          />
        </div>
      ) : (
        <div className="app-screen__scroll">
          {editOrderMode ? (
            <>
              <p className="text-muted reorder-hint">
                Drag the handle to reorder.
              </p>
              <ReorderableList items={sorted} onReorder={onReorder} />
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
      )}

      <TabBar activeTab="recommendations" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
    </div>
  );
}
