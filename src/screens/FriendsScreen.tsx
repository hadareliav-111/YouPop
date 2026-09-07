import { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import type { FriendEntry } from "../hooks/useFriends";

interface FriendsScreenProps {
  onBack: () => void;
  onOpenAddFriend: () => void;
  incomingRequests: FriendEntry[];
  outgoingRequests: FriendEntry[];
  friends: FriendEntry[];
  acceptRequest: (friendshipId: string) => void;
  declineRequest: (friendshipId: string) => void;
  cancelRequest: (friendshipId: string) => void;
  removeFriend: (friendshipId: string) => void;
  // How many of the current user's own recommendations exist in total, and
  // how many a given friend can currently see of them — drives the "shared
  // with" count and the tap-through to manage that friend's access.
  totalRecommendations: number;
  visibleCountFor: (friendshipId: string) => number;
  onOpenFriendSharing: (friend: FriendEntry) => void;
}

export function FriendsScreen({
  onBack,
  onOpenAddFriend,
  incomingRequests,
  outgoingRequests,
  friends,
  acceptRequest,
  declineRequest,
  cancelRequest,
  removeFriend,
  totalRecommendations,
  visibleCountFor,
  onOpenFriendSharing,
}: FriendsScreenProps) {
  const [removingFriend, setRemovingFriend] = useState<FriendEntry | null>(null);

  return (
    <div className="app-screen">
      <ScreenHeader
        title="Friends"
        onBack={onBack}
        right={
          <button type="button" className="btn btn--primary btn--compact" onClick={onOpenAddFriend}>
            + Add Friend
          </button>
        }
      />

      <div className="app-screen__scroll">
        <section className="detail-section">
          {friends.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No friends yet"
              message="Search for a friend by their exact username to get started."
            />
          ) : (
            friends.map((friend) => (
              <div className="friend-row friend-row--v2" key={friend.friendshipId}>
                <div className="friend-row__top">
                  <span className="friend-row__name">{friend.username}</span>
                  <div className="friend-row__actions friend-row__actions--compact">
                    <button
                      type="button"
                      className="btn btn--secondary btn--compact"
                      onClick={() => onOpenFriendSharing(friend)}
                    >
                      Manage
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-subtle btn--compact"
                      onClick={() => setRemovingFriend(friend)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <span className="friend-row__sharing text-muted">
                  {visibleCountFor(friend.friendshipId)} of {totalRecommendations} recommendations shared
                </span>
              </div>
            ))
          )}
        </section>

        {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
          <section className="detail-section">
            <h3 className="detail-section__title">Pending requests</h3>
            {incomingRequests.map((req) => (
              <div className="friend-row" key={req.friendshipId}>
                <span className="friend-row__name">{req.username}</span>
                <div className="friend-row__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--compact"
                    onClick={() => acceptRequest(req.friendshipId)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => declineRequest(req.friendshipId)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {outgoingRequests.map((req) => (
              <div className="friend-row friend-row--v2" key={req.friendshipId}>
                <div className="friend-row__top">
                  <span className="friend-row__name">{req.username}</span>
                  <div className="friend-row__actions friend-row__actions--compact">
                    <button
                      type="button"
                      className="btn btn--ghost btn--compact"
                      onClick={() => cancelRequest(req.friendshipId)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <span className="friend-row__sharing text-muted">Requested</span>
              </div>
            ))}
          </section>
        )}
      </div>

      {removingFriend && (
        <ConfirmDialog
          title="Remove friend?"
          message={`Remove ${removingFriend.username} from your friends? This won't affect either person's Watchlist or Recommendations.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemovingFriend(null)}
          onConfirm={() => {
            removeFriend(removingFriend.friendshipId);
            setRemovingFriend(null);
          }}
        />
      )}
    </div>
  );
}
