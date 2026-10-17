/*
  Icon: a small stroke icon set (24 px grid, 1.75 stroke, currentColor).
    name     IconName
    size?    px, default 20
    title?   accessible name; without it the icon is decorative (aria-hidden)
    className?
*/

export type IconName =
  | "treat"
  | "alerts"
  | "report"
  | "timeline"
  | "settings"
  | "play"
  | "pause"
  | "step"
  | "skip"
  | "calendar"
  | "sparkle"
  | "close"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "search"
  | "info"
  | "arrow-right"
  | "send"
  | "speed"
  | "flask"
  | "wifi-off"
  | "refresh"
  | "alert-triangle"
  | "shield"
  | "users"
  | "filter"
  | "sliders"
  | "inbox"
  | "trend-up"
  | "trend-down"
  | "minus";

const PATHS: Record<IconName, string> = {
  // a capsule split in two halves
  treat: "M10.5 3.5a5 5 0 0 1 7.07 7.07l-7 7a5 5 0 0 1-7.07-7.07l7-7Z M7 7l10 10",
  alerts: "M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z M10 20a2 2 0 0 0 4 0",
  report: "M4 4.5h16v15H4z M4 9.5h16 M4 14.5h16 M10 9.5v10",
  timeline: "M3.5 17.5l5-6 4 3.5 7.5-9 M3.5 20.5h17",
  settings:
    "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-2 1.2l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-2.9L3 9.3l2-3.4 1.9.7a7.6 7.6 0 0 1 2-1.2l.3-2h4l.3 2a7.6 7.6 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 2.9Z",
  play: "M7.5 5.2v13.6a.6.6 0 0 0 .9.5l10.6-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5Z",
  pause: "M8 5h2.5v14H8z M13.5 5H16v14h-2.5z",
  step: "M6 6l7 6-7 6V6Z M17 6v12",
  skip: "M4 6l6 6-6 6V6Z M11 6l6 6-6 6V6Z M20 6v12",
  calendar: "M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4",
  sparkle:
    "M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5Z M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z",
  close: "M6 6l12 12 M18 6L6 18",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-left": "M15 6l-6 6 6 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z M15.5 15.5L20 20",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5.5 M12 7.6v.2",
  "arrow-right": "M5 12h14 M13 6l6 6-6 6",
  send: "M4.5 12L20 4.5 16 20l-4-6.5L4.5 12Z M12 13.5L20 4.5",
  speed: "M4.5 16.5a8 8 0 1 1 15 0 M12 13.5l4-4.5",
  flask: "M9.5 3.5h5 M10.5 3.5v5.5L5 18.5a1.5 1.5 0 0 0 1.3 2.2h11.4a1.5 1.5 0 0 0 1.3-2.2L13.5 9V3.5 M7.5 14.5h9",
  "wifi-off":
    "M3.5 3.5l17 17 M8.5 16.2a5 5 0 0 1 7 0 M5 12.6a10 10 0 0 1 5-2.5 M14.5 10.2A10 10 0 0 1 19 12.6 M2 9a14 14 0 0 1 4-2.6 M11 5.5A14 14 0 0 1 22 9 M12 19.5h.01",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4.5v4h-4",
  "alert-triangle": "M12 4l9 15.5H3L12 4Z M12 10v4.5 M12 17.2v.2",
  shield: "M12 3.5l7.5 3v5.5c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6.5l7.5-3Z",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14a6.5 6.5 0 0 1 3.5 6",
  filter: "M4 5.5h16l-6.2 7.2v5.8l-3.6 1.5v-7.3L4 5.5Z",
  sliders: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4.5v5 M9 14.5v5",
  inbox: "M3.5 13.5l2.5-8h12l2.5 8v5h-17v-5Z M3.5 13.5h5l1 2.5h5l1-2.5h5",
  "trend-up": "M3.5 17l6-6 4 4 7-7.5 M15 7.5h5.5V13",
  "trend-down": "M3.5 7l6 6 4-4 7 7.5 M15 16.5h5.5V11",
  minus: "M5 12h14",
};

const FILLED: ReadonlySet<IconName> = new Set<IconName>(["play", "pause"]);

export function Icon({ name, size = 20, title, className }: { name: IconName; size?: number; title?: string; className?: string }) {
  const filled = FILLED.has(name);
  return (
    <svg
      className={className ? `k-icon ${className}` : "k-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The AEI mark: a petri dish with a ring of susceptibility discs, one clear zone. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="k-mark">
      <defs>
        <linearGradient id="aei-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f78cf" />
          <stop offset="1" stopColor="#174a8b" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#aei-mark-g)" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="4.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 1.6" />
      <circle cx="16" cy="16" r="1.8" fill="#fff" />
      <circle cx="10.2" cy="11.4" r="1.3" fill="rgba(255,255,255,.7)" />
      <circle cx="21.8" cy="20.6" r="1.3" fill="rgba(255,255,255,.7)" />
    </svg>
  );
}
