import { type Layout, serializeLayout, WIN_IDS, type WinId } from "./layout.ts";

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

/** Columns of stacked windows, each with its share of the column. At most three columns (the dock's limit). */
const COLUMNS: Record<Template, [string, number][][]> = {
  blank: [],
  outbreak: [
    [["signals", 1]],
    [["math", 1]],
    [
      ["timeline", 0.4],
      ["graph", 0.6],
    ],
  ],
  antibiogram: [[["grid", 1]], [["coverage", 1]]],
  regional: [
    [
      ["timeline", 0.32],
      ["map", 0.68],
    ],
  ],
  patient: [[["coverage", 1]]],
};

const registered = (id: string): id is WinId => (WIN_IDS as readonly string[]).includes(id);

/** Only use registered windows: a template remains usable during a rolling deployment. */
export function templateLayout(template: Template): Layout {
  const stacks = COLUMNS[template]
    .map((stack) => stack.filter(([id]) => registered(id)) as [WinId, number][])
    .filter((stack) => stack.length);
  const columns = stacks.map((stack) => ({
    id: stack[0]?.[0] as string,
    width: 1 / stacks.length,
    windows: stack.map(([id, size]) => ({ id, size: size / stack.reduce((s, [, n]) => s + n, 0) })),
  }));
  const open = new Set(stacks.flat().map(([id]) => id));
  const closed: Layout["closed"] = {};
  for (const id of WIN_IDS) if (!open.has(id)) closed[id] = { column: id, columnIndex: columns.length, index: 0, size: 1 };
  const first = columns[0]?.windows[0]?.id ?? null;
  return { columns, closed, maximized: template === "patient" ? first : null };
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
