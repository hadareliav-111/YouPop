import { useState } from "react";
import type { FullDetails } from "../../lib/providers";
import type { NewItemDraft } from "../../types";
import { mediaTypeLabel } from "../../lib/mediaTypeLabel";

interface DetailsFormStepProps {
  details: FullDetails;
  onCancel: () => void;
  onSubmit: (draft: NewItemDraft) => void;
}

export function DetailsFormStep({
  details,
  onCancel,
  onSubmit,
}: DetailsFormStepProps) {
  const [isRecommendation, setIsRecommendation] = useState<boolean | null>(
    null,
  );
  const [recommendedBy, setRecommendedBy] = useState("");
  const [recommendationNote, setRecommendationNote] = useState("");
  const [notes, setNotes] = useState("");

  const canSubmit = isRecommendation !== null;

  return (
    <div className="details-form">
      <div className="details-form__preview">
        {details.posterUrl ? (
          <img
            className="details-form__poster"
            src={details.posterUrl}
            alt=""
          />
        ) : (
          <div className="details-form__poster details-form__poster--placeholder">
            🎬
          </div>
        )}
        <div>
          <p className="details-form__title">{details.title}</p>
          <p className="details-form__meta">
            {mediaTypeLabel(details.mediaType, details.tvSubtype)}
            {details.releaseYear ? ` · ${details.releaseYear}` : ""}
          </p>
          {details.isMockData && (
            <p className="details-form__mock-notice">
              Preview data — movie details are placeholders until a real
              movie API key is configured.
            </p>
          )}
          {details.genres.length > 0 && (
            <p className="details-form__genres">{details.genres.join(" · ")}</p>
          )}
        </div>
      </div>

      <div className="details-form__field">
        <label id="add-is-recommendation-label">Is this a recommendation?</label>
        <div className="segmented" role="group" aria-labelledby="add-is-recommendation-label">
          <button
            type="button"
            className={`segmented__option ${isRecommendation === true ? "is-active" : ""}`}
            onClick={() => setIsRecommendation(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`segmented__option ${isRecommendation === false ? "is-active" : ""}`}
            onClick={() => setIsRecommendation(false)}
          >
            No
          </button>
        </div>
      </div>

      {isRecommendation === true && (
        <>
          <div className="details-form__field">
            <label htmlFor="recommended-by">Who recommended it? (optional)</label>
            <input
              id="recommended-by"
              type="text"
              dir="auto"
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              placeholder="e.g. Noa"
            />
          </div>
          <div className="details-form__field">
            <label htmlFor="recommendation-note">What did they say? (optional)</label>
            <textarea
              id="recommendation-note"
              dir="auto"
              value={recommendationNote}
              onChange={(e) => setRecommendationNote(e.target.value)}
              placeholder="e.g. She said I would love it."
              rows={2}
            />
          </div>
        </>
      )}

      <div className="details-form__field">
        <label htmlFor="personal-notes">Notes (optional)</label>
        <textarea
          id="personal-notes"
          dir="auto"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything you want to remember about this"
          rows={2}
        />
      </div>

      <div className="details-form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              isRecommendation: isRecommendation ?? false,
              recommendedBy,
              recommendationNote,
              personalNotes: notes,
            })
          }
        >
          Add to watchlist
        </button>
      </div>
    </div>
  );
}
