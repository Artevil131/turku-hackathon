// The window workspace's geometry: a 12-column grid with rows of 24 px.
// Everything here is pure (no DOM), so snapping, clamping and persistence
// can be tested and the default layout always fits the board it is given.

export const COLS = 12;
export const ROW_PX = 24;
export const STORAGE_KEY = "aei.research.layout";
/** The board grows downward as windows move down; this is only a sanity limit. */
export const MAX_ROWS = 160;

export const WIN_IDS = ["signals", "map", "graph", "math", "assistant", "grid"] as const;
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
export interface Layout {
  wins: Record<WinId, WinState>;
  /** Back to front: the last one is on top. */
  order: WinId[];
}

/** Smallest size of each window, in columns and rows. */
export const MIN_SIZE: Record<WinId, { w: number; h: number }> = {
  signals: { w: 3, h: 8 },
  map: { w: 3, h: 8 },
  graph: { w: 3, h: 7 },
  math: { w: 3, h: 6 },
  assistant: { w: 3, h: 5 },
  grid: { w: 4, h: 8 },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps a rectangle at least its minimum size and inside the board. */
export function clampRect(r: Rect, id: WinId, rows: number): Rect {
  const min = MIN_SIZE[id];
  const w = clamp(Math.round(r.w), Math.min(min.w, COLS), COLS);
  const h = clamp(Math.round(r.h), Math.min(min.h, rows), Math.max(rows, 1));
  return { w, h, x: clamp(Math.round(r.x), 0, COLS - w), y: clamp(Math.round(r.y), 0, Math.max(0, rows - h)) };
}

/**
 * Generous natural heights (the page may scroll): signals left, the map large in the middle, the unit graph,
 * alert math and the assistant stacked on the right; the unit grid waits in the tray.
 */
export function defaultLayout(): Layout {
  const wins: Record<WinId, WinState> = {
    signals: { x: 0, y: 0, w: 3, h: 40, open: true },
    map: { x: 3, y: 0, w: 4, h: 40, open: true },
    graph: { x: 7, y: 0, w: 5, h: 18, open: true },
    math: { x: 7, y: 18, w: 5, h: 14, open: true },
    assistant: { x: 7, y: 32, w: 5, h: 8, open: true },
    grid: { x: 0, y: 0, w: 12, h: 30, open: false },
  };
  return { wins, order: ["signals", "map", "graph", "math", "assistant", "grid"] };
}

export type Preset = "default" | "map" | "signals" | "units";

/** Ready-made arrangements, one click each; the same grid as the default. */
export function presetLayout(preset: Preset): Layout {
  const d = defaultLayout();
  const w = (patch: Partial<Record<WinId, Partial<WinState>>>): Layout => {
    const wins = { ...d.wins };
    for (const id of WIN_IDS) if (patch[id]) wins[id] = { ...wins[id], ...patch[id] };
    return { wins, order: d.order };
  };
  switch (preset) {
    case "map":
      return w({
        map: { x: 0, y: 0, w: 8, h: 40, open: true },
        signals: { x: 8, y: 0, w: 4, h: 18, open: true },
        math: { x: 8, y: 18, w: 4, h: 14, open: true },
        assistant: { x: 8, y: 32, w: 4, h: 8, open: true },
        graph: { x: 8, y: 40, w: 4, h: 12, open: false },
      });
    case "signals":
      return w({
        signals: { x: 0, y: 0, w: 6, h: 40, open: true },
        math: { x: 6, y: 0, w: 6, h: 16, open: true },
        map: { x: 6, y: 16, w: 6, h: 24, open: true },
        graph: { open: false },
        assistant: { open: false },
      });
    case "units":
      return w({
        grid: { x: 0, y: 0, w: 12, h: 26, open: true },
        signals: { x: 0, y: 26, w: 4, h: 18, open: true },
        math: { x: 4, y: 26, w: 4, h: 14, open: true },
        graph: { x: 8, y: 26, w: 4, h: 18, open: true },
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
export function compactLayout(layout: Layout, moved?: WinId): Layout {
  const open = WIN_IDS.filter((id) => layout.wins[id].open).sort(
    (a, b) =>
      layout.wins[a].y - layout.wins[b].y ||
      (a === moved ? -1 : b === moved ? 1 : 0) ||
      layout.wins[a].x - layout.wins[b].x ||
      WIN_IDS.indexOf(a) - WIN_IDS.indexOf(b),
  );
  const placed: Rect[] = [];
  const wins = { ...layout.wins };
  for (const id of open) {
    const w = layout.wins[id];
    const r: Rect = { x: w.x, y: Math.max(0, w.y), w: w.w, h: w.h };
    const blocked = (y: number) => placed.some((p) => overlaps({ ...r, y }, p));
    while (r.y > 0 && !blocked(r.y - 1)) r.y--;
    while (blocked(r.y)) r.y++;
    placed.push(r);
    wins[id] = { ...w, y: r.y };
  }
  return { wins, order: layout.order };
}

/** The layout as it must be drawn: every window inside the board. */
export function fitLayout(layout: Layout): Layout {
  const wins = { ...layout.wins };
  for (const id of WIN_IDS) wins[id] = { ...wins[id], ...clampRect(wins[id], id, MAX_ROWS) };
  return { wins, order: layout.order };
}

/** Rows the board needs: the lowest open window's bottom edge. */
export function boardRows(layout: Layout): number {
  return Math.max(12, ...WIN_IDS.filter((id) => layout.wins[id].open).map((id) => layout.wins[id].y + layout.wins[id].h));
}

export function raise(layout: Layout, id: WinId): Layout {
  if (layout.order[layout.order.length - 1] === id) return layout;
  return { ...layout, order: [...layout.order.filter((x) => x !== id), id] };
}

export function patchWin(layout: Layout, id: WinId, patch: Partial<WinState>): Layout {
  return { ...layout, wins: { ...layout.wins, [id]: { ...layout.wins[id], ...patch } } };
}

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** Reads the saved layout; anything malformed gives null (the default is used). */
export function parseLayout(raw: string | null): Layout | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { v?: number; wins?: Record<string, Partial<WinState>>; order?: unknown };
    if (v.v !== 1 || !v.wins || !Array.isArray(v.order)) return null;
    const wins = {} as Record<WinId, WinState>;
    for (const id of WIN_IDS) {
      const w = v.wins[id];
      if (!w || !isInt(w.x) || !isInt(w.y) || !isInt(w.w) || !isInt(w.h) || typeof w.open !== "boolean") return null;
      wins[id] = { x: w.x, y: w.y, w: w.w, h: w.h, open: w.open };
    }
    const order = (v.order as unknown[]).filter((x): x is WinId => WIN_IDS.includes(x as WinId));
    for (const id of WIN_IDS) if (!order.includes(id)) order.push(id);
    return compactLayout(fitLayout({ wins, order: [...new Set(order)] }));
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
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...layout }));
  } catch {
    // Private mode or blocked storage: the layout simply does not persist.
  }
}
