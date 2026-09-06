import { useState } from "react";
import { v4 as uuid } from "../lib/uuid";
import {
  getDetails,
  type FullDetails,
  type MediaSource,
  type SearchResultItem,
} from "../lib/providers";
import type { NewItemDraft, WatchlistItem } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";
import { SearchStep } from "../components/AddFlow/SearchStep";
import { DetailsFormStep } from "../components/AddFlow/DetailsFormStep";

interface AddScreenProps {
  onClose: () => void;
  onAdd: (item: WatchlistItem) => void;
  existingTags: string[];
  isAlreadyAdded: (source: MediaSource, externalId: string) => boolean;
}

type Step =
  | { kind: "search" }
  | { kind: "loading-details"; result: SearchResultItem }
  | { kind: "details-error"; result: SearchResultItem; message: string }
  | { kind: "already-added"; result: SearchResultItem }
  | { kind: "form"; details: FullDetails };

// Full page rather than a bottom-sheet modal: search needs a fixed input row
// with results scrolling underneath it (see SearchStep), which only really
// reads as "native" when it owns the whole screen rather than a fraction of
// it docked to the bottom.
export function AddScreen({
  onClose,
  onAdd,
  existingTags,
  isAlreadyAdded,
}: AddScreenProps) {
  const [step, setStep] = useState<Step>({ kind: "search" });

  const handleSelect = async (result: SearchResultItem) => {
    if (isAlreadyAdded(result.source, result.externalId)) {
      setStep({ kind: "already-added", result });
      return;
    }
    setStep({ kind: "loading-details", result });
    try {
      const details = await getDetails(result.source, result.externalId);
      if (isAlreadyAdded(details.source, details.externalId)) {
        setStep({ kind: "already-added", result });
        return;
      }
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

  const handleSubmit = (draft: NewItemDraft) => {
    if (step.kind !== "form") return;
    const details = step.details;
    const now = new Date().toISOString();
    const item: WatchlistItem = {
      id: uuid(),
      externalId: details.externalId,
      externalSource: details.source,
      title: details.title,
      mediaType: details.mediaType,
      tvSubtype: details.tvSubtype,
      releaseYear: details.releaseYear,
      releaseDate: details.releaseDate,
      posterUrl: details.posterUrl,
      genres: details.genres,
      overview: details.overview,
      externalRating: details.externalRating,
      externalRatings: details.externalRatings,
      numberOfSeasons: details.numberOfSeasons,
      status: "want_to_watch",
      personalRating: null,
      currentEpisode: null,
      sortOrder: 0, // useWatchlist.addItem assigns the real end-of-category position
      isRecommendation: draft.isRecommendation,
      recommendedBy: draft.isRecommendation && draft.recommendedBy.trim()
        ? draft.recommendedBy.trim()
        : null,
      recommendationNote:
        draft.isRecommendation && draft.recommendationNote.trim()
          ? draft.recommendationNote.trim()
          : null,
      personalNotes: draft.personalNotes.trim() ? draft.personalNotes.trim() : null,
      personalTags: draft.personalTags,
      dateAdded: now,
      dateWatched: null,
    };
    onAdd(item);
    onClose();
  };

  const title =
    step.kind === "form" ? "Add to your watchlist" : "Add a movie or show";

  // Back from anything other than the search step returns to search (same
  // destination as the existing "Back to search" links) rather than
  // immediately exiting Add — only Back from search itself leaves the flow.
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
        <SearchStep onSelect={handleSelect} isAlreadyAdded={isAlreadyAdded} />
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
              watchlist.
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
          <DetailsFormStep
            details={step.details}
            existingTags={existingTags}
            onCancel={() => setStep({ kind: "search" })}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}
