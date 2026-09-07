import { useState } from "react";
import { v4 as uuid } from "../lib/uuid";
import {
  getDetails,
  type FullDetails,
  type MediaSource,
  type SearchResultItem,
} from "../lib/providers";
import type { Recommendation } from "../types";
import { mediaTypeLabel } from "../lib/mediaTypeLabel";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchStep } from "../components/AddFlow/SearchStep";
import { ShareWithFriendsPicker, type AudienceMode } from "../components/ShareWithFriendsPicker";
import type { FriendEntry } from "../hooks/useFriends";

interface AddRecommendationScreenProps {
  onClose: () => void;
  // hiddenFriendshipIds is [] for "All friends" — the caller only needs to
  // persist an audience when it's non-empty.
  onAdd: (rec: Recommendation, hiddenFriendshipIds: string[]) => void;
  alreadyRecommended: (source: MediaSource, externalId: string) => boolean;
  friends: FriendEntry[];
}

type Step =
  | { kind: "search" }
  | { kind: "loading-details"; result: SearchResultItem }
  | { kind: "details-error"; result: SearchResultItem; message: string }
  | { kind: "already-added"; result: SearchResultItem }
  | { kind: "form"; details: FullDetails };

// Same search→details→confirm shape as AddScreen.tsx, reusing SearchStep and
// getDetails as-is — but the final step is just a Note, since a
// Recommendation has none of a WatchlistItem's personal fields (no tags, no
// "who recommended this to me", no status).
export function AddRecommendationScreen({
  onClose,
  onAdd,
  alreadyRecommended,
  friends,
}: AddRecommendationScreenProps) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [note, setNote] = useState("");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [checkedFriendshipIds, setCheckedFriendshipIds] = useState<Set<string>>(new Set());

  const handleModeChange = (mode: AudienceMode) => {
    // Switching *into* "Selected friends" always starts from a blank
    // checklist — an explicit choice each time, not a pre-filled one.
    // "Select All" is one tap away for the "everyone but one" case.
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

  const handleSelect = async (result: SearchResultItem) => {
    if (alreadyRecommended(result.source, result.externalId)) {
      setStep({ kind: "already-added", result });
      return;
    }
    setStep({ kind: "loading-details", result });
    try {
      const details = await getDetails(result.source, result.externalId);
      if (alreadyRecommended(details.source, details.externalId)) {
        setStep({ kind: "already-added", result });
        return;
      }
      setNote("");
      setStep({ kind: "form", details });
    } catch (err) {
      setStep({
        kind: "details-error",
        result,
        message:
          err instanceof Error
            ? err.message
            : "Couldn't load details for this title.",
      });
    }
  };

  const handleSubmit = () => {
    if (step.kind !== "form") return;
    const details = step.details;
    const rec: Recommendation = {
      id: uuid(),
      externalId: details.externalId,
      externalSource: details.source,
      mediaType: details.mediaType,
      tvSubtype: details.tvSubtype,
      title: details.title,
      posterUrl: details.posterUrl,
      releaseYear: details.releaseYear,
      genres: details.genres,
      overview: details.overview,
      externalRating: details.externalRating,
      externalRatings: details.externalRatings,
      numberOfSeasons: details.numberOfSeasons,
      note: note.trim() ? note.trim() : null,
      sortOrder: 0, // useRecommendations.addRecommendation assigns the real end-of-list position
      dateAdded: new Date().toISOString(),
      audience: audienceMode,
    };
    const hiddenFriendshipIds =
      audienceMode === "all"
        ? []
        : friends
            .map((f) => f.friendshipId)
            .filter((id) => !checkedFriendshipIds.has(id));
    onAdd(rec, hiddenFriendshipIds);
    onClose();
  };

  const title = step.kind === "form" ? "Add recommendation" : "Add a recommendation";

  // Back from anything other than search returns to search, matching
  // AddScreen's behavior — only Back from search itself leaves the flow.
  const handleBack = () => {
    if (step.kind === "search") {
      onClose();
      return;
    }
    setStep({ kind: "search" });
  };

  return (
    <div className="app-screen">
      <ScreenHeader title={title} onBack={handleBack} />

      {step.kind === "search" && (
        <SearchStep
          onSelect={handleSelect}
          isAlreadyAdded={alreadyRecommended}
          alreadyAddedLabel="Already in your recommendations"
        />
      )}

      {step.kind === "loading-details" && (
        <div className="app-screen__scroll">
          <p className="search-step__status">Loading details…</p>
        </div>
      )}

      {step.kind === "already-added" && (
        <div className="app-screen__scroll">
          <div className="add-modal__notice">
            <p>
              <strong>{step.result.title}</strong> is already in your
              recommendations.
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep({ kind: "search" })}
            >
              Back to search
            </button>
          </div>
        </div>
      )}

      {step.kind === "details-error" && (
        <div className="app-screen__scroll">
          <div className="add-modal__notice">
            <p className="search-step__status search-step__status--error">
              {step.message}
            </p>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep({ kind: "search" })}
            >
              Back to search
            </button>
          </div>
        </div>
      )}

      {step.kind === "form" && (
        <div className="app-screen__scroll">
          <div className="details-form">
            <div className="details-form__preview">
              {step.details.posterUrl ? (
                <img
                  className="details-form__poster"
                  src={step.details.posterUrl}
                  alt=""
                />
              ) : (
                <div className="details-form__poster details-form__poster--placeholder">
                  🎬
                </div>
              )}
              <div>
                <p className="details-form__title">{step.details.title}</p>
                <p className="details-form__meta">
                  {mediaTypeLabel(step.details.mediaType, step.details.tvSubtype)}
                  {step.details.releaseYear ? ` · ${step.details.releaseYear}` : ""}
                </p>
              </div>
            </div>

            <div className="details-form__field">
              <label htmlFor="recommendation-note">Note (optional)</label>
              <textarea
                id="recommendation-note"
                dir="auto"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why are you recommending this?"
              />
            </div>

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
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setStep({ kind: "search" })}
              >
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSubmit}>
                Add recommendation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
