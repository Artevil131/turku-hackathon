import type { ExportPage, PageBlock } from "@aei/export";
import type { ChartSpec } from "../charts/spec.ts";
import { shift } from "../feed/model.ts";
import { type Lang, methodFor, pythonScript } from "../tools/method.ts";
import {
  type CellResult,
  cellTable,
  type DetectorChoice,
  type EventSpec,
  eventKey,
  type Frame,
  frameDays,
  parseEvent,
  type Slice,
  type ToolId,
} from "../tools/model.ts";
import type { RunInputs } from "../tools/run.ts";

export { codeFor, type Lang, lettersOf, methodFor, methodPython } from "../tools/method.ts";

// The notebook page (pure): a list of cells, the slice each analysis reads (the nearest slice cell above it),
// the page's storage with a version, the code a cell is prefilled with, and the page as Markdown blocks.

export const NOTEBOOK_KEY = "aei.research.notebook";
export const PAGE_VERSION = 1;

export type BMode = "previous" | "unit" | "custom";
export interface AnalysisParams {
  /** `phenotype:esbl` or `antibiotic:CIP` (eventKey). */
  event: string;
  bMode: BMode;
  /** Compare against this unit when bMode is "unit"; "" is every unit. */
  bUnit: string;
  bFrom: string;
  bTo: string;
  period: number;
  discounted: boolean;
  delta: number;
  m: number;
  detector: DetectorChoice;
}

interface Base {
  id: string;
  collapsed?: boolean;
}
export interface SliceCell extends Base {
  kind: "slice";
  slice: Slice;
}
export interface NoteCell extends Base {
  kind: "note";
  text: string;
}
export interface AnalysisCell extends Base {
  kind: "analysis";
  tool: ToolId;
  params: AnalysisParams;
  /** The last run, with the slice it ran on; null before the first Run. */
  result: CellResult | null;
}
export interface CodeCell extends Base {
  kind: "code";
  lang: Lang;
  code: string;
  /** False while the code is still the prefill (switching language then swaps the prefill). */
  edited: boolean;
}
export interface ChartCell extends Base {
  kind: "chart";
  spec: ChartSpec;
}
export type NbCell = SliceCell | NoteCell | AnalysisCell | CodeCell | ChartCell;
export type CellKind = NbCell["kind"];
export interface Page {
  v: typeof PAGE_VERSION;
  cells: NbCell[];
}

export const emptyPage = (): Page => ({ v: PAGE_VERSION, cells: [] });

let seq = 0;
export const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------- slices ----------

const SLICE_KEYS = ["from", "to", "unit", "organism", "specimen", "phenotype", "firstOnly"] as const;
export const sameSlice = (a: Slice, b: Slice) => SLICE_KEYS.every((k) => a[k] === b[k]);

/** The slice cell an analysis at `index` reads: the nearest one above it, else null. */
export function sliceAbove(cells: readonly NbCell[], index: number): SliceCell | null {
  for (let i = Math.min(index, cells.length) - 1; i >= 0; i--) {
    const c = cells[i] as NbCell;
    if (c.kind === "slice") return c;
  }
  return null;
}

/** 1-based number of a slice cell among the page's slice cells ("Slice 2"). */
export const sliceNumber = (cells: readonly NbCell[], id: string) =>
  cells.filter((c) => c.kind === "slice").findIndex((c) => c.id === id) + 1;

/** The nearest analysis above `index` that has run, for a code cell's prefill. */
export function resultAbove(cells: readonly NbCell[], index: number): CellResult | null {
  for (let i = Math.min(index, cells.length) - 1; i >= 0; i--) {
    const c = cells[i] as NbCell;
    if (c.kind === "analysis" && c.result) return c.result;
  }
  return null;
}

/** A new slice cell's slice: the timeline's range, else the selected signal's window, else the nearest slice above, else 12 weeks to the clock. */
export function newSlice(
  sources: { timeline: { from: string; to: string } | null; signal: { from: string; to: string; unit?: string } | null },
  above: Slice | null,
  asOf: string | null,
): Slice {
  const base: Slice = above ?? {
    from: "",
    to: "",
    unit: "",
    organism: "",
    specimen: "",
    phenotype: "",
    firstOnly: true,
  };
  const frame = sources.timeline ?? sources.signal;
  if (frame) return { ...base, from: frame.from, to: frame.to, unit: sources.timeline ? base.unit : (sources.signal?.unit ?? base.unit) };
  if (above) return above;
  const to = asOf ?? new Date().toISOString().slice(0, 10);
  return { ...base, from: shift(to, 1 - 12 * 7), to };
}

