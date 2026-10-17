// The window workspace's geometry: a 12-column grid with rows of 24 px.
// Everything here is pure (no DOM), so snapping, clamping and persistence
// can be tested and the default layout always fits the board it is given.

export const COLS = 12;
export const ROW_PX = 24;
export const STORAGE_KEY = "aei.research.layout";
/** The board grows downward as windows move down; this is only a sanity limit. */
export const MAX_ROWS = 160;

import { type ChartSpec, parseSpec } from "../charts/spec.ts";

export const WIN_IDS = ["signals", "map", "graph", "math", "assistant", "grid", "reproduce"] as const;
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
export interface Layout {
  wins: Record<WinId, WinState>;
  /** The chart windows the researcher added, by id (`chart:<n>`); closing one removes it. */
  charts: Record<string, ChartWin>;
  /** Back to front: the last one is on top; chart ids included. */
  order: string[];
}

export const CHART_PREFIX = "chart:";
export const isChartId = (id: string) => id.startsWith(CHART_PREFIX);
/** Every window id, the fixed ones first, then the charts in the order they were added. */
export const allIds = (l: Layout): string[] => [...WIN_IDS, ...Object.keys(l.charts)];
/** The place of any window; a chart's record also carries its spec. */
export const winOf = (l: Layout, id: string): WinState => (isChartId(id) ? (l.charts[id] as ChartWin) : l.wins[id as WinId]);

/** Smallest size of each window, in columns and rows. */
export const MIN_SIZE: Record<WinId, { w: number; h: number }> = {
  signals: { w: 3, h: 8 },
  map: { w: 3, h: 8 },
  graph: { w: 3, h: 7 },
  math: { w: 3, h: 6 },
  assistant: { w: 3, h: 5 },
  grid: { w: 4, h: 8 },
  reproduce: { w: 5, h: 14 },
};

export const CHART_MIN_SIZE = { w: 4, h: 10 };
const minSize = (id: string) => (isChartId(id) ? CHART_MIN_SIZE : MIN_SIZE[id as WinId]);

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
 * the unit grid, the notebook and the tools wait there too.
 */
export function defaultLayout(): Layout {
  const wins: Record<WinId, WinState> = {
    signals: { x: 0, y: 0, w: 5, h: 40, open: true },
    map: { x: 5, y: 0, w: 4, h: 40, open: true },
    graph: { x: 9, y: 0, w: 3, h: 22, open: true },
    math: { x: 9, y: 22, w: 3, h: 14, open: false },
    assistant: { x: 9, y: 36, w: 3, h: 8, open: false },
    grid: { x: 0, y: 0, w: 12, h: 30, open: false },
    reproduce: { x: 4, y: 0, w: 5, h: 14, open: false },
  };
  return { wins, charts: {}, order: ["signals", "map", "graph", "math", "assistant", "grid", "reproduce"] };
}

export type Preset = "default" | "map" | "signals" | "units" | "analysis";

/** Ready-made arrangements, one click each; the same grid as the default. */
export function presetLayout(preset: Preset): Layout {
  const d = defaultLayout();
  const w = (patch: Partial<Record<WinId, Partial<WinState>>>): Layout => {
    const wins = { ...d.wins };
    for (const id of WIN_IDS) if (patch[id]) wins[id] = { ...wins[id], ...patch[id] };
    return { wins, charts: {}, order: d.order };
  };
  switch (preset) {
    case "map":
      return w({
        map: { x: 0, y: 0, w: 8, h: 40, open: true },
        signals: { x: 8, y: 0, w: 4, h: 40, open: true },
        graph: { x: 8, y: 40, w: 4, h: 12, open: false },
      });
    case "signals":
      return w({
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
      });
    case "analysis":
      return w({
        // The tools are on the rail (it opens with this layout); the signal card beside the list, the flow under it.
        signals: { x: 0, y: 0, w: 4, h: 40, open: true },
        math: { x: 4, y: 0, w: 8, h: 18, open: true },
        graph: { x: 4, y: 18, w: 8, h: 22, open: true },
        map: { open: false },
        assistant: { open: false },
      });
    default:
      return d;
  }
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Vertical compaction, as in a dashboard grid. Open windows are taken in order of their top edge (then left
 * edge; the window being moved or resized wins a tie) and each floats up while the row above is free, then
 * is pushed down past anything it overlaps. No overlaps remain and no gap that a window could rise into.
 * Closed windows keep their rectangle and are left out.
 */
export function compactLayout(layout: Layout, moved?: string): Layout {
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

/** Closing a chart removes it. */
export function removeChart(layout: Layout, id: string): Layout {
  const { [id]: _gone, ...charts } = layout.charts;
  return { ...layout, charts, order: layout.order.filter((x) => x !== id) };
}

/** The chart windows (and their stacking) of `from`, carried over onto another arrangement of the fixed windows. */
export function withCharts(layout: Layout, from: Layout): Layout {
  return { ...layout, charts: from.charts, order: [...layout.order.filter((id) => !isChartId(id)), ...from.order.filter(isChartId)] };
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
      order?: unknown;
    };
    // v2 (2026-10-17): the card moved into the Signals window; layouts saved with it open as a window start over.
    if (v.v !== 2 || !v.wins || !Array.isArray(v.order)) return null;
    const wins = {} as Record<WinId, WinState>;
    for (const id of WIN_IDS) {
      const w = v.wins[id];
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
    const order = (v.order as unknown[]).filter((x): x is string => typeof x === "string" && (WIN_IDS.includes(x as WinId) || x in charts));
    for (const id of [...WIN_IDS, ...Object.keys(charts)]) if (!order.includes(id)) order.push(id);
    return compactLayout(fitLayout({ wins, charts, order: [...new Set(order)] }));
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

export function saveLayout(layout: Layout | null): void {
  try {
    if (layout === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, ...layout }));
  } catch {
    // Private mode or blocked storage: the layout simply does not persist.
  }
}
