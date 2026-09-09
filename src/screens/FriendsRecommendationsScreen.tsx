import { useMemo, useState } from "react";
import type { WatchlistItem } from "../types";
import type { FriendRecommendationGroup } from "../hooks/useFriendsRecommendations";
import type { FriendRecommendation } from "../lib/friendsRecommendationsApi";
import { isNotWatched } from "../lib/watchStatus";
import { Header } from "../components/Header";
import { PosterRail } from "../components/PosterRail";
import { TabBar } from "../components/TabBar";

type FilterMode = "not_watched" | "all";

interface FriendsRecommendationsScreenProps {
  onManageFriends: () => void;
  groups: FriendRecommendationGroup[];
  watchlistItems: WatchlistItem[];
  isNew: (recommendationId: string) => boolean;
  onSelectRecommendation: (recommendation: FriendRecommendation) => void;
  onSeeAllFriend: (friendUserId: string) => void;
  onSwitchTab: (tab: "watchlist" | "recommendations" | "friends") => void;
  onOpenMenu: () => void;
  friendRequestCount: number;
}

// This is now the "My Friends" tab's root — same shared Header as the other
// two tab roots (title only, no Friends icon since Friends *is* the tab
// now), plus the TabBar. Content below is unchanged from Phase 2B.
export function FriendsRecommendationsScreen({
  onManageFriends,
  groups,
  watchlistItems,
  isNew,
  onSelectRecommendation,
  onSeeAllFriend,
  onSwitchTab,
  onOpenMenu,
  friendRequestCount,
}: FriendsRecommendationsScreenProps) {
  const [filter, setFilter] = useState<FilterMode>("not_watched");

  const filteredGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        recommendations:
          filter === "all"
            ? group.recommendations
            : group.recommendations.filter((r) => isNotWatched(r, watchlistItems)),
      })),
    [groups, filter, watchlistItems],
  );

  return (
    <div className="app-screen">
      <Header title="Friends' Recommendations" onOpenMenu={onOpenMenu} />

      <div className="category-screen__filter-tabs">
        <button
          type="button"
          className={`filter-tab ${filter === "not_watched" ? "is-active" : ""}`}
          onClick={() => setFilter("not_watched")}
        >
          Not Watched
        </button>
        <button
          type="button"
          className={`filter-tab ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--compact friends-recs__manage-btn"
          onClick={onManageFriends}
        >
          Manage Friends
          {friendRequestCount > 0 && (
            <span className="icon-btn__badge" aria-hidden="true">
              {friendRequestCount > 9 ? "9+" : friendRequestCount}
            </span>
          )}
        </button>
      </div>

      <div className="app-screen__scroll">
        {filteredGroups.map((group) => {
          // An empty rail skips PosterRail entirely rather than passing it
          // a compact emptyState — PosterRail's own empty slot (.poster-rail__empty)
          // is a full-height, boxed placeholder by design (matching how a
          // real rail of tiles fills that same space), which is exactly the
          // "large gray rectangle" this needs to not be. The header markup
          // below intentionally mirrors PosterRail's own header exactly
          // (same classes) so a friend's title still reads identically
          // whether or not they currently have recommendations.
          if (group.recommendations.length === 0) {
            return (
              <div className="friend-rec-rail friend-rec-rail--empty" key={group.friendUserId}>
                <div className="poster-rail__header">
                  <h2 className="poster-rail__title">{group.username}'s Recommendations</h2>
                </div>
                <p className="text-muted friend-rec-rail__empty-text">No recommendations yet.</p>
              </div>
            );
          }

          const badges: Record<string, string> = {};
          for (const rec of group.recommendations) {
            if (isNew(rec.id)) badges[rec.id] = "NEW";
          }
          return (
            <div className="friend-rec-rail" key={group.friendUserId}>
              <PosterRail
                title={`${group.username}'s Recommendations`}
                items={group.recommendations}
                onSelect={onSelectRecommendation}
                onSeeAll={() => onSeeAllFriend(group.friendUserId)}
                badges={badges}
                eager
                emptyState={
                  <div className="poster-rail__empty-content">
                    <p className="text-muted">No recommendations yet.</p>
                  </div>
                }
              />
            </div>
          );
        })}
      </div>

      <TabBar activeTab="friends" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
    </div>
  );
}
