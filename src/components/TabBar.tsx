import { TvIcon, StarIcon, PeopleIcon } from "./icons";

type Tab = "watchlist" | "recommendations" | "friends";

interface TabBarProps {
  activeTab: Tab;
  onSwitchTab: (tab: Tab) => void;
  // Only relevant to the Friends tab — same pending-incoming-request count
  // that used to badge the Header's Friends icon, now shown here since
  // Friends is a full tab instead of a Header action.
  friendRequestCount?: number;
}

// The app's three primary sections. Only ever shown on a tab's own root
// screen (Home for Watchlist, RecommendationsScreen for Recommendations,
// FriendsRecommendationsScreen for Friends) — switching tabs replaces the
// whole navigation stack with that tab's root, the same operation goHome()
// already does, just aimed at a different screen kind. Every pushed screen
// (Category, Detail, Add, Watched, Search, Manage Friends...) stays exactly
// as it is today: full-page, no tab bar, Back returns to the root where it
// reappears.
export function TabBar({ activeTab, onSwitchTab, friendRequestCount = 0 }: TabBarProps) {
  return (
    <nav className="tab-bar">
      <button
        type="button"
        className={`tab-bar__tab ${activeTab === "watchlist" ? "is-active" : ""}`}
        onClick={() => onSwitchTab("watchlist")}
      >
        <TvIcon className="tab-bar__icon" />
        <span className="tab-bar__label">
          <span>My</span>
          <span>Watchlist</span>
        </span>
      </button>
      <button
        type="button"
        className={`tab-bar__tab ${activeTab === "recommendations" ? "is-active" : ""}`}
        onClick={() => onSwitchTab("recommendations")}
      >
        <StarIcon className="tab-bar__icon" />
        <span className="tab-bar__label">
          <span>My</span>
          <span>Recommendations</span>
        </span>
      </button>
      <button
        type="button"
        className={`tab-bar__tab ${activeTab === "friends" ? "is-active" : ""}`}
        onClick={() => onSwitchTab("friends")}
      >
        <span className="tab-bar__icon-wrap">
          <PeopleIcon className="tab-bar__icon" />
          {friendRequestCount > 0 && (
            <span className="tab-bar__badge" aria-hidden="true">
              {friendRequestCount > 9 ? "9+" : friendRequestCount}
            </span>
          )}
        </span>
        <span className="tab-bar__label">
          <span>Friends'</span>
          <span>Recommendations</span>
        </span>
      </button>
    </nav>
  );
}
