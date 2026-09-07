import type { FriendEntry } from "../hooks/useFriends";

export type AudienceMode = "all" | "selected";

interface ShareWithFriendsPickerProps {
  friends: FriendEntry[];
  mode: AudienceMode;
  // Friendship ids currently checked (= will remain visible) — only
  // meaningful/shown while mode === "selected".
  checkedFriendshipIds: Set<string>;
  onModeChange: (mode: AudienceMode) => void;
  onToggleFriend: (friendshipId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

// "Recommend to: All friends / Selected friends" — an explicit audience
// choice, not an exclude-list framing. Controlled component: the caller
// owns mode/checked state and decides when (if ever) to persist it, so the
// same picker works both inside a form (Add, committed on submit) and
// inside an inline edit/Save section (Recommendation Detail) or a Modal
// (Watchlist's Add to Recommendations).
//
// The mode toggle reuses .segmented as-is (same pill control as the
// Watchlist/Add "Is this a recommendation?" toggle). The friend list below
// it is deliberately plain — a real checkbox + name per row, same simple
// pattern FriendVisibilityScreen already uses — so it reads as a quiet
// selection list, not a second row of competing pill/button controls.
export function ShareWithFriendsPicker({
  friends,
  mode,
  checkedFriendshipIds,
  onModeChange,
  onToggleFriend,
  onSelectAll,
  onClearAll,
}: ShareWithFriendsPickerProps) {
  if (friends.length === 0) return null;

  return (
    <fieldset className="details-form__field audience-picker">
      <legend>Recommend to</legend>
      <div className="segmented">
        <button
          type="button"
          className={`segmented__option ${mode === "all" ? "is-active" : ""}`}
          onClick={() => onModeChange("all")}
        >
          All friends
        </button>
        <button
          type="button"
          className={`segmented__option ${mode === "selected" ? "is-active" : ""}`}
          onClick={() => onModeChange("selected")}
        >
          Selected friends
        </button>
      </div>

      {mode === "all" && (
        <p className="text-muted audience-picker__hint">
          With All friends selected, new friends will automatically see this recommendation.
        </p>
      )}

      {mode === "selected" && (
        <div className="audience-picker__friends">
          <div className="audience-picker__actions">
            <button type="button" className="btn btn--ghost btn--compact" onClick={onSelectAll}>
              Select All
            </button>
            <button type="button" className="btn btn--ghost btn--compact" onClick={onClearAll}>
              Clear All
            </button>
          </div>
          <div className="audience-picker__friend-grid">
            {friends.map((friend) => {
              const checked = checkedFriendshipIds.has(friend.friendshipId);
              return (
                <label className="audience-picker__friend-row" key={friend.friendshipId}>
                  <input
                    type="checkbox"
                    className="audience-picker__friend-checkbox"
                    checked={checked}
                    onChange={() => onToggleFriend(friend.friendshipId)}
                  />
                  <span className="audience-picker__friend-name">{friend.username}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </fieldset>
  );
}
