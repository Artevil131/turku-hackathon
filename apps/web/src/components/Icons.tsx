// Authored icon set: 24px grid, drawn at 16 px with a 1.5 px stroke, currentColor, round joins.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  width: 16,
  height: 16,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Product mark: a test-card well with a disc and its clear zone. */
export const Mark = (p: P) => (
  <svg {...base} viewBox="0 0 32 32" {...p}>
    <circle cx="16" cy="16" r="13" />
    <circle cx="16" cy="16" r="7.5" strokeDasharray="2.4 2.6" />
    <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const Ask = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 12a8 8 0 1 1 3.1 6.3L4 19.5l1.1-3.3A7.9 7.9 0 0 1 4 12Z" />
    <path d="M9.5 10.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.1-2.5 3.4" />
    <path d="M12 17h.01" />
  </svg>
);

export const Play = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
  </svg>
);

export const Pause = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth="2.6" />
  </svg>
);

export const StepDay = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l7 6-7 6" />
    <path d="M17 6v12" />
  </svg>
);

export const StepWeek = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 6l6 6-6 6" />
    <path d="M11 6l6 6-6 6" />
    <path d="M20.5 6v12" />
  </svg>
);

export const Chevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 14.5l6-6 6 6" />
  </svg>
);

export const Sun = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);

export const Moon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </svg>
);

export const Check = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const AlertTri = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
    <path d="M12 10v4.2M12 17.2h.01" />
  </svg>
);

export const Rise = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 17l6-6 4 4 7-7.5" />
    <path d="M15 7.5h5.5V13" />
  </svg>
);

export const Flask = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.3 1.3 0 0 0 1.1 2h11.8a1.3 1.3 0 0 0 1.1-2l-5.5-9.5v-6" />
    <path d="M7.5 15h9" />
  </svg>
);

export const Open = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
  </svg>
);

/** Small filled triangle for deltas. */
export const Tri = ({ dir, ...p }: P & { dir: "up" | "down" }) => (
  <svg viewBox="0 0 8 8" aria-hidden="true" {...p}>
    <path d={dir === "up" ? "M4 1 7.5 7h-7L4 1Z" : "M4 7 .5 1h7L4 7Z"} fill="currentColor" />
  </svg>
);

export const Doctor = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 3.5v5a5 5 0 0 0 10 0v-5" />
    <path d="M12 13.5v3a4 4 0 0 0 8 0v-1.5" />
    <circle cx="20" cy="13" r="1.6" />
    <path d="M6 3.5h2M16 3.5h2" />
  </svg>
);

export const Microscope = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 3.5l4 2-3.5 7-4-2L9 3.5Z" />
    <path d="M7.5 12.5 6 15.5" />
    <path d="M14.5 9.5a6 6 0 0 1-1 10.5" />
    <path d="M4 20.5h14M8 17.5h6" />
  </svg>
);

export const Gear = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

/** A plug: data coming in (the Connect page). */
export const Plug = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 3v4M15 3v4M7 7h10v3a5 5 0 0 1-10 0V7ZM12 15v6" />
  </svg>
);

/** An upward tray: import a file. */
export const Upload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

/** A clipboard: paste a message. */
export const Paste = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M8.5 12h7M8.5 16h5" />
  </svg>
);

/** A building with a cross: connect a hospital. */
export const Hospital = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 21V7l8-4 8 4v14M2 21h20M12 8v6M9 11h6M9 21v-3h6v3" />
  </svg>
);

/** A terminal prompt: a command to run. */
export const Terminal = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5h16v14H4zM7.5 9.5 10 12l-2.5 2.5M12 15h4" />
  </svg>
);

/** The info glyph behind every ⓘ button. */
export const Info = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6h.01" />
  </svg>
);

/** The level ladder: three steps, unit to hospital. */
export const Levels = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 19.5h5v-5h5v-5h6" />
    <path d="M4 19.5V4.5" opacity="0.35" />
  </svg>
);

export const Tick = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="2" />
  </svg>
);

export const Cross = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" strokeWidth="2" />
  </svg>
);

/** Approximately: the borderline result glyph. */
export const Approx = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 9.5c2.5-3 4.5 3 7.5 0s5-3 7.5 0M4.5 15.5c2.5-3 4.5 3 7.5 0s5-3 7.5 0" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
