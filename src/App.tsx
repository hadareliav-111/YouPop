import { useCallback, useEffect, useMemo, useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { CategoryScreen } from "./screens/CategoryScreen";
import { WatchedScreen } from "./screens/WatchedScreen";
import { AddScreen } from "./screens/AddScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { RecommendationsScreen } from "./screens/RecommendationsScreen";
import { AddRecommendationScreen } from "./screens/AddRecommendationScreen";
import { RecommendationDetailScreen } from "./screens/RecommendationDetailScreen";
import { FriendsScreen } from "./screens/FriendsScreen";
import { AddFriendScreen } from "./screens/AddFriendScreen";
import { FriendsRecommendationsScreen } from "./screens/FriendsRecommendationsScreen";
import { FriendRecommendationsScreen } from "./screens/FriendRecommendationsScreen";
import { FriendVisibilityScreen } from "./screens/FriendVisibilityScreen";
import { RecommendationSharingScreen } from "./screens/RecommendationSharingScreen";
import { RecommendationNoteScreen } from "./screens/RecommendationNoteScreen";
import { MenuModal } from "./components/MenuModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "./hooks/useAuth";
import { useWatchlist } from "./hooks/useWatchlist";
import { useRecommendations } from "./hooks/useRecommendations";
import { useFriends } from "./hooks/useFriends";
import { useFriendsRecommendations } from "./hooks/useFriendsRecommendations";
import { useRecommendationSharing } from "./hooks/useRecommendationSharing";
import { supabase } from "./lib/supabaseClient";
import { usingMockMovieData } from "./lib/providers";
import { v4 as uuid } from "./lib/uuid";
import type { MediaType, WatchStatus } from "./types";
import type { FriendRecommendation } from "./lib/friendsRecommendationsApi";
import { getWatchlistStatus } from "./lib/watchStatus";

type Screen =
  | { kind: "home" }
  | { kind: "category"; mediaType: MediaType }
  | { kind: "watched" }
  | { kind: "add" }
  | { kind: "detail"; itemId: string }
  | { kind: "recommendations" }
  | { kind: "add-recommendation" }
  | { kind: "recommendation-detail"; id: string }
  | { kind: "recommendation-sharing"; id: string }
  | { kind: "recommendation-note"; id: string }
  | { kind: "friends" }
  | { kind: "add-friend" }
  | { kind: "friends-recommendations" }
  | { kind: "friend-recommendations"; friendId: string }
  | { kind: "friend-recommendation-detail"; id: string }
  | { kind: "friend-visibility"; friendshipId: string };

// The OMDb API Usage section in Settings -> About is only meaningful to
// the app owner (it's a shared, app-wide quota, not a per-user stat) —
// gated on this fixed Supabase user id, never on username, so a username
// change can never accidentally expose or hide it. Never rendered
// anywhere in the UI itself — only this boolean derived from it is.
const OMDB_USAGE_OWNER_USER_ID = "bff3f23d-8fdb-4acc-8bdf-d9a563473076";

export default function App() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  // Set once WatchlistApp's own initial data (see its onReady below) has
  // loaded. Only meaningful when there's a signed-in user — LoginScreen
  // has no equivalent data phase, so the splash never waits on this in
  // that branch (see `ready` below).
  const [appDataReady, setAppDataReady] = useState(false);
  const handleWatchlistReady = useCallback(() => setAppDataReady(true), []);

  // The splash stays up until BOTH auth has resolved AND, if there's a
  // signed-in user, WatchlistApp's own first-load has finished — i.e. the
  // exact same point at which it stops returning null below and renders
  // the real first screen. Nothing here changes when that boundary is;
  // it only extends what the splash waits on to match it.
  const ready = !authLoading && (user ? appDataReady : true);

  // Dismisses the static splash markup in index.html (outside React's own
  // root, so it's already visible on the very first paint, before this
  // component even mounts) once the app is actually ready to show its
  // first screen. React 18/19 always commits at least one render before
  // an effect can run, so the splash is guaranteed at least one paint
  // frame even when everything resolves essentially instantly, which is
  // what keeps the transition a smooth fade rather than a hard cut.
  useEffect(() => {
    if (!ready) return;
    const splash = document.getElementById("app-splash");
    if (!splash) return;
    splash.classList.add("app-splash--hidden");
    const timer = setTimeout(() => splash.remove(), 250);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <div className="app-shell">
      {!authLoading &&
        (user ? (
          <WatchlistApp userId={user.id} onSignOut={signOut} onReady={handleWatchlistReady} />
        ) : (
          <LoginScreen onSignIn={signIn} />
        ))}
    </div>
  );
}

interface WatchlistAppProps {
  userId: string;
  onSignOut: () => void;
  // Called once initial data has loaded and this component is about to
  // render its real first screen instead of null — see the itemsLoading
  // check below. Only used by App.tsx to know when to dismiss the splash.
  onReady?: () => void;
}

function WatchlistApp({ userId, onSignOut, onReady }: WatchlistAppProps) {
  const {
    items,
    loading: itemsLoading,
    addItem,
    updateItem,
    deleteItem,
    markWatched,
    markWantToWatch,
    markCurrentlyWatching,
    setCurrentEpisode,
    setPersonalRating,
    reorderCategory,
    alreadyAdded,
  } = useWatchlist(userId);

  const {
    items: recommendations,
    addRecommendation,
    updateNote: updateRecommendationNote,
    deleteRecommendation,
    reorder: reorderRecommendations,
    alreadyRecommended,
    setAudienceLocal: setRecommendationAudienceLocal,
  } = useRecommendations(userId);

  const {
    incomingRequests,
    outgoingRequests,
    friends,
    pendingIncomingCount,
    searchByUsername,
    sendRequest: sendFriendRequest,
    acceptRequest: acceptFriendRequest,
    declineRequest: declineFriendRequest,
    cancelRequest: cancelFriendRequest,
    removeFriend,
  } = useFriends(userId);

  const { groupedByFriend, isNew: isFriendRecommendationNew } = useFriendsRecommendations(
    userId,
    friends,
  );

  const {
    hiddenFor: hiddenFriendshipIdsFor,
    isVisibleTo: isRecommendationVisibleTo,
    visibleCountFor,
    setAudience: setRecommendationAudience,
    setVisibility: setRecommendationVisibility,
    setAllVisibilityForFriendship,
  } = useRecommendationSharing(userId, recommendations, friends, setRecommendationAudienceLocal);

  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setDisplayName(data?.display_name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // A real navigation stack (rather than one flat `screen` value) so Add and
  // Detail — now full pages, not overlays — always return Back to whichever
  // screen actually opened them (Home, a category, Watched, or Search), no
  // matter how they were reached.
  const [screenStack, setScreenStack] = useState<Screen[]>([{ kind: "home" }]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Whether one of the five swipe-back-enabled screens is currently being
  // interactively dragged — the only thing this drives is whether the
  // lightweight backdrop below (renderSwipeBackdrop) gets mounted behind
  // it. Doesn't touch screenStack/pushScreen/popScreen at all; those stay
  // exactly as they were.
  const [swipeActive, setSwipeActive] = useState(false);

  const screen = screenStack[screenStack.length - 1];
  const previousScreen =
    swipeActive && screenStack.length > 1 ? screenStack[screenStack.length - 2] : null;

  const pushScreen = (next: Screen) =>
    setScreenStack((stack) => [...stack, next]);
  const popScreen = () =>
    setScreenStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  // Switching tabs replaces the whole stack with that tab's root. Only
  // reachable from a tab's own root screen (the TabBar is never shown on a
  // pushed screen), so there's never a nested position to preserve/lose.
  const switchTab = (tab: "watchlist" | "recommendations" | "friends") =>
    setScreenStack([
      {
        kind:
          tab === "watchlist"
            ? "home"
            : tab === "recommendations"
              ? "recommendations"
              : "friends-recommendations",
      },
    ]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.personalTags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const selectedItem =
    screen.kind === "detail"
      ? items.find((item) => item.id === screen.itemId) ?? null
      : null;

  const selectedRecommendation =
    screen.kind === "recommendation-detail"
      ? recommendations.find((r) => r.id === screen.id) ?? null
      : null;

  const selectedRecommendationForSharing =
    screen.kind === "recommendation-sharing"
      ? recommendations.find((r) => r.id === screen.id) ?? null
      : null;

  const selectedRecommendationForNote =
    screen.kind === "recommendation-note"
      ? recommendations.find((r) => r.id === screen.id) ?? null
      : null;

  const selectedFriendGroup =
    screen.kind === "friend-recommendations"
      ? groupedByFriend.find((g) => g.friendUserId === screen.friendId) ?? null
      : null;

  const selectedFriendRecommendation =
    screen.kind === "friend-recommendation-detail"
      ? groupedByFriend
          .flatMap((g) => g.recommendations)
          .find((r) => r.id === screen.id) ?? null
      : null;

  const selectedFriendRecommendationUsername = selectedFriendRecommendation
    ? groupedByFriend.find((g) => g.friendUserId === selectedFriendRecommendation.friendUserId)
        ?.username ?? ""
    : "";

  const selectedFriendForVisibility =
    screen.kind === "friend-visibility"
      ? friends.find((f) => f.friendshipId === screen.friendshipId) ?? null
      : null;

  // Shared by every place Phase 2C/2D offers a friend-recommendation-backed
  // Watchlist action ("+ Add to Watchlist" and "Watched", both on the
  // Recommendation card and Recommendation Detail) — builds a normal
  // Watchlist item from a friend's recommendation, auto-filling the same
  // recommendation-related fields the manual Add flow lets a user type in
  // themselves (see AddScreen.tsx), sourced from the friend's note instead.
  // alreadyAdded() is the same externalSource+externalId check addItem's
  // caller already relies on elsewhere, so this can never create a
  // duplicate Watchlist item. "Watched" is identical except for the initial
  // status (and dateWatched, exactly as markWatched() sets it elsewhere).
  const addFriendRecommendationToWatchlist = (
    rec: FriendRecommendation,
    friendUsername: string,
    status: WatchStatus = "want_to_watch",
  ) => {
    if (alreadyAdded(rec.externalSource, rec.externalId)) return;
    const now = new Date().toISOString();
    addItem({
      id: uuid(),
      externalId: rec.externalId,
      externalSource: rec.externalSource,
      title: rec.title,
      mediaType: rec.mediaType,
      tvSubtype: rec.tvSubtype,
      releaseYear: rec.releaseYear,
      releaseDate: null,
      posterUrl: rec.posterUrl,
      genres: rec.genres,
      overview: rec.overview,
      externalRating: rec.externalRating,
      externalRatings: rec.externalRatings,
      numberOfSeasons: rec.numberOfSeasons,
      status,
      personalRating: null,
      currentEpisode: null,
      isRecommendation: true,
      recommendedBy: friendUsername,
      recommendationNote: rec.note,
      personalNotes: null,
      personalTags: [],
      sortOrder: 0,
      dateAdded: now,
      dateWatched: status === "watched" ? now : null,
    });
  };

  // Lightweight, additive-only backdrop for the interactive swipe-back
  // gesture (see useSwipeBack.ts). Mounted ONLY while previousScreen is
  // non-null, i.e. only while a swipe is actively being tracked on the
  // current top screen — and only for the set of screen kinds that can
  // ever actually be "the screen underneath" one of the swipe-enabled
  // screens. Tracing every pushScreen call below: `category` and `add`
  // only ever come from `home`; `add` also from `category`/`watched`;
  // `add-recommendation` only from `recommendations`; `add-friend` and
  // `friend-visibility` only from `friends`; `friend-recommendations` only
  // from `friends-recommendations`; `detail` from `home`, `category`, or
  // `watched`; `recommendation-detail` only from `recommendations`;
  // `friend-recommendation-detail` from `friends-recommendations` or
  // `friend-recommendations`. That's the complete set below — every other
  // screen kind can never legitimately appear as a backdrop given how
  // navigation actually flows in this app, so it renders nothing.
  //
  // Deliberately NOT a generalization of the switch further down: this is
  // a separate, small, local function reusing the same data already in
  // scope, not a refactor of how the real top screen renders — that
  // switch, and screenStack/pushScreen/popScreen, are untouched. Handlers
  // are all no-ops on purpose: this is a purely visual stand-in, never
  // meant to be interactive (the actively-dragged foreground screen keeps
  // capturing the touch for the gesture's whole duration regardless of
  // how much of the backdrop is visually revealed).
  const renderSwipeBackdrop = (s: Screen) => {
    switch (s.kind) {
      case "home":
        return (
          <HomeScreen
            items={items}
            onSelectItem={() => {}}
            onOpenCategory={() => {}}
            onAdd={() => {}}
            onOpenWatched={() => {}}
            onOpenMenu={() => {}}
            onSwitchTab={() => {}}
            friendRequestCount={pendingIncomingCount}
          />
        );
      case "category":
        return (
          <CategoryScreen
            mediaType={s.mediaType}
            items={items}
            onBack={() => {}}
            onSelectItem={() => {}}
            onAdd={() => {}}
            onReorder={() => {}}
          />
        );
      case "watched":
        return <WatchedScreen items={items} onBack={() => {}} onSelectItem={() => {}} />;
      case "recommendations":
        return (
          <RecommendationsScreen
            items={recommendations}
            onSelect={() => {}}
            onAdd={() => {}}
            onReorder={() => {}}
            onSwitchTab={() => {}}
            onOpenMenu={() => {}}
            friendRequestCount={pendingIncomingCount}
          />
        );
      case "friends":
        return (
          <FriendsScreen
            onBack={() => {}}
            onOpenAddFriend={() => {}}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            friends={friends}
            acceptRequest={() => {}}
            declineRequest={() => {}}
            cancelRequest={() => {}}
            removeFriend={() => {}}
            totalRecommendations={recommendations.length}
            visibleCountFor={visibleCountFor}
            onOpenFriendSharing={() => {}}
          />
        );
      case "friends-recommendations":
        return (
          <FriendsRecommendationsScreen
            onManageFriends={() => {}}
            groups={groupedByFriend}
            watchlistItems={items}
            isNew={isFriendRecommendationNew}
            onSelectRecommendation={() => {}}
            onSeeAllFriend={() => {}}
            onSwitchTab={() => {}}
            onOpenMenu={() => {}}
            friendRequestCount={pendingIncomingCount}
          />
        );
      case "friend-recommendations": {
        const group = groupedByFriend.find((g) => g.friendUserId === s.friendId);
        if (!group) return null;
        return (
          <FriendRecommendationsScreen
            username={group.username}
            recommendations={group.recommendations}
            watchlistItems={items}
            isNew={isFriendRecommendationNew}
            onBack={() => {}}
            onSelect={() => {}}
            onAddToWatchlist={() => {}}
            onMarkWatched={() => {}}
          />
        );
      }
      default:
        return null;
    }
  };

  // Reports the exact same transition this early-return already gates on
  // — fires once, the first time itemsLoading goes from true to false —
  // so App.tsx can keep the splash up until this component is actually
  // about to render the real first screen instead of null.
  useEffect(() => {
    if (!itemsLoading) onReady?.();
  }, [itemsLoading, onReady]);

  if (itemsLoading) {
    return null;
  }

  return (
    <>
      {usingMockMovieData && (
        <div className="config-banner">
          Movie search is showing placeholder preview data. TV and reality
          shows are already live. Deploy the omdb-proxy Edge Function, set
          its OMDB_API_KEY secret, then add{" "}
          <code>VITE_OMDB_PROXY_ENABLED=true</code> to a <code>.env</code>{" "}
          file and restart the dev server for real movie data.
        </div>
      )}

      <div className="app-screen-stack">
        {previousScreen && (
          <div className="app-screen-stack__backdrop" aria-hidden="true">
            {renderSwipeBackdrop(previousScreen)}
          </div>
        )}
        <ErrorBoundary key={JSON.stringify(screen)} label="This screen">
        {screen.kind === "home" && (
          <HomeScreen
            items={items}
            onSelectItem={(item) => pushScreen({ kind: "detail", itemId: item.id })}
            onOpenCategory={(mediaType) => pushScreen({ kind: "category", mediaType })}
            onAdd={() => pushScreen({ kind: "add" })}
            onOpenWatched={() => pushScreen({ kind: "watched" })}
            onOpenMenu={() => setMenuOpen(true)}
            onSwitchTab={switchTab}
            friendRequestCount={pendingIncomingCount}
          />
        )}

        {screen.kind === "category" && (
          <CategoryScreen
            mediaType={screen.mediaType}
            items={items}
            onBack={popScreen}
            onSelectItem={(item) => pushScreen({ kind: "detail", itemId: item.id })}
            onAdd={() => pushScreen({ kind: "add" })}
            onReorder={reorderCategory}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "watched" && (
          <WatchedScreen
            items={items}
            onBack={popScreen}
            onSelectItem={(item) => pushScreen({ kind: "detail", itemId: item.id })}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "add" && (
          <AddScreen
            onClose={popScreen}
            onAdd={addItem}
            existingTags={tags}
            isAlreadyAdded={alreadyAdded}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "detail" && selectedItem && (
          <ErrorBoundary key={selectedItem.id} label="This item's details">
            <DetailScreen
              item={selectedItem}
              existingTags={tags}
              onBack={popScreen}
              onUpdate={(patch) => updateItem(selectedItem.id, patch)}
              onMarkWatched={() => markWatched(selectedItem.id)}
              onMarkWantToWatch={() => markWantToWatch(selectedItem.id)}
              onMarkCurrentlyWatching={() => markCurrentlyWatching(selectedItem.id)}
              onSetCurrentEpisode={(episode) => setCurrentEpisode(selectedItem.id, episode)}
              onSetRating={(rating) => setPersonalRating(selectedItem.id, rating)}
              onDelete={() => {
                deleteItem(selectedItem.id);
                popScreen();
              }}
              isRecommended={alreadyRecommended(
                selectedItem.externalSource,
                selectedItem.externalId,
              )}
              friends={friends}
              onAddToRecommendations={(audienceMode, hiddenFriendshipIds) => {
                const rec = {
                  id: uuid(),
                  externalId: selectedItem.externalId,
                  externalSource: selectedItem.externalSource,
                  mediaType: selectedItem.mediaType,
                  tvSubtype: selectedItem.tvSubtype,
                  title: selectedItem.title,
                  posterUrl: selectedItem.posterUrl,
                  releaseYear: selectedItem.releaseYear,
                  genres: selectedItem.genres,
                  overview: selectedItem.overview,
                  externalRating: selectedItem.externalRating,
                  externalRatings: selectedItem.externalRatings,
                  numberOfSeasons: selectedItem.numberOfSeasons,
                  note: null,
                  sortOrder: 0,
                  dateAdded: new Date().toISOString(),
                  audience: audienceMode,
                };
                addRecommendation(rec, () => {
                  if (audienceMode === "selected") {
                    setRecommendationAudience(rec.id, "selected", hiddenFriendshipIds).catch(console.error);
                  }
                });
              }}
              onSwipeActiveChange={setSwipeActive}
            />
          </ErrorBoundary>
        )}

        {screen.kind === "recommendations" && (
          <RecommendationsScreen
            items={recommendations}
            onSelect={(rec) => pushScreen({ kind: "recommendation-detail", id: rec.id })}
            onAdd={() => pushScreen({ kind: "add-recommendation" })}
            onReorder={reorderRecommendations}
            onSwitchTab={switchTab}
            onOpenMenu={() => setMenuOpen(true)}
            friendRequestCount={pendingIncomingCount}
          />
        )}

        {screen.kind === "friends" && (
          <FriendsScreen
            onBack={popScreen}
            onOpenAddFriend={() => pushScreen({ kind: "add-friend" })}
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            friends={friends}
            acceptRequest={acceptFriendRequest}
            declineRequest={declineFriendRequest}
            cancelRequest={cancelFriendRequest}
            removeFriend={removeFriend}
            totalRecommendations={recommendations.length}
            visibleCountFor={visibleCountFor}
            onOpenFriendSharing={(friend) =>
              pushScreen({ kind: "friend-visibility", friendshipId: friend.friendshipId })
            }
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "add-friend" && (
          <AddFriendScreen
            onBack={popScreen}
            searchByUsername={searchByUsername}
            sendRequest={sendFriendRequest}
            acceptRequest={acceptFriendRequest}
            cancelRequest={cancelFriendRequest}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "friend-visibility" && selectedFriendForVisibility && (
          <FriendVisibilityScreen
            username={selectedFriendForVisibility.username}
            recommendations={recommendations}
            isVisible={(recId) =>
              isRecommendationVisibleTo(recId, selectedFriendForVisibility.friendshipId)
            }
            onToggle={(recId, visible) =>
              setRecommendationVisibility(recId, selectedFriendForVisibility.friendshipId, visible)
            }
            onSelectAll={() => setAllVisibilityForFriendship(selectedFriendForVisibility.friendshipId, true)}
            onClearAll={() => setAllVisibilityForFriendship(selectedFriendForVisibility.friendshipId, false)}
            onBack={popScreen}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "friends-recommendations" && (
          <FriendsRecommendationsScreen
            onManageFriends={() => pushScreen({ kind: "friends" })}
            groups={groupedByFriend}
            watchlistItems={items}
            isNew={isFriendRecommendationNew}
            onSelectRecommendation={(rec) =>
              pushScreen({ kind: "friend-recommendation-detail", id: rec.id })
            }
            onSeeAllFriend={(friendId) => pushScreen({ kind: "friend-recommendations", friendId })}
            onSwitchTab={switchTab}
            onOpenMenu={() => setMenuOpen(true)}
            friendRequestCount={pendingIncomingCount}
          />
        )}

        {screen.kind === "friend-recommendations" && selectedFriendGroup && (
          <FriendRecommendationsScreen
            username={selectedFriendGroup.username}
            recommendations={selectedFriendGroup.recommendations}
            watchlistItems={items}
            isNew={isFriendRecommendationNew}
            onBack={popScreen}
            onSelect={(rec) => pushScreen({ kind: "friend-recommendation-detail", id: rec.id })}
            onAddToWatchlist={(rec) =>
              addFriendRecommendationToWatchlist(rec, selectedFriendGroup.username)
            }
            onMarkWatched={(rec) =>
              addFriendRecommendationToWatchlist(rec, selectedFriendGroup.username, "watched")
            }
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "friend-recommendation-detail" && selectedFriendRecommendation && (
          <ErrorBoundary key={selectedFriendRecommendation.id} label="This recommendation">
            <RecommendationDetailScreen
              recommendation={selectedFriendRecommendation}
              onBack={popScreen}
              readOnly
              watchlistStatus={getWatchlistStatus(selectedFriendRecommendation, items)}
              onAddToWatchlist={() =>
                addFriendRecommendationToWatchlist(
                  selectedFriendRecommendation,
                  selectedFriendRecommendationUsername,
                )
              }
              onMarkWatched={() =>
                addFriendRecommendationToWatchlist(
                  selectedFriendRecommendation,
                  selectedFriendRecommendationUsername,
                  "watched",
                )
              }
              onSwipeActiveChange={setSwipeActive}
            />
          </ErrorBoundary>
        )}

        {screen.kind === "add-recommendation" && (
          <AddRecommendationScreen
            onClose={popScreen}
            onAdd={(rec, hiddenFriendshipIds) => {
              addRecommendation(rec, () => {
                if (rec.audience === "selected") {
                  setRecommendationAudience(rec.id, "selected", hiddenFriendshipIds).catch(console.error);
                }
              });
            }}
            alreadyRecommended={alreadyRecommended}
            friends={friends}
            onSwipeActiveChange={setSwipeActive}
          />
        )}

        {screen.kind === "recommendation-detail" && selectedRecommendation && (
          <ErrorBoundary key={selectedRecommendation.id} label="This recommendation">
            <RecommendationDetailScreen
              recommendation={selectedRecommendation}
              onBack={popScreen}
              onEditNote={() =>
                pushScreen({ kind: "recommendation-note", id: selectedRecommendation.id })
              }
              onDelete={() => {
                deleteRecommendation(selectedRecommendation.id);
                popScreen();
              }}
              friends={friends}
              hiddenFriendshipIds={hiddenFriendshipIdsFor(selectedRecommendation.id)}
              onEditSharing={() =>
                pushScreen({ kind: "recommendation-sharing", id: selectedRecommendation.id })
              }
              onSwipeActiveChange={setSwipeActive}
            />
          </ErrorBoundary>
        )}

        {screen.kind === "recommendation-note" && selectedRecommendationForNote && (
          <RecommendationNoteScreen
            note={selectedRecommendationForNote.note}
            onBack={popScreen}
            onSave={(note) => {
              updateRecommendationNote(selectedRecommendationForNote.id, note);
              popScreen();
            }}
          />
        )}

        {screen.kind === "recommendation-sharing" && selectedRecommendationForSharing && (
          <RecommendationSharingScreen
            friends={friends}
            audience={selectedRecommendationForSharing.audience}
            hiddenFriendshipIds={hiddenFriendshipIdsFor(selectedRecommendationForSharing.id)}
            onBack={popScreen}
            onSave={async (audience, hiddenFriendshipIds) => {
              await setRecommendationAudience(selectedRecommendationForSharing.id, audience, hiddenFriendshipIds);
              setRecommendationAudienceLocal(selectedRecommendationForSharing.id, audience);
              popScreen();
            }}
          />
        )}
      </ErrorBoundary>
      </div>

      {menuOpen && (
        <MenuModal
          onClose={() => setMenuOpen(false)}
          displayName={displayName}
          onSignOut={onSignOut}
          canViewOmdbUsage={userId === OMDB_USAGE_OWNER_USER_ID}
        />
      )}
    </>
  );
}
