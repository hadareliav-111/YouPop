// Small hand-written line icons for the three main tabs — deliberately not
// a third-party icon library (the project has none, and three icons don't
// justify adding one). Same viewBox, stroke width, and line caps/joins
// across all three so they read as one coherent set rather than mismatched
// emoji, while keeping the exact same meanings (TV, star, two people).
// `currentColor` means the existing active/inactive tab color rule (which
// sets `color`) already themes these for free.

interface IconProps {
  className?: string;
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function TvIcon({ className }: IconProps) {
  return (
    <svg className={className} {...iconProps}>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} {...iconProps}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <svg className={className} {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
