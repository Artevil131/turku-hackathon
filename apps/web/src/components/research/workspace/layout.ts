// The window workspace's geometry: a 12-column grid with rows of 24 px.
// Everything here is pure (no DOM), so snapping, clamping and persistence
// can be tested and the default layout always fits the board it is given.

export const COLS = 12;
export const ROW_PX = 24;
export const STORAGE_KEY = "aei.research.layout";
/** The board grows downward as windows move down; this is only a sanity limit. */
export const MAX_ROWS = 160;

import { type ChartSpec, parseSpec } from "../charts/spec.ts";

export const WIN_IDS = [
  "signals",
  "map",
  "graph",
  "math",
  "assistant",
  "grid",
  "reproduce",
  "notebook",
  "coverage",
  "timeline",
  "answer",
  "history",
] as const;
export type WinId = (typeof WIN_IDS)[number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface WinState extends Rect {
  open: boolean;
}
/** A chart window: its place on the grid and what it shows (serialisable, so it survives a reload). */
export type ChartWin = WinState & ChartSpec;
/** A further window of a kind that already has one: windows are not single boxes, any kind can be added as often as the grid allows. */
export type CopyWin = WinState & { kind: WinId };
export interface Layout {
  wins: Record<WinId, WinState>;
  /** The extra windows of a kind, by id (`win:<kind>:<n>`); closing one removes it. */
  copies: Record<string, CopyWin>;
  /** The chart windows the researcher added, by id (`chart:<n>`); closing one removes it. */
  charts: Record<string, ChartWin>;
  /** Back to front: the last one is on top; chart ids included. */
  order: string[];
}

export const CHART_PREFIX = "chart:";
export const isChartId = (id: string) => id.startsWith(CHART_PREFIX);
/** Every window id, the fixed ones first, then the charts in the order they were added. */
export const COPY_PREFIX = "win:";
export const isCopyId = (id: string) => id.startsWith(COPY_PREFIX);
export const allIds = (l: Layout): string[] => [...WIN_IDS, ...Object.keys(l.copies), ...Object.keys(l.charts)];
/** The kind of any window: a copy's kind, the id itself for the fixed windows, null for a chart. */
export const kindOf = (l: Layout, id: string): WinId | null =>
  isCopyId(id) ? (l.copies[id]?.kind ?? null) : isChartId(id) ? null : (id as WinId);
/** The place of any window; a chart's record also carries its spec. */
export const winOf = (l: Layout, id: string): WinState =>
  isChartId(id) ? (l.charts[id] as ChartWin) : isCopyId(id) ? (l.copies[id] as CopyWin) : l.wins[id as WinId];

/** Smallest size of each window, in columns and rows. */
export const MIN_SIZE: Record<WinId, { w: number; h: number }> = {
  signals: { w: 3, h: 8 },
  map: { w: 3, h: 8 },
  graph: { w: 3, h: 7 },
  math: { w: 3, h: 6 },
  assistant: { w: 3, h: 5 },
  grid: { w: 4, h: 8 },
  reproduce: { w: 5, h: 14 },
  notebook: { w: 3, h: 10 },
  coverage: { w: 4, h: 12 },
  timeline: { w: 4, h: 9 },
  answer: { w: 4, h: 7 },
  history: { w: 3, h: 8 },
};

export const CHART_MIN_SIZE = { w: 4, h: 10 };
const minSize = (id: string) =>
  isChartId(id) ? CHART_MIN_SIZE : isCopyId(id) ? MIN_SIZE[(id.split(":")[1] ?? "signals") as WinId] : MIN_SIZE[id as WinId];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps a rectangle at least its minimum size and inside the board. */
export function clampRect(r: Rect, id: string, rows: number): Rect {
  const min = minSize(id);
  const w = clamp(Math.round(r.w), Math.min(min.w, COLS), COLS);
  const h = clamp(Math.round(r.h), Math.min(min.h, rows), Math.max(rows, 1));
  return { w, h, x: clamp(Math.round(r.x), 0, COLS - w), y: clamp(Math.round(r.y), 0, Math.max(0, rows - h)) };
}

/**
 * Generous natural heights (the page may scroll): the Signals window large on the left (a selected row opens
 * the signal card as a layer inside it, signals-redesign.md), the map in the middle, the unit graph on the
 * right. The card's own window and the assistant stay available from the tray as pop-outs, closed by default;
 * the unit grid and Reproduce wait there too. The notebook is open in the centre, beside Signals.
 */
export function defaultLayout(): Layout {
  return withTimeline(baseLayout());
}

/** Rows of the timeline window every project starts with, across the top of the board. */
export const TIMELINE_ROWS = 11;

/**
 * Opens the timeline across the top of the board and moves every other open window down below it. `bottom` puts it
 * under the other windows instead (a screen whose first job is another window), `none` leaves it closed.
 */
export function withTimeline(layout: Layout, place: "top" | "bottom" | "none" = "top"): Layout {
  const wins = { ...layout.wins };
  const withShift = (copies: Layout["copies"]) =>
    Object.fromEntries(Object.entries(copies).map(([id, c]) => [id, c.open ? { ...c, y: c.y + TIMELINE_ROWS } : c]));
  if (place !== "top") {
    const bottom = Math.max(
      0,
      ...WIN_IDS.filter((id) => id !== "timeline" && wins[id].open).map((id) => (wins[id] as WinState).y + (wins[id] as WinState).h),
    );
    wins.timeline = { x: 0, y: bottom, w: COLS, h: TIMELINE_ROWS, open: place === "bottom" };
    return { ...layout, wins };
  }
  // A summary window stays first: the answer is read before the timeline that shows where it came from.
  const summary = wins.answer.open ? wins.answer : null;
  for (const id of WIN_IDS)
    if (id !== "timeline" && id !== "answer" && wins[id].open) wins[id] = { ...wins[id], y: wins[id].y + TIMELINE_ROWS };
  if (summary) {
    wins.timeline = { x: 0, y: summary.y + summary.h, w: COLS, h: TIMELINE_ROWS, open: true };
    return { ...layout, wins, copies: withShift(layout.copies) };
  }
  const copies = withShift(layout.copies);
  wins.timeline = { x: 0, y: 0, w: COLS, h: TIMELINE_ROWS, open: true };
  return { ...layout, wins, copies };
}

/** The arrangement without the timeline: the starting point of the default and the presets. */
export function baseLayout(): Layout {
  const wins: Record<WinId, WinState> = {
    signals: { x: 0, y: 0, w: 4, h: 40, open: true },
    // The notebook in the centre, as tall as Signals: the page the researcher works on, visible from the start.
    notebook: { x: 4, y: 0, w: 5, h: 40, open: true },
    map: { x: 9, y: 0, w: 3, h: 20, open: true },
    graph: { x: 9, y: 20, w: 3, h: 20, open: true },
    math: { x: 9, y: 22, w: 3, h: 14, open: false },
    assistant: { x: 9, y: 36, w: 3, h: 8, open: false },
    grid: { x: 0, y: 0, w: 12, h: 30, open: false },
    reproduce: { x: 4, y: 0, w: 5, h: 14, open: false },
    // The doctor's patient coverage: an ordinary window, closed until opened from the Windows menu or a template.
    coverage: { x: 0, y: 0, w: 6, h: 30, open: false },
    // Past signals: the record before this month, closed until asked for.
    history: { x: 0, y: 40, w: 4, h: 24, open: false },
    // The replay timeline: a window of the project, opened by the templates and from the Windows menu.
    timeline: { x: 0, y: 0, w: 12, h: 11, open: false },
    // The one-sentence summary: closed by default, opened first in the templates and demo files.
    answer: { x: 0, y: 0, w: 12, h: 9, open: false },
  };
  return {
    wins,
    copies: {},
    charts: {},
    order: ["signals", "map", "graph", "math", "assistant", "grid", "reproduce", "notebook", "coverage", "timeline", "answer", "history"],
  };
}

export type Preset = "default" | "map" | "signals" | "units" | "analysis";

/** Ready-made arrangements, one click each; the same grid as the default. */
export function presetLayout(preset: Preset): Layout {
  const d = baseLayout();
  const w = (patch: Partial<Record<WinId, Partial<WinState>>>): Layout => {
    const wins = { ...d.wins };
    for (const id of WIN_IDS) if (patch[id]) wins[id] = { ...wins[id], ...patch[id] };
    return withTimeline({ wins, copies: {}, charts: {}, order: d.order });
  };
  switch (preset) {
    case "map":
      return w({
        notebook: { open: false },
        map: { x: 0, y: 0, w: 8, h: 40, open: true },
        signals: { x: 8, y: 0, w: 4, h: 40, open: true },
        graph: { x: 8, y: 40, w: 4, h: 12, open: false },
      });
    case "signals":
      return w({
        notebook: { open: false },
        signals: { x: 0, y: 0, w: 7, h: 40, open: true },
        map: { x: 7, y: 0, w: 5, h: 24, open: true },
        graph: { x: 7, y: 24, w: 5, h: 16, open: true },
      });
    case "units":
      return w({
        grid: { x: 0, y: 0, w: 12, h: 26, open: true },
        signals: { x: 0, y: 26, w: 6, h: 24, open: true },
        graph: { x: 6, y: 26, w: 6, h: 18, open: true },
        map: { open: false },
        notebook: { open: false },
      });
    case "analysis":
      return w({
        // The tools are on the rail (it opens with this layout); the notebook beside the list, the card and the flow under it.
        signals: { x: 0, y: 0, w: 4, h: 40, open: true },
        notebook: { x: 4, y: 0, w: 8, h: 32, open: true },
        math: { x: 4, y: 32, w: 8, h: 18, open: true },
        graph: { x: 4, y: 50, w: 8, h: 22, open: true },
        map: { open: false },
        assistant: { open: false },
      });
    default:
      return withTimeline(d);
  }
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Room beside the window just moved or sized: an open window it overlaps gives up the overlapped columns on
 * the side it is on, when what is left is still at least its minimum width. A window that cannot narrow far
 * enough is left as it is, and compaction pushes it below. This is what lets a window be dropped between two
 * others.
 */
export function makeRoom(layout: Layout, moved?: string): Layout {
  if (!moved || !winOf(layout, moved)?.open) return layout;
  const m = winOf(layout, moved);
  let next = layout;
  for (const id of allIds(layout)) {
    if (id === moved) continue;
    const o = winOf(next, id);
    if (!o.open || !overlaps(o, m)) continue;
    const min = minSize(id).w;
    const leftW = m.x - o.x; // what stays if it keeps its left part
    const rightW = o.x + o.w - (m.x + m.w); // what stays if it keeps its right part
    const keepLeft = leftW >= min && (leftW >= rightW || rightW < min);
    if (keepLeft) next = setWin(next, id, { ...o, w: leftW });
    else if (rightW >= min) next = setWin(next, id, { ...o, x: m.x + m.w, w: rightW });
  }
  return next;
}

/**
 * Vertical compaction, as in a dashboard grid. Open windows are taken in order of their top edge (then left
 * edge; the window being moved or resized wins a tie) and each floats up while the row above is free, then
 * is pushed down past anything it overlaps. No overlaps remain and no gap that a window could rise into.
 * Closed windows keep their rectangle and are left out.
 */
export function compactLayout(layout: Layout, moved?: string): Layout {
  layout = makeRoom(layout, moved);
  const ids = allIds(layout);
  const open = ids
    .filter((id) => winOf(layout, id).open)
    .sort(
      (a, b) =>
        winOf(layout, a).y - winOf(layout, b).y ||
        (a === moved ? -1 : b === moved ? 1 : 0) ||
        winOf(layout, a).x - winOf(layout, b).x ||
        ids.indexOf(a) - ids.indexOf(b),
    );
  const placed: Rect[] = [];
  let next = layout;
  for (const id of open) {
    const w = winOf(layout, id);
    const r: Rect = { x: w.x, y: Math.max(0, w.y), w: w.w, h: w.h };
    const blocked = (y: number) => placed.some((p) => overlaps({ ...r, y }, p));
    while (r.y > 0 && !blocked(r.y - 1)) r.y--;
    while (blocked(r.y)) r.y++;
    placed.push(r);
    next = setWin(next, id, { ...w, y: r.y });
  }
  return next;
}

/**
 * Neighbours take the empty columns: every open window (except the one just moved or sized, which keeps the
 * size the researcher gave it) grows sideways into free columns on its rows until it meets another window or
 * the board's edge. Rows are untouched, so the reading order stays what the researcher laid out.
 */
export function fillLayout(layout: Layout, moved?: string): Layout {
  const open = allIds(layout).filter((id) => winOf(layout, id).open);
  let next = layout;
  // Left to right, so a window on the left fills first and the one on the right takes what remains.
  for (const id of [...open].sort((a, b) => winOf(next, a).x - winOf(next, b).x)) {
    if (id === moved) continue;
    const w = winOf(next, id);
    const sameRows = open
      .filter((o) => o !== id)
      .map((o) => winOf(next, o))
      .filter((o) => o.y < w.y + w.h && w.y < o.y + o.h);
    const right = Math.min(COLS, ...sameRows.filter((o) => o.x >= w.x + w.w).map((o) => o.x));
    const left = Math.max(0, ...sameRows.filter((o) => o.x + o.w <= w.x).map((o) => o.x + o.w));
    if (left !== w.x || right - left !== w.w) next = setWin(next, id, { ...w, x: left, w: right - left });
  }
  return next;
}

/** The layout as it must be drawn: every window inside the board. */
export function fitLayout(layout: Layout): Layout {
  let next = layout;
  for (const id of allIds(layout)) {
    const w = winOf(layout, id);
    next = setWin(next, id, { ...w, ...clampRect(w, id, MAX_ROWS) });
  }
  return next;
}

/** Rows the board needs: the lowest open window's bottom edge. */
export function boardRows(layout: Layout): number {
  return Math.max(
    12,
    ...allIds(layout)
      .filter((id) => winOf(layout, id).open)
      .map((id) => winOf(layout, id).y + winOf(layout, id).h),
  );
}

export const FOCUS_KEY = "aei.research.focus";

/**
 * Focus mode: one window takes the whole board width and at least `rows` rows (the viewport's height);
 * the others are taken off the board. Derived from the user's layout, which is left untouched, so leaving
 * focus restores it exactly.
 */
export function focusLayout(layout: Layout, id: string, rows: number): Layout {
  let next = layout;
  for (const w of allIds(layout)) if (w !== id) next = setWin(next, w, { ...winOf(next, w), open: false });
  const own = winOf(next, id);
  next = setWin(next, id, { ...own, x: 0, y: 0, w: COLS, h: Math.max(own.h, rows, minSize(id).h), open: true });
  return { ...next, order: raise(layout, id).order };
}

const isWinId = (v: unknown): v is WinId => typeof v === "string" && WIN_IDS.includes(v as WinId);

export function loadFocus(): WinId | null {
  try {
    const v = localStorage.getItem(FOCUS_KEY);
    return isWinId(v) ? v : null;
  } catch {
    return null;
  }
}

/** Only the fixed windows are remembered: a chart's id is not kept across a reload. */
export function saveFocus(id: string | null): void {
  try {
    if (id === null || !isWinId(id)) localStorage.removeItem(FOCUS_KEY);
    else localStorage.setItem(FOCUS_KEY, id);
  } catch {
    // Private mode or blocked storage: focus simply does not persist.
  }
}

export function raise(layout: Layout, id: string): Layout {
  if (layout.order[layout.order.length - 1] === id) return layout;
  return { ...layout, order: [...layout.order.filter((x) => x !== id), id] };
}

function setWin(layout: Layout, id: string, w: WinState): Layout {
  if (isCopyId(id)) return { ...layout, copies: { ...layout.copies, [id]: { ...(layout.copies[id] as CopyWin), ...w } } };
  return isChartId(id)
    ? { ...layout, charts: { ...layout.charts, [id]: { ...(layout.charts[id] as ChartWin), ...w } } }
    : { ...layout, wins: { ...layout.wins, [id]: w } };
}

export function patchWin(layout: Layout, id: string, patch: Partial<WinState>): Layout {
  return setWin(layout, id, { ...winOf(layout, id), ...patch });
}

/** Adds a chart window under everything else (compaction floats it up into a gap) and raises it. */
export function addChart(layout: Layout, spec: ChartSpec): { layout: Layout; id: string } {
  const n = Math.max(0, ...Object.keys(layout.charts).map((k) => Number(k.slice(CHART_PREFIX.length)) || 0)) + 1;
  const id = `${CHART_PREFIX}${n}`;
  const count = Object.keys(layout.charts).length;
  const win: ChartWin = { ...spec, x: (count % 2) * 6, y: boardRows(layout), w: 6, h: 16, open: true };
  return { layout: raise({ ...layout, charts: { ...layout.charts, [id]: win }, order: [...layout.order, id] }, id), id };
}

/** A new window's size when the researcher does not draw one: columns and rows. */
export const DEFAULT_SIZE: Record<WinId, { w: number; h: number }> = {
  signals: { w: 4, h: 30 },
  notebook: { w: 5, h: 30 },
  map: { w: 4, h: 20 },
  graph: { w: 4, h: 20 },
  math: { w: 4, h: 16 },
  assistant: { w: 4, h: 10 },
  grid: { w: 6, h: 24 },
  reproduce: { w: 5, h: 14 },
  coverage: { w: 6, h: 24 },
  timeline: { w: COLS, h: TIMELINE_ROWS },
  answer: { w: COLS, h: 9 },
  history: { w: 4, h: 24 },
};

/**
 * Adds a window of `kind` at `at` (a free cell, or the default place). The first window of a kind is the fixed one,
 * opened where asked; a kind that is already open gets a copy, so the same kind can sit on the board as often as wanted.
 */
export function addWindow(layout: Layout, kind: WinId, at?: Partial<Rect>): { layout: Layout; id: string } {
  const size = DEFAULT_SIZE[kind];
  const min = MIN_SIZE[kind];
  const w = clamp(Math.round(at?.w ?? size.w), min.w, COLS);
  const h = Math.max(min.h, Math.round(at?.h ?? size.h));
  const rect = { x: clamp(Math.round(at?.x ?? 0), 0, COLS - w), y: Math.max(0, Math.round(at?.y ?? boardRows(layout))), w, h };
  if (!layout.wins[kind].open) {
    const next = patchWin(layout, kind, { ...rect, open: true });
    return { layout: raise(next, kind), id: kind };
  }
  const n =
    Math.max(
      0,
      ...Object.keys(layout.copies)
        .filter((k) => k.startsWith(`${COPY_PREFIX}${kind}:`))
        .map((k) => Number(k.split(":")[2]) || 0),
    ) + 1;
  const id = `${COPY_PREFIX}${kind}:${n}`;
  const next: Layout = { ...layout, copies: { ...layout.copies, [id]: { ...rect, open: true, kind } }, order: [...layout.order, id] };
  return { layout: raise(next, id), id };
}

/**
 * Puts a new window of `kind` between two windows that touch. Side by side (`axis` "x", `a` on the left): both give up
 * columns (as evenly as their minimum sizes allow) and the new window takes the band between them on the rows they share.
 * One above the other (`axis` "y"): the new window takes `b`'s place and `b` is pushed down by the next compaction.
 * Null when there is no room to make the new window its minimum size.
 */
export function insertBetween(layout: Layout, kind: WinId, a: string, b: string, axis: "x" | "y"): { layout: Layout; id: string } | null {
  const A = winOf(layout, a);
  const B = winOf(layout, b);
  const min = MIN_SIZE[kind];
  if (axis === "y") {
    const x = Math.max(A.x, B.x);
    const w = Math.min(A.x + A.w, B.x + B.w) - x;
    return w < min.w ? null : addWindow(layout, kind, { x, y: B.y, w, h: Math.max(min.h, DEFAULT_SIZE[kind].h) });
  }
  const roomA = A.w - minSize(a).w;
  const roomB = B.w - minSize(b).w;
  const w = Math.min(Math.max(min.w, 4), roomA + roomB);
  if (w < min.w) return null;
  let fromA = Math.min(roomA, Math.ceil(w / 2));
  let fromB = w - fromA;
  if (fromB > roomB) {
    fromB = roomB;
    fromA = w - fromB;
  }
  const y = Math.max(A.y, B.y);
  const h = Math.max(min.h, Math.min(A.y + A.h, B.y + B.h) - y);
  const x = A.x + A.w - fromA;
  let next = patchWin(layout, a, { w: A.w - fromA });
  next = patchWin(next, b, { x: x + w, w: B.w - fromB });
  return addWindow(next, kind, { x, y, w, h });
}

/** Closing a copy removes it. */
export function removeCopy(layout: Layout, id: string): Layout {
  const { [id]: _gone, ...copies } = layout.copies;
  return { ...layout, copies, order: layout.order.filter((x) => x !== id) };
}

/** Closing a chart removes it. */
export function removeChart(layout: Layout, id: string): Layout {
  const { [id]: _gone, ...charts } = layout.charts;
  return { ...layout, charts, order: layout.order.filter((x) => x !== id) };
}

/** The chart windows (and their stacking) of `from`, carried over onto another arrangement of the fixed windows. */
export function withCharts(layout: Layout, from: Layout): Layout {
  const mine = (id: string) => !isChartId(id) && !isCopyId(id);
  return {
    ...layout,
    charts: from.charts,
    copies: from.copies,
    order: [...layout.order.filter(mine), ...from.order.filter((id) => !mine(id))],
  };
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Reads the saved layout; anything malformed gives null (the default is used). */
export function parseLayout(raw: string | null): Layout | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as {
      v?: number;
      wins?: Record<string, Partial<WinState>>;
      charts?: Record<string, Partial<WinState> & Record<string, unknown>>;
      copies?: Record<string, Partial<WinState> & { kind?: unknown }>;
      order?: unknown;
    };
    // v3 (2026-10-17): the notebook took the centre column; earlier layouts (v1 card window, v2 notebook below the fold) start over.
    if (v.v !== 3 || !v.wins || !Array.isArray(v.order)) return null;
    const wins = {} as Record<WinId, WinState>;
    const fallback = defaultLayout().wins;
    for (const id of WIN_IDS) {
      // A window added after the layout was saved (the notebook) takes its default place.
      const w = v.wins[id] ?? fallback[id];
      if (!w || !isInt(w.x) || !isInt(w.y) || !isInt(w.w) || !isInt(w.h) || typeof w.open !== "boolean") return null;
      wins[id] = { x: w.x, y: w.y, w: w.w, h: w.h, open: w.open };
    }
    // Layouts saved before chart windows have no `charts`; a malformed chart is dropped, the rest stays.
    const charts: Record<string, ChartWin> = {};
    for (const [id, c] of Object.entries(v.charts ?? {})) {
      const spec = parseSpec(c);
      if (!isChartId(id) || !spec || !c || !isInt(c.x) || !isInt(c.y) || !isInt(c.w) || !isInt(c.h) || typeof c.open !== "boolean")
        continue;
      charts[id] = { ...spec, x: c.x, y: c.y, w: c.w, h: c.h, open: c.open };
    }
    // Extra windows of a kind: a malformed one is dropped, the rest stays.
    const copies: Record<string, CopyWin> = {};
    for (const [id, c] of Object.entries(v.copies ?? {})) {
      if (
        !isCopyId(id) ||
        !c ||
        !isWinId(c.kind) ||
        !isInt(c.x) ||
        !isInt(c.y) ||
        !isInt(c.w) ||
        !isInt(c.h) ||
        typeof c.open !== "boolean"
      )
        continue;
      copies[id] = { kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h, open: c.open };
    }
    const known = (x: string) => WIN_IDS.includes(x as WinId) || x in charts || x in copies;
    const order = (v.order as unknown[]).filter((x): x is string => typeof x === "string" && known(x));
    for (const id of [...WIN_IDS, ...Object.keys(copies), ...Object.keys(charts)]) if (!order.includes(id)) order.push(id);
    return compactLayout(fitLayout({ wins, copies, charts, order: [...new Set(order)] }));
  } catch {
    return null;
  }
}

export function loadLayout(): Layout | null {
  try {
    return parseLayout(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** The layout as the JSON a project stores (the same shape as the browser's saved layout). */
export function serializeLayout(layout: Layout): string {
  return JSON.stringify({ v: 3, ...layout });
}

export function saveLayout(layout: Layout | null): void {
  try {
    if (layout === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, ...layout }));
  } catch {
    // Private mode or blocked storage: the layout simply does not persist.
  }
}
