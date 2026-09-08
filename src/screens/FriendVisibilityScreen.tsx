import { useMemo } from "react";
import type { Recommendation } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState } from "../components/EmptyState";
import { useSwipeBack } from "../hooks/useSwipeBack";

interface FriendVisibilityScreenProps {
  username: string;
  recommendations: Recommendation[];
  isVisible: (recommendationId: string) => boolean;
  onToggle: (recommendationId: string, visible: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onBack: () => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// Manage Friends' "open a friend to see/change what they can see" screen —
// deliberately a plain checklist of the owner's own recommendations, not a
// permissions-management UI: Select All, Clear All, and per-item toggles,
// applied immediately (no separate Save step), same as any other list
// action elsewhere in the app.
export function FriendVisibilityScreen({
  username,
  recommendations,
  isVisible,
  onToggle,
  onSelectAll,
  onClearAll,
  onBack,
  onSwipeActiveChange,
}: FriendVisibilityScreenProps) {
  const sorted = useMemo(
    () => [...recommendations].sort((a, b) => a.sortOrder - b.sortOrder),
    [recommendations],
  );
  const visibleCount = sorted.filter((r) => isVisible(r.id)).length;

  // Edge-swipe-to-go-back — see useSwipeBack's own comment for why it
  // can't collide with normal scrolling here.
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader title={`Shared with ${username}`} onBack={onBack} />

      <div className="app-screen__scroll">
        {sorted.length === 0 ? (
          <EmptyState icon="⭐" title="No recommendations yet" message="Add a recommendation to share it with friends." />
        ) : (
          <>
            <p className="text-muted">
              {visibleCount} of {sorted.length} shared
            </p>
            <div className="audience-picker__friends">
              <div className="audience-picker__actions">
                <button type="button" className="link-btn" onClick={onSelectAll}>
                  Select All
                </button>
                <button type="button" className="link-btn" onClick={onClearAll}>
                  Clear All
                </button>
              </div>
              <div className="audience-picker__friend-grid">
                {sorted.map((rec) => (
                  <label className="audience-picker__friend-row" key={rec.id}>
                    <input
                      type="checkbox"
                      className="audience-picker__friend-checkbox"
                      checked={isVisible(rec.id)}
                      onChange={(e) => onToggle(rec.id, e.target.checked)}
                    />
                    <span className="audience-picker__friend-name">{rec.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
