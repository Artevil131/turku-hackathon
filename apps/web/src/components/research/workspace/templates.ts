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
const WINDOWS: Record<Template, string[]> = {
  blank: [],
  outbreak: ["signals", "math", "graph"],
  antibiogram: ["grid", "coverage"],
  regional: ["map"],
  patient: ["coverage"],
};

/** Only use registered windows: a template remains usable during a rolling deployment. */
export function templateLayout(template: Template): Layout {
  const ids = WINDOWS[template].filter((id): id is WinId => (WIN_IDS as readonly string[]).includes(id));
  const columns = ids.map((id) => ({ id, width: 1 / ids.length, windows: [{ id, size: 1 }] }));
  const closed: Layout["closed"] = {};
  for (const id of WIN_IDS) if (!ids.includes(id)) closed[id] = { column: id, columnIndex: columns.length, index: 0, size: 1 };
  return { columns, closed, maximized: template === "patient" ? (ids[0] ?? null) : null };
}
export function templateJson(template: Template): Record<string, unknown> {
  return JSON.parse(serializeLayout(templateLayout(template)));
}
