import { useCallback, useEffect, useState } from "react";
import type { Recommendation } from "../types";
import * as recommendationsApi from "../lib/recommendationsApi";

// Mirrors useWatchlist.ts's shape and persistence pattern exactly, against
// the separate `recommendations` table — Supabase is the sole source of
// truth here too, no localStorage involved.
export function useRecommendations(userId: string | null) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    recommendationsApi
      .fetchAll(userId)
      .then((remote) => {
        if (!cancelled) setItems(remote);
      })
      .catch((err) => {
        console.error("Failed to load recommendations", err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const addRecommendation = useCallback(
    // onPersisted (optional) fires only once the insert has actually
    // committed — used by the sharing feature to write this
    // recommendation's audience only after its row exists, avoiding a
    // foreign-key race against recommendation_hidden_friends.
    (rec: Recommendation, onPersisted?: () => void) => {
      const maxOrder = items.reduce((max, r) => Math.max(max, r.sortOrder), -1);
      const withOrder = { ...rec, sortOrder: maxOrder + 1 };
      setItems((prev) => [withOrder, ...prev]);
      if (userId) {
        recommendationsApi
          .insertOne(userId, withOrder)
          .then(() => onPersisted?.())
          .catch(console.error);
      }
    },
    [items, userId],
  );

  const updateNote = useCallback(
    (id: string, note: string | null) => {
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, note } : r)),
      );
      if (userId) {
        recommendationsApi.updateNote(userId, id, note).catch(console.error);
      }
    },
    [userId],
  );

  const deleteRecommendation = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((r) => r.id !== id));
      if (userId) {
        recommendationsApi.remove(userId, id).catch(console.error);
      }
    },
    [userId],
  );

  const reorder = useCallback(
    (orderedIds: string[]) => {
      const positionById = new Map(orderedIds.map((id, index) => [id, index]));
      setItems((prev) =>
        prev.map((r) =>
          positionById.has(r.id) ? { ...r, sortOrder: positionById.get(r.id)! } : r,
        ),
      );
      if (userId) {
        recommendationsApi.reorder(userId, orderedIds).catch(console.error);
      }
    },
    [userId],
  );

  // Local-only optimistic sync, no persistence of its own — the actual
  // write goes through the sharing RPC (useRecommendationSharing.
  // setAudience, which sets both recommendations.audience and the
  // hidden-friend rows atomically in one call). This just keeps this
  // hook's own cached copy of the recommendation in sync after that call
  // succeeds, the same way the object passed to addRecommendation already
  // carries the right audience from the moment it's created.
  const setAudienceLocal = useCallback((id: string, audience: Recommendation["audience"]) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, audience } : r)));
  }, []);

  const alreadyRecommended = useCallback(
    (source: string, externalId: string) =>
      items.some((r) => r.externalSource === source && r.externalId === externalId),
    [items],
  );

  return {
    items,
    loading,
    addRecommendation,
    updateNote,
    deleteRecommendation,
    reorder,
    alreadyRecommended,
    setAudienceLocal,
  };
}
