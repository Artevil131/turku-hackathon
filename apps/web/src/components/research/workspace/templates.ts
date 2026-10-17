import { defaultLayout, type Layout, serializeLayout, WIN_IDS, type WinId, type WinState } from "./layout.ts";

export const TEMPLATES = ["blank", "outbreak", "antibiogram", "regional", "patient"] as const;
export type Template = (typeof TEMPLATES)[number];
export const TEMPLATE_KEYS = {
  blank: ["startBlank", "startBlankNote"],
  outbreak: ["startOutbreak", "startOutbreakNote"],
  antibiogram: ["startAntibiogram", "startAntibiogramNote"],
  regional: ["startRegional", "startRegionalNote"],
  patient: ["startPatient", "startPatientNote"],
} as const;
/** "Treat a patient" is a quick start: it opens a view straight away and saves no project (D-065). */
export const QUICK_STARTS: readonly Template[] = ["patient"];

/** Which windows each template opens, as grid rectangles (12 columns, 24 px rows). The timeline band is always on the page. */
const OPEN: Record<Template, Partial<Record<WinId, Partial<WinState>>>> = {
  blank: {},
  outbreak: {
    signals: { x: 0, y: 0, w: 4, h: 40 },
    math: { x: 4, y: 0, w: 4, h: 40 },
    graph: { x: 8, y: 0, w: 4, h: 40 },
  },
  antibiogram: { grid: { x: 0, y: 0, w: 6, h: 30 }, coverage: { x: 6, y: 0, w: 6, h: 30 } },
  regional: { map: { x: 0, y: 0, w: 12, h: 36 } },
  patient: { coverage: { x: 0, y: 0, w: 12, h: 36 } },
};

/** The template's layout on the researcher's grid: the named windows open, every other window closed. */
export function templateLayout(template: Template): Layout {
  const base = defaultLayout();
  const wins = { ...base.wins };
  for (const id of WIN_IDS) {
    const patch = OPEN[template][id];
    wins[id] = patch ? { ...wins[id], ...patch, open: true } : { ...wins[id], open: false };
  }
  return { wins, charts: {}, order: base.order };
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
