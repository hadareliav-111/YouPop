import { useState, type FormEvent } from "react";
import { ScreenHeader } from "../components/ScreenHeader";
import type { SearchResult } from "../hooks/useFriends";

interface AddFriendScreenProps {
  onBack: () => void;
  searchByUsername: (username: string) => Promise<SearchResult>;
  sendRequest: (targetId: string, targetUsername: string) => void;
  acceptRequest: (friendshipId: string) => void;
  cancelRequest: (friendshipId: string) => void;
}

// A dedicated screen for finding and adding a friend by exact username —
// split out of Manage Friends (which now just lists existing friends and
// pending requests) so that screen isn't cluttered with the search form.
// Same searchByUsername/sendRequest/acceptRequest/cancelRequest contract
// as before; only where this UI lives changed, not how it behaves.
export function AddFriendScreen({
  onBack,
  searchByUsername,
  sendRequest,
  acceptRequest,
  cancelRequest,
}: AddFriendScreenProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

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
      <ScreenHeader title="Add Friend" onBack={onBack} />

      <div className="app-screen__scroll">
        <section className="detail-section">
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
            <>
              {result.status === "outgoing" ? (
                <div className="friend-row friend-row--v2">
                  <div className="friend-row__top">
                    <span className="friend-row__name">{result.username}</span>
                    <div className="friend-row__actions friend-row__actions--compact">
                      <button
                        type="button"
                        className="btn btn--ghost btn--compact"
                        onClick={handleCancelFromSearch}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <span className="friend-row__sharing text-muted">Requested</span>
                </div>
              ) : (
                <div className="friend-row">
                  <span className="friend-row__name">{result.username}</span>
                  {result.status === "none" && (
                    <button type="button" className="btn btn--secondary btn--compact" onClick={handleAdd}>
                      Add Friend
                    </button>
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}