// ---------- analysis parameters ----------

export function defaultParams(slice: Slice | null): AnalysisParams {
  const prev = slice ? previousFrame(slice) : null;
  return {
    event: eventKey({ type: "phenotype", code: slice?.phenotype || "esbl" }),
    bMode: "previous",
    bUnit: "",
    bFrom: prev?.from ?? "",
    bTo: prev?.to ?? "",
    period: 7,
    discounted: false,
    delta: 0.95,
    m: 30,
    detector: "phenotype",
  };
}

/** Frame B's default: the same length immediately before frame A (as the rail's). */
export function previousFrame(s: Slice): Frame {
  const to = shift(s.from, -1);
  return { from: shift(to, 1 - frameDays(s)), to, unit: s.unit };
}

/** Frame B as the parameters say; "unit" with none chosen takes the first other unit of `wards`. */
export function frameBOf(s: Slice, p: AnalysisParams, wards: readonly string[]): Frame {
  if (p.bMode === "previous") return previousFrame(s);
  if (p.bMode === "unit")
    return { from: s.from, to: s.to, unit: p.bUnit && p.bUnit !== s.unit ? p.bUnit : (wards.find((w) => w !== s.unit) ?? "") };
  return { from: p.bFrom || s.from, to: p.bTo || s.to, unit: s.unit };
}

export function runInputs(s: Slice, p: AnalysisParams, wards: readonly string[]): RunInputs {
  return {
    event: parseEvent(p.event),
    frameB: frameBOf(s, p, wards),
    periodDays: p.period,
    discount: p.discounted ? { delta: p.delta, m: p.m } : null,
    detector: p.detector,
  };
}

/** The parameters a result was run with, so a rail result lands in the notebook with them. */
export function paramsOf(r: CellResult): AnalysisParams {
  const base = defaultParams(r.slice);
  const event = "event" in r ? eventKey(r.event as EventSpec) : base.event;
  if (r.kind === "compare") {
    const prev = previousFrame(r.slice);
    const isPrev = r.b.frame.from === prev.from && r.b.frame.to === prev.to && r.b.frame.unit === r.slice.unit;
    const isUnit = !isPrev && r.b.frame.from === r.slice.from && r.b.frame.to === r.slice.to;
    return {
      ...base,
      event,
      bMode: isPrev ? "previous" : isUnit ? "unit" : "custom",
      bUnit: isUnit ? r.b.frame.unit : "",
      bFrom: r.b.frame.from,
      bTo: r.b.frame.to,
    };
  }
  if (r.kind === "shares") return { ...base, event, period: r.periodDays };
  if (r.kind === "beta")
    return { ...base, event, discounted: r.discounted !== null, delta: r.discounted?.delta ?? base.delta, m: r.discounted?.m ?? base.m };
  if (r.kind === "detector") return { ...base, detector: r.detector };
  return base;
}

// ---------- page edits ----------

export const insertAt = (page: Page, index: number, cell: NbCell): Page => ({
  ...page,
  cells: [...page.cells.slice(0, index), cell, ...page.cells.slice(index)],
});
export const removeCell = (page: Page, id: string): Page => ({ ...page, cells: page.cells.filter((c) => c.id !== id) });
export const patchCell = (page: Page, id: string, patch: Partial<NbCell>): Page => ({
  ...page,
  cells: page.cells.map((c) => (c.id === id ? ({ ...c, ...patch } as NbCell) : c)),
});
/** Moves a cell to `to` (its index after the move), clamped to the page. */
export function moveCell(page: Page, id: string, to: number): Page {
  const from = page.cells.findIndex((c) => c.id === id);
  if (from < 0) return page;
  const cells = page.cells.filter((c) => c.id !== id);
  const at = Math.max(0, Math.min(cells.length, to));
  cells.splice(at, 0, page.cells[from] as NbCell);
  return { ...page, cells };
}

/**
 * A rail result onto the page: under the last slice cell equal to its slice (before the next slice cell, so it
 * reads that slice), or under a new slice cell at the end when the page has none equal to it.
 */
