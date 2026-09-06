import { useCallback, useEffect, useState } from "react";
import type { EpisodeRef, WatchlistItem } from "../types";
import * as watchlistApi from "../lib/watchlistApi";

// Supabase is the sole source of truth for a logged-in user's watchlist —
// this hook never reads or writes the old `watchlist:items` localStorage
// key. (Export/Import in MenuModal are unrelated: they work with an
// explicit file the user chooses, not localStorage, and keep working
// unchanged.)
export function useWatchlist(userId: string | null) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    watchlistApi
      .fetchAll(userId)
      .then((remote) => {
        if (!cancelled) setItems(remote);
      })
      .catch((err) => {
        console.error("Failed to load watchlist", err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Shared by updateItem and every status-mark helper below, so the
  // Supabase-sync call exists in exactly one place instead of six.
  const applyPatch = useCallback(
    (id: string, patch: Partial<WatchlistItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      if (userId) {
        watchlistApi.updatePatch(userId, id, patch).catch(console.error);
      }
    },
    [userId],
  );

  const addItem = useCallback(
    (item: WatchlistItem) => {
      const maxOrder = items
        .filter((i) => i.mediaType === item.mediaType)
        .reduce((max, i) => Math.max(max, i.sortOrder), -1);
      // New items start at the back of their category's manual order (lowest
      // priority) — the user drags them up if they actually want it sooner.
      const withOrder = { ...item, sortOrder: maxOrder + 1 };
      setItems((prev) => [withOrder, ...prev]);
      if (userId) {
        watchlistApi.insertOne(userId, withOrder).catch(console.error);
      }
    },
    [items, userId],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<WatchlistItem>) => applyPatch(id, patch),
    [applyPatch],
  );

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (userId) {
        watchlistApi.remove(userId, id).catch(console.error);
      }
    },
    [userId],
  );

  const markWatched = useCallback(
    (id: string) =>
      applyPatch(id, { status: "watched", dateWatched: new Date().toISOString() }),
    [applyPatch],
  );

  const markWantToWatch = useCallback(
    (id: string) =>
      applyPatch(id, { status: "want_to_watch", dateWatched: null, personalRating: null }),
    [applyPatch],
  );

  const markCurrentlyWatching = useCallback(
    (id: string) =>
      applyPatch(id, {
        status: "currently_watching",
        dateWatched: null,
        personalRating: null,
      }),
    [applyPatch],
  );

  const setCurrentEpisode = useCallback(
    (id: string, episode: EpisodeRef | null) => applyPatch(id, { currentEpisode: episode }),
    [applyPatch],
  );

  const setPersonalRating = useCallback(
    (id: string, rating: number | null) => applyPatch(id, { personalRating: rating }),
    [applyPatch],
  );

  // Applies a full manual reorder for one category (mediaType). Other
  // categories' sortOrder values are never touched, so reordering Movies
  // can never affect TV Shows and vice versa.
  const reorderCategory = useCallback(
    (mediaType: WatchlistItem["mediaType"], orderedIds: string[]) => {
      const positionById = new Map(orderedIds.map((id, index) => [id, index]));
      setItems((prev) =>
        prev.map((item) =>
          item.mediaType === mediaType && positionById.has(item.id)
            ? { ...item, sortOrder: positionById.get(item.id)! }
            : item,
        ),
      );
      if (userId) {
        watchlistApi.reorder(userId, orderedIds).catch(console.error);
      }
    },
    [userId],
  );

  const replaceAll = useCallback(
    (next: WatchlistItem[]) => {
      setItems(next);
      if (userId) {
        watchlistApi.replaceAll(userId, next).catch(console.error);
      }
    },
    [userId],
  );

  const alreadyAdded = useCallback(
    (source: string, externalId: string) =>
      items.some(
        (item) => item.externalSource === source && item.externalId === externalId,
      ),
    [items],
  );

  return {
    items,
    loading,
    addItem,
    updateItem,
    deleteItem,
    markWatched,
    markWantToWatch,
    markCurrentlyWatching,
    setCurrentEpisode,
    setPersonalRating,
    reorderCategory,
    replaceAll,
    alreadyAdded,
  };
}
