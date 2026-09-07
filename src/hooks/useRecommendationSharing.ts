import { useCallback, useEffect, useMemo, useState } from "react";
import type { Recommendation } from "../types";
import type { FriendEntry } from "./useFriends";
import * as recommendationSharingApi from "../lib/recommendationSharingApi";

// Per-recommendation, per-friendship "hidden" state for the current user's
// own recommendations — Supabase is the source of truth, same optimistic
// local-update + fire-and-forget persistence pattern as every other hook
// here. Keyed by recommendation_id -> Set<friendship_id hidden from it>;
// absence of an id in the set means "visible" (the default).
export function useRecommendationSharing(
  userId: string | null,
  recommendations: Recommendation[],
  friends: FriendEntry[],
) {
  const [hidden, setHiddenMap] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  const recommendationIdsKey = useMemo(
    () => recommendations.map((r) => r.id).sort().join(","),
    [recommendations],
  );
  // Also refetches when the friend list itself changes (accept/remove) —
  // accepting seeds new hidden rows server-side (see accept_friend_request
  // in supabase/schema.sql) that this cache wouldn't otherwise know about.
  const friendshipIdsKey = useMemo(
    () => friends.map((f) => f.friendshipId).sort().join(","),
    [friends],
  );

  useEffect(() => {
    const recommendationIds = recommendations.map((r) => r.id);
    if (!userId || recommendationIds.length === 0) {
      setHiddenMap(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    recommendationSharingApi
      .fetchHidden(recommendationIds)
      .then((pairs) => {
        if (cancelled) return;
        const map = new Map<string, Set<string>>();
        for (const pair of pairs) {
          const set = map.get(pair.recommendationId) ?? new Set<string>();
          set.add(pair.friendshipId);
          map.set(pair.recommendationId, set);
        }
        setHiddenMap(map);
      })
      .catch((err) => {
        console.error("Failed to load recommendation sharing", err);
        if (!cancelled) setHiddenMap(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // recommendationIdsKey/friendshipIdsKey (not the arrays themselves) are
    // the intentional deps — same stable-proxy pattern as
    // useFriendsRecommendations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, recommendationIdsKey, friendshipIdsKey]);

  const hiddenFor = useCallback(
    (recommendationId: string): Set<string> => hidden.get(recommendationId) ?? new Set<string>(),
    [hidden],
  );

  // How many of my recommendations a given friend can currently see —
  // drives the Manage Friends count badge.
  const visibleCountFor = useCallback(
    (friendshipId: string): number =>
      recommendations.filter((r) => !hidden.get(r.id)?.has(friendshipId)).length,
    [hidden, recommendations],
  );

  // Sets the full audience for one recommendation at once — mode plus
  // hidden set, in that one atomic call — Add flow and Detail/Edit's
  // "Shared with" Save both resolve their {all|selected} choice down to
  // this. Returns the persist promise (rather than swallowing it here)
  // so a Save flow can await it before navigating away — awaiting
  // matters: without it, a second edit could start (and finish) before
  // the first one's write had landed. Only updates this hook's own
  // hidden-rows cache; the caller is responsible for also syncing
  // useRecommendations' cached `audience` field on the recommendation
  // (see useRecommendations.setAudienceLocal) since that field lives on
  // a different hook's state.
  const setAudience = useCallback(
    (recommendationId: string, audience: "all" | "selected", hiddenFriendshipIds: string[]): Promise<void> => {
      setHiddenMap((prev) => {
        const next = new Map(prev);
        next.set(recommendationId, new Set(hiddenFriendshipIds));
        return next;
      });
      return recommendationSharingApi.saveAudience(recommendationId, audience, hiddenFriendshipIds);
    },
    [],
  );

  // Toggles one (recommendation, friendship) pair — FriendVisibilityScreen's
  // individual checkboxes.
  const setVisibility = useCallback(
    (recommendationId: string, friendshipId: string, visible: boolean) => {
      setHiddenMap((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(recommendationId) ?? []);
        if (visible) set.delete(friendshipId);
        else set.add(friendshipId);
        next.set(recommendationId, set);
        return next;
      });
      recommendationSharingApi.setHidden(recommendationId, friendshipId, !visible).catch(console.error);
    },
    [],
  );

  // Select All / Clear All for one friendship across every recommendation
  // — FriendVisibilityScreen's bulk actions.
  const setAllVisibilityForFriendship = useCallback(
    (friendshipId: string, visible: boolean) => {
      setHiddenMap((prev) => {
        const next = new Map(prev);
        for (const r of recommendations) {
          const set = new Set(next.get(r.id) ?? []);
          if (visible) set.delete(friendshipId);
          else set.add(friendshipId);
          next.set(r.id, set);
        }
        return next;
      });
      const hideIds = visible ? [] : recommendations.map((r) => r.id);
      recommendationSharingApi.replaceHiddenForFriendship(friendshipId, hideIds).catch(console.error);
    },
    [recommendations],
  );

  return {
    loading,
    hiddenFor,
    visibleCountFor,
    setAudience,
    setVisibility,
    setAllVisibilityForFriendship,
  };
}
