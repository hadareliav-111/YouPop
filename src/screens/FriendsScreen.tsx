import { useState, type FormEvent } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import type { FriendEntry, SearchResult } from "../hooks/useFriends";

interface FriendsScreenProps {
  onBack: () => void;
  incomingRequests: FriendEntry[];
  outgoingRequests: FriendEntry[];
  friends: FriendEntry[];
  searchByUsername: (username: string) => Promise<SearchResult>;
  sendRequest: (targetId: string, targetUsername: string) => void;
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
  incomingRequests,
  outgoingRequests,
  friends,
  searchByUsername,
  sendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  removeFriend,
  totalRecommendations,
  visibleCountFor,
  onOpenFriendSharing,
}: FriendsScreenProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [removingFriend, setRemovingFriend] = useState<FriendEntry | null>(null);

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchMessage(null);
    setResult(null);
    try {
      const res = await searchByUsername(trimmed);
      if (res.status === "not_found") {
        setSearchMessage(`No user found with username "${trimmed}".`);
      } else if (res.status === "self") {
        setSearchMessage("You can't add yourself.");
      } else {
        setResult(res);
      }
    } catch {
      setSearchMessage("Couldn't search right now. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = () => {
    if (!result || result.status !== "none") return;
    sendRequest(result.userId, result.username);
    setSearchMessage(`Request sent to ${result.username}.`);
    setResult(null);
    setQuery("");
  };

  const handleAcceptFromSearch = () => {
    if (!result || result.status !== "incoming") return;
    acceptRequest(result.friendshipId);
    setSearchMessage(`You and ${result.username} are now friends.`);
    setResult(null);
    setQuery("");
  };

  const handleCancelFromSearch = () => {
    if (!result || result.status !== "outgoing") return;
    cancelRequest(result.friendshipId);
    setResult(null);
    setQuery("");
  };

  return (
    <div className="app-screen">
      <ScreenHeader title="Friends" onBack={onBack} />

      <div className="app-screen__scroll">
        <section className="detail-section">
          <h3 className="detail-section__title">Add a friend</h3>
          <form className="friends-search" onSubmit={runSearch}>
            <input
              type="text"
              dir="auto"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Enter exact username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn--primary btn--compact" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          {searchMessage && <p className="text-muted">{searchMessage}</p>}

          {result && result.status !== "not_found" && result.status !== "self" && (
            <div className="friend-row">
              <span className="friend-row__name">{result.username}</span>
              {result.status === "none" && (
                <button type="button" className="btn btn--secondary btn--compact" onClick={handleAdd}>
                  Add Friend
                </button>
              )}
              {result.status === "outgoing" && (
                <div className="friend-row__actions">
                  <span className="text-muted">Requested</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={handleCancelFromSearch}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {result.status === "incoming" && (
                <button
                  type="button"
                  className="btn btn--primary btn--compact"
                  onClick={handleAcceptFromSearch}
                >
                  Accept
                </button>
              )}
              {result.status === "friends" && <span className="text-muted">Friends</span>}
            </div>
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
              <div className="friend-row" key={req.friendshipId}>
                <span className="friend-row__name">{req.username}</span>
                <div className="friend-row__actions">
                  <span className="text-muted">Requested</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => cancelRequest(req.friendshipId)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-section__title">Friends</h3>
          {friends.length === 0 ? (
            <EmptyState
              icon="👥"
              title="No friends yet"
              message="Search for a friend by their exact username to get started."
            />
          ) : (
            friends.map((friend) => (
              <div className="friend-row" key={friend.friendshipId}>
                <button
                  type="button"
                  className="friend-row__name-btn"
                  onClick={() => onOpenFriendSharing(friend)}
                >
                  <span className="friend-row__name">{friend.username}</span>
                  <span className="friend-row__sharing text-muted">
                    {visibleCountFor(friend.friendshipId)} of {totalRecommendations} recommendations shared
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--compact"
                  onClick={() => setRemovingFriend(friend)}
                >
                  Remove Friend
                </button>
              </div>
            ))
          )}
        </section>
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
