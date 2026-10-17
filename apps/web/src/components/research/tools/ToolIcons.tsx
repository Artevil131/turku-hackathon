import type { SVGProps } from "react";

// The cell's three actions, in the authored set's style (24px grid, 16px, 1.5px stroke, currentColor).
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
type P = SVGProps<SVGSVGElement>;

export const CopyIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4.5v10M7.5 10.5l4.5 4.5 4.5-4.5M5 19.5h14" />
  </svg>
);

export const ChartIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 4.5v15h15" />
    <path d="M8 15l3.5-4 3 2.5 4-6" />
  </svg>
);

export const EditIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 19l1-4L16.5 4.5a1.8 1.8 0 0 1 2.5 2.5L8.5 17.5 5 19Z" />
  </svg>
);
