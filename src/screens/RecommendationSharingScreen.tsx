import { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { ShareWithFriendsPicker, type AudienceMode } from "../components/ShareWithFriendsPicker";
import type { FriendEntry } from "../hooks/useFriends";

interface RecommendationSharingScreenProps {
  friends: FriendEntry[];
  // The recommendation's currently stored mode — the actual source of
  // truth for which segmented-control option starts selected, never
  // inferred from hiddenFriendshipIds' size (see the Recommendation type
  // for why that inference is unreliable).
  audience: AudienceMode;
  hiddenFriendshipIds: Set<string>;
  onBack: () => void;
  // Awaited before navigating away — see handleSave below for why that
  // matters (it's what actually fixes the intermittent "second edit
  // doesn't stick" bug, not just the atomic RPC underneath it).
  onSave: (audience: AudienceMode, hiddenFriendshipIds: string[]) => Promise<void>;
}

// A dedicated, focused edit screen — reached by "Edit" on Recommendation
// Detail's "Shared with" section — rather than an inline editor expanding
// that page. Keeps Recommendation Detail's own height fixed regardless of
// friend-list length; this screen owns its own draft state and only
// reports the final choice back via onSave, same {all|selected} ->
// hiddenFriendshipIds contract every other sharing surface already uses.
export function RecommendationSharingScreen({
  friends,
  audience,
  hiddenFriendshipIds,
  onBack,
  onSave,
}: RecommendationSharingScreenProps) {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(audience);
  const [checkedFriendshipIds, setCheckedFriendshipIds] = useState<Set<string>>(
    new Set(friends.filter((f) => !hiddenFriendshipIds.has(f.friendshipId)).map((f) => f.friendshipId)),
  );
  const [saving, setSaving] = useState(false);

  const handleModeChange = (mode: AudienceMode) => {
    if (mode === "selected" && audienceMode !== "selected") {
      setCheckedFriendshipIds(new Set());
    }
    setAudienceMode(mode);
  };

  const handleToggleFriend = (friendshipId: string) => {
    setCheckedFriendshipIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendshipId)) next.delete(friendshipId);
      else next.add(friendshipId);
      return next;
    });
  };

  // Awaits the actual write before letting the caller navigate away —
  // without this, popping back to Detail and re-entering Edit could
  // start a second Save before the first one's had a chance to persist,
  // which (combined with the non-atomic old delete-then-insert) was the
  // real cause of an edit sometimes appearing to not stick. Disabling
  // the button while saving also stops a double-click from firing two
  // overlapping Saves of its own.
  const handleSave = async () => {
    const hiddenIds =
      audienceMode === "all"
        ? []
        : friends.map((f) => f.friendshipId).filter((id) => !checkedFriendshipIds.has(id));
    setSaving(true);
    try {
      await onSave(audienceMode, hiddenIds);
    } catch (err) {
      console.error("Failed to save recommendation sharing", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-screen">
      <ScreenHeader title="Shared with" onBack={onBack} />
      <div className="app-screen__scroll">
        <div className="details-form">
          <ShareWithFriendsPicker
            friends={friends}
            mode={audienceMode}
            checkedFriendshipIds={checkedFriendshipIds}
            onModeChange={handleModeChange}
            onToggleFriend={handleToggleFriend}
            onSelectAll={() => setCheckedFriendshipIds(new Set(friends.map((f) => f.friendshipId)))}
            onClearAll={() => setCheckedFriendshipIds(new Set())}
          />
          <div className="details-form__actions">
            <button type="button" className="btn btn--ghost" onClick={onBack} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
