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

// The tool rail's icons, in the same style.

export const SelectIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 4.5l12 6.2-5.3 1.6-2.2 5.2L6 4.5Z" />
  </svg>
);

export const DataIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 5.5h15l-5.75 7v5.5l-3.5 1.5v-7L4.5 5.5Z" />
  </svg>
);

export const RateIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 12.5h4l2-5 4 10 2-5h5" />
  </svg>
);

export const CompareIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 19.5v-9h4.5v9M14.5 19.5v-14H19v14M3.5 19.5h17" />
  </svg>
);

export const SharesIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 19.5h15" />
    <path d="M4.5 15.5l4-3 3.5 2 7.5-7" />
    <circle cx="8.5" cy="12.5" r="0.6" />
    <circle cx="12" cy="14.5" r="0.6" />
  </svg>
);

export const BeliefIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 18.5h17" />
    <path d="M4 18c3.5 0 4.5-11.5 8-11.5S16.5 18 20 18" />
  </svg>
);

export const DetectorIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 12l5.3-5.3" />
  </svg>
);

export const ChartAddIcon = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
    <path d="M8.5 15.5v-3M12 15.5v-6M15.5 15.5v-4.5" />
  </svg>
);

export const ResetIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 12a6.5 6.5 0 1 0 2-4.7" />
    <path d="M5 4.5v3.5h3.5" />
  </svg>
);
