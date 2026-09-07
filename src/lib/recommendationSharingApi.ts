import { supabase } from "./supabaseClient";

const TABLE = "recommendation_hidden_friends";

export interface HiddenPair {
  recommendationId: string;
  friendshipId: string;
}

// Every hidden pair across a set of the current user's own recommendations
// — one query serves both the single-recommendation "Shared with" picker
// and the per-friend visible-count/checklist views, which just group this
// differently client-side. RLS only ever returns rows for recommendations
// the caller owns.
export async function fetchHidden(recommendationIds: string[]): Promise<HiddenPair[]> {
  if (recommendationIds.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("recommendation_id, friendship_id")
    .in("recommendation_id", recommendationIds);
  if (error) throw error;
  return (data as { recommendation_id: string; friendship_id: string }[]).map((r) => ({
    recommendationId: r.recommendation_id,
    friendshipId: r.friendship_id,
  }));
}

// Sets a recommendation's full audience — both its explicit "all" |
// "selected" mode (recommendations.audience) and its hidden-friend set —
// in one atomic RPC call. Used whenever the "Shared with" picker's Save
// commits a whole choice at once (Add flow, Detail/Edit). The mode is a
// real stored column, never inferred from the hidden set's size: a
// "selected" recommendation with every current friend individually
// checked has zero hidden rows too, which would be indistinguishable
// from "all" (and would wrongly grant a later-added friend access) if
// mode were inferred instead of stored.
//
// A single RPC (one atomic transaction), not separate statements from
// here — multiple round trips let a second, more recent Save's writes
// interleave with a still-in-flight earlier Save's writes and lose the
// newer change. See set_recommendation_audience in supabase/schema.sql
// for the full explanation.
export async function saveAudience(
  recommendationId: string,
  audience: "all" | "selected",
  hiddenFriendshipIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_recommendation_audience", {
    p_recommendation_id: recommendationId,
    p_audience: audience,
    p_hidden_friendship_ids: hiddenFriendshipIds,
  });
  if (error) throw error;
}

// Toggles one (recommendation, friendship) pair — the individual-selection
// case on FriendVisibilityScreen.
export async function setHidden(
  recommendationId: string,
  friendshipId: string,
  hidden: boolean,
): Promise<void> {
  if (hidden) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { recommendation_id: recommendationId, friendship_id: friendshipId },
        { onConflict: "recommendation_id,friendship_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("recommendation_id", recommendationId)
      .eq("friendship_id", friendshipId);
    if (error) throw error;
  }
}

// Replaces the full hidden set for one friendship across many
// recommendations — Select All / Clear All on FriendVisibilityScreen. Same
// single-RPC atomicity as replaceHidden above, and for the same reason.
export async function replaceHiddenForFriendship(
  friendshipId: string,
  hideRecommendationIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("replace_recommendation_hidden_friends_for_friendship", {
    p_friendship_id: friendshipId,
    p_recommendation_ids: hideRecommendationIds,
  });
  if (error) throw error;
}
