import { useMemo } from "react";
import type { MediaType, WatchlistItem } from "../types";
import { Header } from "../components/Header";
import { PosterRail } from "../components/PosterRail";
import { EmptyState } from "../components/EmptyState";
import { useNextEpisodes } from "../hooks/useNextEpisodes";
import { getReleaseAvailability, formatShortComingLabel } from "../lib/availability";
import { TabBar } from "../components/TabBar";

function comingBadges(items: WatchlistItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) {
    if (item.releaseDate && getReleaseAvailability(item.releaseDate) === "upcoming") {
      map[item.id] = formatShortComingLabel(item.releaseDate);
    }
  }
  return map;
}

interface HomeScreenProps {
  items: WatchlistItem[];
  onSelectItem: (item: WatchlistItem) => void;
  onOpenCategory: (mediaType: MediaType) => void;
  onAdd: () => void;
  onOpenWatched: () => void;
  onOpenMenu: () => void;
  onSwitchTab: (tab: "watchlist" | "recommendations" | "friends") => void;
  friendRequestCount: number;
}

function byManualOrder(a: WatchlistItem, b: WatchlistItem): number {
  return a.sortOrder - b.sortOrder;
}

export function HomeScreen({
  items,
  onSelectItem,
  onOpenCategory,
  onAdd,
  onOpenWatched,
  onOpenMenu,
  onSwitchTab,
  friendRequestCount,
}: HomeScreenProps) {
  const currentlyWatchingUnsorted = useMemo(
    () => items.filter((i) => i.status === "currently_watching"),
    [items],
  );

  // Movies and TV Shows represent Want to Watch specifically — each item
  // has exactly one active status, so once something moves to Currently
  // Watching or Watched it belongs only there, never lingering here too.
  // They default to the user's manual "how much I want to watch this"
  // order, per their own per-category ordering — never affected by each
  // other.
  const movies = useMemo(
    () =>
      items
        .filter((i) => i.mediaType === "movie" && i.status === "want_to_watch")
        .sort(byManualOrder),
    [items],
  );
  const tvShows = useMemo(
    () =>
      items
        .filter((i) => i.mediaType === "tv" && i.status === "want_to_watch")
        .sort(byManualOrder),
    [items],
  );

  const episodeStatuses = useNextEpisodes(currentlyWatchingUnsorted);

  // On a cold load, episodeStatuses fills in one item at a time as each
  // item's own TVmaze request resolves (see useNextEpisodes) — re-sorting
  // on every single one of those would visibly shuffle the rail into place
  // over several steps. Waiting for every currently-watching item to have
  // resolved at least once before sorting at all means the rail shows one
  // stable (unsorted) order throughout that loading window, then jumps
  // straight to the final correct order exactly once. On a warm cache,
  // useNextEpisodes already seeds every status synchronously on first
  // render, so this is true immediately and the correct order still shows
  // with no delay — unchanged from before.
  const allEpisodeStatusesResolved = currentlyWatchingUnsorted.every(
    (item) => episodeStatuses[item.id] !== undefined,
  );

  // Available now, then soonest upcoming, then "no upcoming episode" last —
  // this is the one rail where an automatic priority order (not manual
  // drag order) makes sense, since "what's actually ready to watch" is the
  // whole point of Currently Watching.
  const currentlyWatching = useMemo(() => {
    if (!allEpisodeStatusesResolved) return currentlyWatchingUnsorted;
    return [...currentlyWatchingUnsorted].sort((a, b) => {
      const sa = episodeStatuses[a.id]?.sortKey ?? Infinity;
      const sb = episodeStatuses[b.id]?.sortKey ?? Infinity;
      // sa === sb (including both still Infinity) must resolve to a
      // well-defined tie — Infinity - Infinity is NaN, which is not a
      // valid comparator result and leaves ties in engine-dependent order.
      return sa === sb ? 0 : sa - sb;
    });
  }, [currentlyWatchingUnsorted, episodeStatuses, allEpisodeStatusesResolved]);

  const currentlyWatchingBadges = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, status] of Object.entries(episodeStatuses)) {
      map[id] = status.label;
    }
    return map;
  }, [episodeStatuses]);

  const movieBadges = useMemo(() => comingBadges(movies), [movies]);
  const tvBadges = useMemo(() => comingBadges(tvShows), [tvShows]);

  if (items.length === 0) {
    return (
      <div className="home-screen">
        <Header title="My Watchlist" onAdd={onAdd} onOpenWatched={onOpenWatched} onOpenMenu={onOpenMenu} />
        <div className="screen-empty">
          <EmptyState
            icon="🍿"
            title="Your watchlist is empty"
            message="Add a movie or show you want to watch."
            actionLabel="+ Add something"
            onAction={onAdd}
          />
        </div>
        <TabBar activeTab="watchlist" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
      </div>
    );
  }

  return (
    <div className="home-screen">
      <Header title="My Watchlist" onAdd={onAdd} onOpenWatched={onOpenWatched} onOpenMenu={onOpenMenu} />

      <div className="home-rails">
        <PosterRail
          title="Currently Watching"
          items={currentlyWatching}
          onSelect={onSelectItem}
          badges={currentlyWatchingBadges}
          grow={1.25}
          eager
          emptyState={
            <div className="poster-rail__empty-content">
              <p>Nothing here yet.</p>
              <p className="text-muted">
                Mark a show as Currently Watching from its detail page to see
                what's coming up next.
              </p>
            </div>
          }
        />

        <PosterRail
          title="TV Shows"
          items={tvShows}
          onSelect={onSelectItem}
          onSeeAll={() => onOpenCategory("tv")}
          badges={tvBadges}
          eager
          emptyState={
            <div className="poster-rail__empty-content">
              <p className="text-muted">No TV shows added yet.</p>
            </div>
          }
        />

        <PosterRail
          title="Movies"
          items={movies}
          onSelect={onSelectItem}
          onSeeAll={() => onOpenCategory("movie")}
          badges={movieBadges}
          eager
          emptyState={
            <div className="poster-rail__empty-content">
              <p className="text-muted">No movies added yet.</p>
            </div>
          }
        />
      </div>

      <TabBar activeTab="watchlist" onSwitchTab={onSwitchTab} friendRequestCount={friendRequestCount} />
    </div>
  );
}
