import { useState } from "react";
import type { WatchlistItem } from "../types";
import { ScreenHeader } from "../components/ScreenHeader";
import { useSwipeBack } from "../hooks/useSwipeBack";

interface EditWatchlistItemScreenProps {
  item: WatchlistItem;
  onBack: () => void;
  onSave: (patch: Partial<WatchlistItem>) => void;
  // Optional — only App.tsx passes this, to know when it's worth mounting
  // a lightweight backdrop of the previous screen behind an in-progress
  // swipe-back. See useSwipeBack's own comment for the full rationale.
  onSwipeActiveChange?: (active: boolean) => void;
}

// A dedicated, focused edit screen for a Watchlist item's "Details" section
// (the Recommendation fields plus personal Notes) — reached by "Edit" on
// Detail's Details section, same pattern as RecommendationNoteScreen/
// RecommendationSharingScreen, rather than turning Detail itself into an
// inline editing form. Back/Cancel discard the draft unsaved.
export function EditWatchlistItemScreen({
  item,
  onBack,
  onSave,
  onSwipeActiveChange,
}: EditWatchlistItemScreenProps) {
  // Edge-swipe-to-go-back — see useSwipeBack's own comment for why it
  // can't collide with normal scrolling here. Same pattern as DetailScreen
  // (the screen this one is always reached from), so swiping back from
  // here lands on that exact same Watchlist item.
  const swipeBack = useSwipeBack(onBack, onSwipeActiveChange);

  const [draftIsRec, setDraftIsRec] = useState(item.isRecommendation);
  const [draftBy, setDraftBy] = useState(item.recommendedBy ?? "");
  const [draftNote, setDraftNote] = useState(item.recommendationNote ?? "");
  const [draftNotes, setDraftNotes] = useState(item.personalNotes ?? "");

  const handleSave = () => {
    onSave({
      isRecommendation: draftIsRec,
      recommendedBy: draftIsRec && draftBy.trim() ? draftBy.trim() : null,
      recommendationNote: draftIsRec && draftNote.trim() ? draftNote.trim() : null,
      personalNotes: draftNotes.trim() ? draftNotes.trim() : null,
    });
  };

  return (
    <div className="app-screen" {...swipeBack}>
      <ScreenHeader title="Details" onBack={onBack} />
      <div className="app-screen__scroll">
        <div className="details-form">
          <div className="details-form__field">
            <label id="edit-is-recommendation-label">Is this a recommendation?</label>
            <div className="segmented" role="group" aria-labelledby="edit-is-recommendation-label">
              <button
                type="button"
                className={`segmented__option ${draftIsRec ? "is-active" : ""}`}
                onClick={() => setDraftIsRec(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`segmented__option ${!draftIsRec ? "is-active" : ""}`}
                onClick={() => setDraftIsRec(false)}
              >
                No
              </button>
            </div>
          </div>

          {draftIsRec && (
            <>
              <div className="details-form__field">
                <label htmlFor="edit-recommended-by">Who recommended it?</label>
                <input
                  id="edit-recommended-by"
                  type="text"
                  dir="auto"
                  value={draftBy}
                  onChange={(e) => setDraftBy(e.target.value)}
                />
              </div>
              <div className="details-form__field">
                <label htmlFor="edit-recommendation-note">What did they say?</label>
                <textarea
                  id="edit-recommendation-note"
                  dir="auto"
                  rows={2}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="details-form__field">
            <label htmlFor="edit-personal-notes">Notes</label>
            <textarea
              id="edit-personal-notes"
              dir="auto"
              rows={2}
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Anything you want to remember about this"
            />
          </div>

          <div className="details-form__actions">
            <button type="button" className="btn btn--ghost" onClick={onBack}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
