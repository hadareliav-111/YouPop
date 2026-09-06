interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
}

export function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];
  const readOnly = !onChange;

  return (
    <div
      className={`star-rating star-rating--${size} ${readOnly ? "star-rating--readonly" : ""}`}
      role={readOnly ? undefined : "radiogroup"}
      aria-label="Personal rating"
    >
      {stars.map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            className={`star-rating__star ${filled ? "is-filled" : ""}`}
            disabled={readOnly}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-pressed={filled}
            onClick={() => onChange?.(star)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
