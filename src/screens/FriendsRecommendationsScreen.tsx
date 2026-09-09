import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const screenRef = useRef<HTMLDivElement>(null);
  const measureFixtureRef = useRef<HTMLDivElement>(null);
  const measureHeaderSpacerRef = useRef<HTMLDivElement>(null);
  const measureTabBarSpacerRef = useRef<HTMLDivElement>(null);
  const measureRailRef = useRef<HTMLDivElement>(null);

  // Makes each friend's rail tiles render at exactly the same size as
  // Home's TV Shows/Movies rail tiles — by measuring a real, hidden
  // instance of Home's own layout rather than recomputing it via a
  // formula. This screen can't reuse Home's flex-grow split *in place*
  // (Home splits one fixed, non-scrolling screen height across exactly 3
  // siblings; this screen is an unbounded, independently-scrolling list of
  // friends, and flex-grow's per-item size inherently depends on how many
  // siblings share it — those two shapes can't be the same live layout),
  // so instead a hidden fixture below reproduces Home's actual DOM/CSS
  // shape (the real .home-rails class + three .poster-rail-classed
  // elements carrying Home's real grow ratios — see HomeScreen.tsx) sized
  // to this screen's own real, live Header/TabBar heights. The browser's
  // own flexbox layout does the division; this effect only reads off the
  // resulting grow:1 rail's height and hands it to .friend-rec-rail (see
  // its own comment) as --frs-rail-h — no arithmetic of ours involved.
  useLayoutEffect(() => {
    const screenEl = screenRef.current;
    const fixtureEl = measureFixtureRef.current;
    const headerSpacerEl = measureHeaderSpacerRef.current;
    const tabBarSpacerEl = measureTabBarSpacerRef.current;
    const railEl = measureRailRef.current;
    if (!screenEl || !fixtureEl || !headerSpacerEl || !tabBarSpacerEl || !railEl) return;
    const headerEl = screenEl.querySelector<HTMLElement>(".app-header");
    const tabBarEl = screenEl.querySelector<HTMLElement>(".tab-bar");
    if (!headerEl || !tabBarEl) return;

    const measure = () => {
      fixtureEl.style.height = `${screenEl.getBoundingClientRect().height}px`;
      headerSpacerEl.style.height = `${headerEl.getBoundingClientRect().height}px`;
      tabBarSpacerEl.style.height = `${tabBarEl.getBoundingClientRect().height}px`;
      screenEl.style.setProperty("--frs-rail-h", `${railEl.getBoundingClientRect().height}px`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screenEl);
    observer.observe(headerEl);
    observer.observe(tabBarEl);
    return () => observer.disconnect();
  }, []);

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
    <div className="app-screen" ref={screenRef}>
      {/* Hidden measurement-only fixture — see the useLayoutEffect above.
          position:fixed takes it out of normal flow entirely, so it never
          affects this screen's visible layout, scrolling, or spacing; it
          exists purely so the browser can lay out a real copy of Home's
          rail structure and hand back a real pixel height to read. */}
      <div
        ref={measureFixtureRef}
        aria-hidden="true"
        className="frs-rail-measure"
      >
        <div ref={measureHeaderSpacerRef} className="frs-rail-measure__spacer" />
        <div className="home-rails">
          {/* Grow ratios must match HomeScreen.tsx's own PosterRail props
              (1.25 : 1 : 1) exactly — this is the same 3-way split Home
              itself uses, just reproduced here so its real, live layout
              result (the middle, grow:1 rail's height) can be measured. */}
          <div className="poster-rail" style={{ flexGrow: 1.25 }} />
          <div ref={measureRailRef} className="poster-rail" style={{ flexGrow: 1 }} />
          <div className="poster-rail" style={{ flexGrow: 1 }} />
        </div>
        <div ref={measureTabBarSpacerRef} className="frs-rail-measure__spacer" />
      </div>

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
              {/* Cancels .app-screen__scroll's own 1rem horizontal padding
                  (see .friend-rec-rail__bleed's own comment) so .poster-rail's
                  matching 1rem padding is the *only* horizontal inset here,
                  same as Home's rails — which sit inside .home-rails (no
                  horizontal padding of its own) instead of a padded
                  scroll container. Without this, the two paddings stacked,
                  narrowing this rail's available width and making its tiles
                  read smaller/more cramped than Home's for the same height. */}
              <div className="friend-rec-rail__bleed">
                {/* Zero-height decoy — exists only so the real .poster-rail
                    right after it matches the existing `.poster-rail +
                    .poster-rail` CSS rule (see that rule's own comment),
                    the same rule Home's own TV Shows/Movies rails already
                    rely on for their padding/border. Without a preceding
                    .poster-rail sibling, this rail's real .poster-rail is
                    always the CSS-adjacency "first" one and silently falls
                    back to lighter padding — which is what was making
                    these tiles render larger than Home's. */}
                <div className="poster-rail friend-rec-rail__decoy" aria-hidden="true" />
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
            </div>
          );
        })}
      </div>

      <TabBar activeTab="friends" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
    </div>
  );
}
