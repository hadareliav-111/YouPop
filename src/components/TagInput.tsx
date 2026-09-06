import { useId, useState } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add a tag and press Enter",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const commit = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, value]);
    setDraft("");
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const remainingSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="tag-input">
      {tags.length > 0 && (
        <div className="tag-input__chips">
          {tags.map((tag) => (
            <span className="chip chip--removable" key={tag}>
              {tag}
              <button
                type="button"
                className="chip__remove"
                aria-label={`Remove tag ${tag}`}
                onClick={() => remove(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        dir="auto"
        className="tag-input__field"
        value={draft}
        placeholder={placeholder}
        list={listId}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            remove(tags[tags.length - 1]);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
      />
      {remainingSuggestions.length > 0 && (
        <datalist id={listId}>
          {remainingSuggestions.map((s) => (
            <option value={s} key={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
