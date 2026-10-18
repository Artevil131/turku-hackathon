import { baseLayout, type Layout, serializeLayout, WIN_IDS, type WinId, type WinState, withTimeline } from "./layout.ts";

export const TEMPLATES = ["research", "patient", "monitor", "blank", "outbreak", "antibiogram", "regional"] as const;
export type Template = (typeof TEMPLATES)[number];
export const TEMPLATE_KEYS = {
  research: ["startResearch", "startResearchNote"],
  monitor: ["startMonitor", "startMonitorNote"],
  blank: ["startBlank", "startBlankNote"],
  outbreak: ["startOutbreak", "startOutbreakNote"],
  antibiogram: ["startAntibiogram", "startAntibiogramNote"],
  regional: ["startRegional", "startRegionalNote"],
  patient: ["startPatient", "startPatientNote"],
} as const;
/** "Treat a patient" is a quick start: it opens a view straight away and saves no project (D-065). */
export const QUICK_STARTS: readonly Template[] = ["patient"];

/** Which windows each template opens, as grid rectangles (12 columns, 24 px rows). Every template also gets the timeline across the top. */
const OPEN: Record<Template, Partial<Record<WinId, Partial<WinState>>>> = {
  // The continuous watch of a unit, empty: what is open now on top, the notebook to write in, the evidence beside it.
  monitor: {
    answer: { x: 0, y: 0, w: 12, h: 9 },
    notebook: { x: 0, y: 9, w: 7, h: 56 },
    signals: { x: 7, y: 9, w: 5, h: 28 },
    graph: { x: 7, y: 37, w: 5, h: 28 },
  },
  // The researcher demo's desk, empty: the notebook to write in with the signals beside it.
  research: {
    notebook: { x: 0, y: 0, w: 8, h: 56 },
    signals: { x: 8, y: 0, w: 4, h: 56 },
  },
  blank: {},
  outbreak: {
    answer: { x: 0, y: 0, w: 12, h: 9 },
    signals: { x: 0, y: 9, w: 5, h: 36 },
    graph: { x: 5, y: 9, w: 7, h: 36 },
  },
  antibiogram: { grid: { x: 0, y: 0, w: 6, h: 30 }, coverage: { x: 6, y: 0, w: 6, h: 30 } },
  regional: { map: { x: 0, y: 0, w: 8, h: 36 }, signals: { x: 8, y: 0, w: 4, h: 36 } },
  patient: { coverage: { x: 0, y: 0, w: 12, h: 36 } },
};

/** A layout on the researcher's grid: the named windows open at their rectangles, every other window closed, the timeline across the top. */
export function gridLayout(open: Partial<Record<WinId, Partial<WinState>>>, timeline: "top" | "bottom" | "none" = "top"): Layout {
  const base = baseLayout();
  const wins = { ...base.wins };
  for (const id of WIN_IDS) {
    const patch = open[id];
    wins[id] = patch ? { ...wins[id], ...patch, open: true } : { ...wins[id], open: false };
  }
  return withTimeline({ wins, copies: {}, charts: {}, order: base.order }, timeline);
}

/** The template's layout on the researcher's grid. Every template also gets the timeline across the top. */
export function templateLayout(template: Template): Layout {
  // Treat a patient is a quick view, not a project: the coverage list comes first and the timeline stays out of its way.
  return gridLayout(OPEN[template], template === "patient" ? "none" : "top");
}
export function templateJson(template: Template): Record<string, unknown> {
  return JSON.parse(serializeLayout(templateLayout(template)));
}

/**
 * The next free numbered name for a template, "Outbreak investigation 3", counting the
 * names already taken by `existing` (case-insensitive, any project).
 */
export function nextName(base: string, existing: readonly string[], format: (n: number) => string): string {
  const taken = new Set(existing.map((name) => name.trim().toLowerCase()));
  for (let n = 1; ; n++) {
    const name = format(n);
    if (!taken.has(name.trim().toLowerCase())) return name;
    if (n > 10_000) return `${base} ${Date.now()}`;
  }
}
