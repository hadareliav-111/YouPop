import { useCallback, useEffect, useMemo, useState } from "react";
import type { Friendship } from "../types";
import * as friendsApi from "../lib/friendsApi";
import { v4 as uuid } from "../lib/uuid";

export interface FriendEntry {
  friendshipId: string;
  userId: string;
  username: string;
}

export type SearchResult =
  | { status: "not_found" }
  | { status: "self" }
  | { status: "none"; userId: string; username: string }
  | { status: "outgoing"; userId: string; username: string; friendshipId: string }
  | { status: "incoming"; userId: string; username: string; friendshipId: string }
  | { status: "friends"; userId: string; username: string; friendshipId: string };

function counterpartId(f: Friendship, myId: string): string {
  return f.requesterId === myId ? f.addresseeId : f.requesterId;
}

// Mirrors useWatchlist.ts/useRecommendations.ts's shape and persistence
// pattern — Supabase is the sole source of truth, optimistic local updates
// + fire-and-forget persistence for actions the user takes themselves.
export function useFriends(userId: string | null) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profiles, setProfiles] = useState<Record<string, friendsApi.ProfileSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setFriendships([]);
      setProfiles({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const rows = await friendsApi.fetchMyFriendships(userId);
        if (cancelled) return;
        setFriendships(rows);

        const ids = Array.from(new Set(rows.map((r) => counterpartId(r, userId))));
        if (ids.length > 0) {
          const profs = await friendsApi.fetchProfiles(ids);
          if (cancelled) return;
          setProfiles((prev) => {
            const next = { ...prev };
            for (const p of profs) next[p.id] = p;
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to load friends", err);
        if (!cancelled) setFriendships([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toEntry = useCallback(
    (f: Friendship): FriendEntry => {
      const otherId = counterpartId(f, userId!);
      return {
        friendshipId: f.id,
        userId: otherId,
        username: profiles[otherId]?.username ?? "Unknown",
      };
    },
    [profiles, userId],
  );

  const incomingRequests = useMemo(
    () =>
      userId
        ? friendships.filter((f) => f.status === "pending" && f.addresseeId === userId).map(toEntry)
        : [],
    [friendships, userId, toEntry],
  );

  const outgoingRequests = useMemo(
    () =>
      userId
        ? friendships.filter((f) => f.status === "pending" && f.requesterId === userId).map(toEntry)
        : [],
    [friendships, userId, toEntry],
  );

  const friends = useMemo(
    () =>
      friendships
        .filter((f) => f.status === "accepted")
        .map(toEntry)
        .sort((a, b) => a.username.localeCompare(b.username)),
    [friendships, toEntry],
  );

  // Read-only: resolves a username to the current relationship state,
  // without changing anything. The Friends screen uses this to decide
  // which single action button to show (Add Friend / Requested / Accept /
  // Friends) — sending the actual request is a separate step (sendRequest
  // below).
  const searchByUsername = useCallback(
    async (username: string): Promise<SearchResult> => {
      const trimmed = username.trim();
      if (!trimmed || !userId) return { status: "not_found" };

      const found = await friendsApi.findUserByUsername(trimmed);
      if (!found) return { status: "not_found" };
      if (found.id === userId) return { status: "self" };

      setProfiles((prev) => ({
        ...prev,
        [found.id]: { id: found.id, username: found.username, displayName: found.username },
      }));

      const existing = friendships.find(
        (f) =>
          (f.requesterId === userId && f.addresseeId === found.id) ||
          (f.requesterId === found.id && f.addresseeId === userId),
      );
      if (!existing) return { status: "none", userId: found.id, username: found.username };
      if (existing.status === "accepted") {
        return { status: "friends", userId: found.id, username: found.username, friendshipId: existing.id };
      }
      return {
        status: existing.requesterId === userId ? "outgoing" : "incoming",
        userId: found.id,
        username: found.username,
        friendshipId: existing.id,
      };
    },
    [userId, friendships],
  );

  const sendRequest = useCallback(
    (targetId: string, targetUsername: string) => {
      if (!userId) return;
      const id = uuid();
      const optimistic: Friendship = {
        id,
        requesterId: userId,
        addresseeId: targetId,
        status: "pending",
        createdAt: new Date().toISOString(),
        respondedAt: null,
      };
      setProfiles((prev) => ({
        ...prev,
        [targetId]: { id: targetId, username: targetUsername, displayName: targetUsername },
      }));
      setFriendships((prev) => [...prev, optimistic]);
      friendsApi.sendRequest(id, userId, targetId).catch((err) => {
        // Roll back — e.g. a race where the other side sent a request at
        // the same moment and the unique constraint rejected this one.
        setFriendships((prev) => prev.filter((f) => f.id !== id));
        console.error(err);
      });
    },
    [userId],
  );

  const acceptRequest = useCallback((friendshipId: string) => {
    setFriendships((prev) =>
      prev.map((f) =>
        f.id === friendshipId
          ? { ...f, status: "accepted", respondedAt: new Date().toISOString() }
          : f,
      ),
    );
    friendsApi.acceptRequest(friendshipId).catch(console.error);
  }, []);

  const removeRow = useCallback((friendshipId: string) => {
    setFriendships((prev) => prev.filter((f) => f.id !== friendshipId));
    friendsApi.deleteFriendship(friendshipId).catch(console.error);
  }, []);

  return {
    loading,
    incomingRequests,
    outgoingRequests,
    friends,
    pendingIncomingCount: incomingRequests.length,
    searchByUsername,
    sendRequest,
    acceptRequest,
    declineRequest: removeRow,
    cancelRequest: removeRow,
    removeFriend: removeRow,
  };
}
