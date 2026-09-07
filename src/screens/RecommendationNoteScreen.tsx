import { useState } from "react";
import { ScreenHeader } from "../components/ScreenHeader";

interface RecommendationNoteScreenProps {
  note: string | null;
  onBack: () => void;
  onSave: (note: string | null) => void;
}

// A dedicated, focused edit screen for a Recommendation's Note — reached by
// "Edit" on Recommendation Detail's Note section, same pattern as
// RecommendationSharingScreen, rather than expanding the editor inline on
// Recommendation Detail. Same textarea markup/behavior as before, just
// moved to its own screen; Back/Cancel discard the draft unsaved.
export function RecommendationNoteScreen({ note, onBack, onSave }: RecommendationNoteScreenProps) {
  const [draftNote, setDraftNote] = useState(note ?? "");

  const handleSave = () => {
    onSave(draftNote.trim() ? draftNote.trim() : null);
  };

  return (
    <div className="app-screen">
      <ScreenHeader title="Note" onBack={onBack} />
      <div className="app-screen__scroll">
        <div className="details-form">
          <div className="details-form__field">
            <textarea
              dir="auto"
              rows={3}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Why are you recommending this?"
            />
          </div>
          <div className="details-form__actions">
            <button type="button" className="btn btn--ghost" onClick={onBack}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