export function appendResult(page: Page, r: CellResult): Page {
  const cell: AnalysisCell = { id: newId(), kind: "analysis", tool: r.kind, params: paramsOf(r), result: r };
  const at = page.cells.findLastIndex((c) => c.kind === "slice" && sameSlice(c.slice, r.slice));
  if (at < 0) return { ...page, cells: [...page.cells, { id: newId(), kind: "slice", slice: r.slice }, cell] };
  const next = page.cells.findIndex((c, i) => i > at && c.kind === "slice");
  return insertAt(page, next < 0 ? page.cells.length : next, cell);
}

// ---------- storage ----------

/** Non-finite numbers (NaN p's, an infinite ratio bound) survive JSON as tagged strings. */
const TAG = "\u0000num:";
function replacer(_k: string, v: unknown) {
  return typeof v === "number" && !Number.isFinite(v) ? `${TAG}${v}` : v;
}
function reviver(_k: string, v: unknown) {
  return typeof v === "string" && v.startsWith(TAG) ? Number(v.slice(TAG.length)) : v;
}

export const serialisePage = (page: Page): string => JSON.stringify(page, replacer);

const KINDS: readonly CellKind[] = ["slice", "note", "analysis", "code", "chart"];
const TOOLS: readonly ToolId[] = ["rate", "compare", "shares", "beta", "detector"];

function validCell(c: unknown): c is NbCell {
  if (!c || typeof c !== "object") return false;
  const x = c as Record<string, unknown>;
  if (typeof x.id !== "string" || !KINDS.includes(x.kind as CellKind)) return false;
  switch (x.kind) {
    case "slice":
      return !!x.slice && typeof (x.slice as Slice).from === "string" && typeof (x.slice as Slice).to === "string";
    case "note":
      return typeof x.text === "string";
    case "analysis":
      return TOOLS.includes(x.tool as ToolId) && !!x.params && typeof x.params === "object";
    case "code":
      return (x.lang === "python" || x.lang === "r") && typeof x.code === "string";
    default:
      return !!x.spec && typeof x.spec === "object";
  }
}

/** Reads a stored page; anything of another version or malformed gives null; a malformed cell is dropped. */
export function parsePage(raw: string | null): Page | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw, reviver) as { v?: unknown; cells?: unknown };
    if (v.v !== PAGE_VERSION || !Array.isArray(v.cells)) return null;
    return { v: PAGE_VERSION, cells: v.cells.filter(validCell) };
  } catch {
    return null;
  }
}

/** The page's slot: one per hospital ("all" for every site), and per project when one is open. */
export const pageSlot = (site: string | null, project: string | null) => `${site ?? "all"}${project ? `@${project}` : ""}`;

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function loadPage(slot: string): Page {
  const all = readAll();
  return (all[slot] ? parsePage(JSON.stringify(all[slot])) : null) ?? emptyPage();
}

export function savePage(slot: string, page: Page): void {
  try {
    const all = readAll();
    all[slot] = JSON.parse(serialisePage(page));
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(all));
  } catch {
    // Private mode or a full store: the page lives until the reload.
  }
}

// ---------- export ----------

export interface ExportWords {
  title: string;
  locale: "en" | "fi";
  sliceHeading: (n: number) => string;
  sliceSentence: (s: Slice) => string;
  toolTitle: (r: CellResult | null, tool: ToolId) => string;
  notRun: string;
}

/** The page as Markdown blocks: notes as written, slice sentences, each result's table and formula, code fenced. */
export function pageBlocks(page: Page, asOf: string, words: ExportWords): ExportPage {
  const blocks: PageBlock[] = [];
  let slices = 0;
  for (const c of page.cells) {
    if (c.kind === "note") blocks.push({ kind: "note", text: c.text });
    else if (c.kind === "slice") {
      blocks.push({ kind: "heading", text: words.sliceHeading(++slices) }, { kind: "line", text: words.sliceSentence(c.slice) });
    } else if (c.kind === "code") blocks.push({ kind: "code", lang: c.lang, code: c.code });
    else if (c.kind === "analysis") {
      blocks.push({ kind: "heading", text: words.toolTitle(c.result, c.tool) });
      if (!c.result) {
        blocks.push({ kind: "line", text: words.notRun });
        continue;
      }
      const m = methodFor(c.result);
      blocks.push(
        { kind: "line", text: `${m.name[words.locale]} (${m.decisions.join(", ")})` },
        { kind: "math", latex: m.latex },
        { kind: "table", table: cellTable(c.result) },
        { kind: "code", lang: "python", code: pythonScript(c.result) },
      );
    }
  }
  return { title: words.title, asOf, blocks };
}
