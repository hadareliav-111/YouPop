import { useCallback, useEffect, useMemo, useState } from "react";
import type { FriendEntry } from "./useFriends";
import * as friendsRecommendationsApi from "../lib/friendsRecommendationsApi";
import type { FriendRecommendation } from "../lib/friendsRecommendationsApi";

export interface FriendRecommendationGroup {
  friendUserId: string;
  username: string;
  recommendations: FriendRecommendation[];
}

// Supabase is the sole source of truth here too — no localStorage, same
// convention as every other hook in this app. The "New" marker logic is
// the one thing that isn't a simple mirror of useWatchlist/
// useRecommendations: see the effect below for why the seen-set has to be
// snapshotted *before* marking anything as viewed.
export function useFriendsRecommendations(userId: string | null, friends: FriendEntry[]) {
  const [recommendations, setRecommendations] = useState<FriendRecommendation[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // A stable proxy for "which friends" so this only re-fetches when the
  // actual set of accepted friends changes (e.g. a removal), not on every
  // new-array-reference render of `friends` from useFriends.
  const friendIdsKey = useMemo(
    () => friends.map((f) => f.userId).sort().join(","),
    [friends],
  );

  useEffect(() => {
    if (!userId || friends.length === 0) {
      setRecommendations([]);
      setSeenIds(new Set());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const friendIds = friends.map((f) => f.userId);
        const [recs, viewed] = await Promise.all([
          friendsRecommendationsApi.fetchForFriends(friendIds),
          friendsRecommendationsApi.fetchViewedIds(userId),
        ]);
        if (cancelled) return;

        // This visit's "New" badges are based on what was seen *before*
        // this load — rendering with `viewed` (not the post-mark-viewed
        // state) is what lets the user actually see the badge during this
        // visit rather than it vanishing on first paint.
        setRecommendations(recs);
        setSeenIds(viewed);

        const unseenIds = recs.map((r) => r.id).filter((id) => !viewed.has(id));
        if (unseenIds.length > 0) {
          friendsRecommendationsApi.markViewed(userId, unseenIds).catch(console.error);
        }
      } catch (err) {
        console.error("Failed to load friends' recommendations", err);
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // friendIdsKey (not `friends`) is the intentional dependency — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, friendIdsKey]);

  // Grouped from the *current* `friends` (not the possibly-stale closure
  // the fetch effect used) so every friend always gets a group/rail, even
  // with zero recommendations, and usernames stay fresh.
  const groupedByFriend: FriendRecommendationGroup[] = useMemo(() => {
    const byFriend = new Map<string, FriendRecommendation[]>();
    for (const rec of recommendations) {
      const list = byFriend.get(rec.friendUserId) ?? [];
      list.push(rec);
      byFriend.set(rec.friendUserId, list);
    }
    return friends
      .map((f) => ({
        friendUserId: f.userId,
        username: f.username,
        recommendations: (byFriend.get(f.userId) ?? [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [recommendations, friends]);

  const isNew = useCallback((recommendationId: string) => !seenIds.has(recommendationId), [seenIds]);

  return { loading, groupedByFriend, isNew };
}
