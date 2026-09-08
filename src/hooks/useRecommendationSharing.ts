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
  // Called whenever this hook converts a recommendation from "all" to
  // "selected" under the hood (see setVisibility/setAllVisibilityForFriendship
  // below) — lets the caller keep its own cached copy of the
  // recommendation's audience (useRecommendations' items) in sync, the
  // same way RecommendationSharingScreen's onSave already does after an
  // explicit edit.
  onAudienceChange: (recommendationId: string, audience: "all" | "selected") => void,
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

  // The actual, enforced answer to "can this friend see this recommendation" —
  // "all" is unconditionally visible (hidden rows are never stored against
  // it, and even a stray one would be ignored by the select policy), so
  // only "selected" recommendations ever consult the hidden-rows map. Both
  // visibleCountFor and Manage Friends' checkboxes go through this, rather
  // than reading the hidden map directly, so they never show restricted
  // state a "all" recommendation doesn't actually have.
  const isVisibleTo = useCallback(
    (recommendationId: string, friendshipId: string): boolean => {
      const rec = recommendations.find((r) => r.id === recommendationId);
      if (!rec) return false;
      if (rec.audience === "all") return true;
      return !hidden.get(recommendationId)?.has(friendshipId);
    },
    [hidden, recommendations],
  );

  // How many of my recommendations a given friend can currently see —
  // drives the Manage Friends count badge.
  const visibleCountFor = useCallback(
    (friendshipId: string): number =>
      recommendations.filter((r) => isVisibleTo(r.id, friendshipId)).length,
    [recommendations, isVisibleTo],
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
  // individual checkboxes. A recommendation still in "all" mode has to be
  // converted to "selected" the moment it's actually narrowed (hidden from
  // someone) — hidden rows are inert against "all" (see the select policy
  // in supabase/schema.sql) — but only then: showing someone a still-"all"
  // recommendation is already a no-op (they already see it), so that case
  // is skipped rather than writing a pointless hidden-row delete.
  // Converting hides *only* the one friend being unchecked, via the same
  // set_recommendation_audience RPC the per-recommendation Sharing screen
  // already uses — every other current friend keeps seeing it purely by
  // staying absent from the hidden set, and future friends are excluded
  // from that point on by accept_friend_request()'s own backfill, exactly
  // like any other "selected" recommendation.
  //
  // Both branches apply their optimistic update first (snappy checkbox,
  // same pattern as the rest of this hook) but roll it back — hidden set
  // and, for the "all" conversion, the recommendation's audience — if the
  // write actually fails server-side, so a failed toggle doesn't leave the
  // checkbox permanently showing a change that never persisted.
  const setVisibility = useCallback(
    (recommendationId: string, friendshipId: string, visible: boolean) => {
      const rec = recommendations.find((r) => r.id === recommendationId);
      if (!rec) return;

      const previousHidden = hidden.get(recommendationId) ?? new Set<string>();

      if (rec.audience === "all") {
        if (visible) return;
        setHiddenMap((prev) => {
          const next = new Map(prev);
          next.set(recommendationId, new Set([friendshipId]));
          return next;
        });
        onAudienceChange(recommendationId, "selected");
        recommendationSharingApi
          .saveAudience(recommendationId, "selected", [friendshipId])
          .catch((err) => {
            console.error(err);
            setHiddenMap((prev) => {
              const next = new Map(prev);
              next.set(recommendationId, previousHidden);
              return next;
            });
            onAudienceChange(recommendationId, "all");
          });
        return;
      }

      setHiddenMap((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(recommendationId) ?? []);
        if (visible) set.delete(friendshipId);
        else set.add(friendshipId);
        next.set(recommendationId, set);
        return next;
      });
      recommendationSharingApi.setHidden(recommendationId, friendshipId, !visible).catch((err) => {
        console.error(err);
        setHiddenMap((prev) => {
          const next = new Map(prev);
          next.set(recommendationId, previousHidden);
          return next;
        });
      });
    },
    [recommendations, hidden, onAudienceChange],
  );

  // Select All / Clear All for one friendship across every recommendation —
  // FriendVisibilityScreen's bulk actions. Same "all" -> "selected"
  // conversion as setVisibility above, but for every still-"all"
  // recommendation being hidden by a Clear All in one go — done inside
  // replaceHiddenForFriendship's own atomic RPC (see
  // replace_recommendation_hidden_friends_for_friendship in
  // supabase/schema.sql) rather than one RPC call per recommendation, to
  // keep the whole bulk action a single transaction. Select All never
  // converts anything: unhiding a friendship has nothing to convert for an
  // "all" recommendation (never hidden from anyone to begin with), and
  // must never flip a "selected" recommendation back to "all" even once
  // every current friend ends up unhidden.
  //
  // Same rollback-on-failure as setVisibility above: if the RPC fails,
  // every recommendation's hidden set reverts to its pre-action snapshot
  // and any optimistically-converted "all" -> "selected" recommendation
  // reverts its audience too, so a failed Select All/Clear All doesn't
  // leave the whole screen showing a change that never actually persisted.
  const setAllVisibilityForFriendship = useCallback(
    (friendshipId: string, visible: boolean) => {
      const toConvert = visible
        ? []
        : recommendations.filter((r) => r.audience === "all").map((r) => r.id);

      const previousHidden = hidden;

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
      for (const id of toConvert) onAudienceChange(id, "selected");

      const hideIds = visible ? [] : recommendations.map((r) => r.id);
      recommendationSharingApi.replaceHiddenForFriendship(friendshipId, hideIds).catch((err) => {
        console.error(err);
        setHiddenMap(previousHidden);
        for (const id of toConvert) onAudienceChange(id, "all");
      });
    },
    [recommendations, hidden, onAudienceChange],
  );

  return {
    loading,
    hiddenFor,
    isVisibleTo,
    visibleCountFor,
    setAudience,
    setVisibility,
    setAllVisibilityForFriendship,
  };
}
