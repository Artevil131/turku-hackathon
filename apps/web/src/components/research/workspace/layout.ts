// Dock geometry only: ordered stacks, fractional sizes and a tray. No DOM or storage access.
export const STORAGE_KEY = "aei.research.layout.v2";
export const WIN_IDS = ["signals", "map", "graph", "math", "assistant", "grid", "reproduce"] as const;
export type WinId = (typeof WIN_IDS)[number];
export type Preset = "default" | "map" | "signals" | "units";
export interface DockWindow {
  id: WinId;
  size: number;
}
export interface Column {
  id: string;
  width: number;
  windows: DockWindow[];
}
export interface Home {
  column: string;
  columnIndex: number;
  index: number;
  size: number;
  /** Set when closing emptied the column: its width, for recreating it on reopen. */
  width?: number;
}
export interface Layout {
  columns: Column[];
  closed: Partial<Record<WinId, Home>>;
  maximized: WinId | null;
}
/** Indices refer to the current layout, before removing the moving window. */
export interface Slot {
  column: number;
  index: number;
  newColumn?: boolean;
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isWin = (id: unknown): id is WinId => WIN_IDS.includes(id as WinId);

/** Normalise fractions with a floor, including untrusted saved sizes. */
export function fractions(values: number[], minimum = 0.16): number[] {
  if (!values.length) return [];
  const min = clamp(minimum, 0, 1 / values.length);
  const weights = values.map((n) => (finite(n) && n > 0 ? n : 1));
  const scale = Math.max(1, ...weights);
  for (let i = 0; i < weights.length; i++) weights[i] = (weights[i] as number) / scale;
  const result = weights.map(() => 0);
  let remaining = 1;
  let active = weights.map((_, i) => i);
  while (active.length) {
    const total = active.reduce((s, i) => s + (weights[i] as number), 0);
    const small = active.filter((i) => (remaining * (weights[i] as number)) / total < min);
    if (!small.length) {
      for (const i of active) result[i] = (remaining * (weights[i] as number)) / total;
      break;
    }
    for (const i of small) result[i] = min;
    remaining -= min * small.length;
    active = active.filter((i) => !small.includes(i));
  }
  return result;
}

/**
 * A column with no windows is never kept: the others share its width in
 * proportion to their own (via clampLayout), and closed homes that pointed at a
 * dropped column further right shift left, so reopening still lands between
 * the same neighbours.
 */
function pruneColumns(layout: Layout): Layout {
  const removed = layout.columns.flatMap((c, i) => (c.windows.length ? [] : [i]));
  if (!removed.length) return layout;
  const columns = layout.columns.filter((c) => c.windows.length);
  const present = new Set(columns.map((c) => c.id));
  const closed: Layout["closed"] = {};
  for (const [id, home] of Object.entries(layout.closed) as [WinId, Home][]) {
    const shift = present.has(home.column) ? 0 : removed.filter((k) => k < home.columnIndex).length;
    closed[id] = shift ? { ...home, columnIndex: home.columnIndex - shift } : home;
  }
  return { ...layout, columns, closed };
}

export function clampLayout(input: Layout): Layout {
  const layout = pruneColumns(input);
  const widths = fractions(
    layout.columns.map((c) => c.width),
    0.18,
  );
  return {
    ...layout,
    columns: layout.columns.map((c, i) => {
      const sizes = fractions(c.windows.map((w) => w.size));
      return { ...c, width: widths[i] as number, windows: c.windows.map((w, j) => ({ ...w, size: sizes[j] as number })) };
    }),
  };
}

/**
 * The smallest body, in px, at which each window still shows something useful
 * (the map: its 440 px stage and its head). A docked window never shrinks below
 * this; a column whose windows need more than the board scrolls instead.
 */
export const MIN_BODY: Readonly<Record<WinId, number>> = {
  signals: 360,
  map: 520,
  graph: 300,
  math: 320,
  assistant: 220,
  grid: 320,
  reproduce: 360,
};
/** A window's header (40 px) and its 1 px border, top and bottom. */
export const WINDOW_CHROME = 42;
export const SPLITTER = 8;
export const minWindowHeight = (id: WinId) => MIN_BODY[id] + WINDOW_CHROME;
/** The height a stack needs so no window in it goes below its minimum. */
export function stackNeed(ids: readonly WinId[]): number {
  return ids.reduce((s, id) => s + minWindowHeight(id), 0) + Math.max(0, ids.length - 1) * SPLITTER;
}
/** Lowest priority first: what leaves a crowded column for the tray. */
const TRAY_ORDER: readonly WinId[] = ["assistant", "graph", "grid", "math", "map", "signals"];

/**
 * Fit a layout to a board `height` px tall: while a column needs more than the
 * board and holds more than one window, its lowest-priority window moves to the
 * tray (keeping its home, so reopening puts it back). A single window too tall
 * for the board stays and its column scrolls. `keep` windows never move.
 */
export function fitLayout(layout: Layout, height: number, keep: readonly WinId[] = []): Layout {
  if (!finite(height) || height <= 0 || layout.maximized) return layout;
  let next = layout;
  for (let i = 0; i < next.columns.length; i++) {
    for (;;) {
      const ids = (next.columns[i] as Column).windows.map((w) => w.id);
      if (ids.length < 2 || stackNeed(ids) <= height) break;
      const out = TRAY_ORDER.find((id) => ids.includes(id) && !keep.includes(id));
      if (!out) break;
      next = closeWindow(next, out);
    }
  }
  return next;
}

/**
 * Signals | Alert math over Assistant | Map over Patient flow, the unit grid in
 * the tray; fitted to the board, so under about 900 px Patient flow and under
 * about 630 px Assistant start in the tray, never squashed.
 */
export function defaultLayout(height = Number.POSITIVE_INFINITY): Layout {
  return fitLayout(
    {
      columns: [
        { id: "signals", width: 0.27, windows: [{ id: "signals", size: 1 }] },
        {
          id: "detail",
          width: 0.33,
          windows: [
            { id: "math", size: 0.6 },
            { id: "assistant", size: 0.4 },
          ],
        },
        {
          id: "map",
          width: 0.4,
          windows: [
            { id: "map", size: 0.64 },
            { id: "graph", size: 0.36 },
          ],
        },
      ],
      closed: {
        grid: { column: "map", columnIndex: 2, index: 2, size: 0.4 },
        reproduce: { column: "map", columnIndex: 2, index: 3, size: 0.6 },
      },
      maximized: null,
    },
    height,
  );
}

/** Presets are fitted like the default: what the board cannot hold starts in the tray. */
export function presetLayout(preset: Preset, height = Number.POSITIVE_INFINITY): Layout {
  if (preset === "default") return defaultLayout(height);
  if (preset === "signals")
    // Reading: the feed and the alert math side by side, wide.
    return fitLayout(
      clampLayout({
        columns: [
          { id: "signals", width: 0.42, windows: [{ id: "signals", size: 1 }] },
          {
            id: "detail",
            width: 0.58,
            windows: [
              { id: "math", size: 0.6 },
              { id: "assistant", size: 0.4 },
            ],
          },
        ],
        closed: {
          reproduce: { column: "detail", columnIndex: 1, index: 2, size: 0.6 },
          map: { column: "detail", columnIndex: 1, index: 2, size: 0.5 },
          graph: { column: "detail", columnIndex: 1, index: 3, size: 0.4 },
          grid: { column: "detail", columnIndex: 1, index: 3, size: 0.4 },
        },
        maximized: null,
      }),
      height,
    );
  const big = preset === "map" ? "map" : "grid";
  return clampLayout({
    columns: [
      { id: "signals", width: 0.26, windows: [{ id: "signals", size: 1 }] },
      { id: "map", width: 0.74, windows: [{ id: big, size: 1 }] },
    ],
    closed: {
      reproduce: { column: "map", columnIndex: 1, index: 1, size: 0.6 },
      graph: { column: "map", columnIndex: 1, index: 1, size: 0.4 },
      math: { column: "signals", columnIndex: 0, index: 1, size: 0.5 },
      assistant: { column: "signals", columnIndex: 0, index: 2, size: 0.3 },
      [big === "map" ? "grid" : "map"]: { column: "map", columnIndex: 1, index: 1, size: 0.5 },
    },
    maximized: null,
  });
}

export function locate(layout: Layout, id: WinId): { column: number; index: number } | null {
  for (const [column, c] of layout.columns.entries()) {
    const index = c.windows.findIndex((w) => w.id === id);
    if (index !== -1) return { column, index };
  }
  return null;
}

export function closeWindow(layout: Layout, id: WinId): Layout {
  const at = locate(layout, id);
  if (!at) return layout;
  const col = layout.columns[at.column] as Column;
  const win = col.windows[at.index] as DockWindow;
  return clampLayout({
    ...layout,
    columns: layout.columns.map((c) => ({ ...c, windows: c.windows.filter((w) => w.id !== id) })),
    closed: {
      ...layout.closed,
      [id]: {
        column: col.id,
        columnIndex: at.column,
        index: at.index,
        size: win.size,
        ...(col.windows.length === 1 ? { width: col.width } : {}),
      },
    },
    maximized: layout.maximized === id ? null : layout.maximized,
  });
}

export function reopenWindow(layout: Layout, id: WinId): Layout {
  const home = layout.closed[id];
  if (!home) return layout;
  const found = layout.columns.findIndex((c) => c.id === home.column);
  const closed = { ...layout.closed };
  delete closed[id];
  if (found < 0 && layout.columns.length < 3) {
    // Its column is gone: recreate it at its remembered position.
    const n = layout.columns.length;
    const width = n ? clamp(home.width ?? 1 / (n + 1), 0.18, 0.6) : 1;
    const columns = layout.columns.map((c) => ({ ...c, width: c.width * (1 - width) }));
    columns.splice(clamp(home.columnIndex, 0, n), 0, { id: home.column, width, windows: [{ id, size: 1 }] });
    return clampLayout({ ...layout, closed, maximized: null, columns });
  }
  const column = found < 0 ? clamp(home.columnIndex, 0, layout.columns.length - 1) : found;
  return clampLayout({
    ...layout,
    closed,
    maximized: null,
    columns: layout.columns.map((c, i) => {
      if (i !== column) return c;
      const size = c.windows.length ? clamp(home.size, 0.16, 0.6) : 1;
      const windows = c.windows.map((w) => ({ ...w, size: w.size * (1 - size) }));
      windows.splice(clamp(home.index, 0, windows.length), 0, { id, size });
      return { ...c, windows };
    }),
  });
}

/** Only the source and destination stacks change. No collision solving or compaction. */
export function moveWindow(layout: Layout, id: WinId, slot: Slot): Layout {
  const from = locate(layout, id);
  const alone = layout.columns[from?.column ?? -1]?.windows.length === 1;
  if (!from || layout.maximized || (slot.newColumn && layout.columns.length >= 3 && !alone)) return layout;
  const dest = clamp(Math.round(slot.column), 0, layout.columns.length - (slot.newColumn ? 0 : 1));
  if (!slot.newColumn && dest === from.column && (slot.index === from.index || slot.index === from.index + 1)) return layout;
  const columns = layout.columns.map((c) => ({ ...c, windows: c.windows.filter((w) => w.id !== id).map((w) => ({ ...w })) }));
  const source = columns[from.column] as Column;
  const moved = layout.columns[from.column]?.windows[from.index] as DockWindow;
  if (slot.newColumn || dest !== from.column) {
    const sizes = fractions(source.windows.map((w) => w.size));
    source.windows.forEach((w, i) => {
      w.size = sizes[i] as number;
    });
  }
  if (slot.newColumn) {
    let n = 1;
    while (columns.some((c) => c.id === `column-${n}`)) n++;
    columns.forEach((c) => {
      c.width *= 2 / 3;
    });
    columns.splice(dest, 0, { id: `column-${n}`, width: 1 / 3, windows: [{ id, size: 1 }] });
  } else {
    const col = columns[dest] as Column;
    const size = dest === from.column ? moved.size : 1 / (col.windows.length + 1);
    if (dest !== from.column)
      col.windows.forEach((w) => {
        w.size *= 1 - size;
      });
    const index = slot.index - (dest === from.column && from.index < slot.index ? 1 : 0);
    col.windows.splice(clamp(index, 0, col.windows.length), 0, { id, size });
  }
  // An emptied source column is dropped by clampLayout; the others take its width.
  return clampLayout({ ...layout, columns });
}

/**
 * Change just the adjacent pair; delta is a fraction of the whole board/stack.
 * `minimum` is one floor for both, or [upper/left, lower/right] floors; floors
 * that cannot both fit are scaled down together.
 */
export function resizePair(values: number[], index: number, delta: number, minimum: number | readonly [number, number]): number[] {
  if (index < 0 || index >= values.length - 1 || !finite(delta)) return values;
  const next = [...values];
  const total = (values[index] as number) + (values[index + 1] as number);
  let [lo, hi] = typeof minimum === "number" ? [minimum, minimum] : minimum;
  if (lo + hi > total) {
    const scale = total / (lo + hi);
    lo *= scale;
    hi *= scale;
  }
  next[index] = clamp((values[index] as number) + delta, lo, total - hi);
  next[index + 1] = total - (next[index] as number);
  return next;
}
export function resizeColumns(layout: Layout, index: number, delta: number, minimum: number | readonly [number, number] = 0.18): Layout {
  const widths = resizePair(
    layout.columns.map((c) => c.width),
    index,
    delta,
    minimum,
  );
  return { ...layout, columns: layout.columns.map((c, i) => ({ ...c, width: widths[i] as number })) };
}
export function resizeStack(
  layout: Layout,
  column: number,
  index: number,
  delta: number,
  minimum: number | readonly [number, number] = 0.16,
): Layout {
  return {
    ...layout,
    columns: layout.columns.map((c, i) => {
      if (i !== column) return c;
      const sizes = resizePair(
        c.windows.map((w) => w.size),
        index,
        delta,
        minimum,
      );
      return { ...c, windows: c.windows.map((w, j) => ({ ...w, size: sizes[j] as number })) };
    }),
  };
}
export function equalize(layout: Layout, column?: number): Layout {
  return {
    ...layout,
    columns: layout.columns.map((c, i) =>
      column === undefined
        ? { ...c, width: 1 / layout.columns.length }
        : i === column
          ? { ...c, windows: c.windows.map((w) => ({ ...w, size: 1 / c.windows.length })) }
          : c,
    ),
  };
}
export function maximizeWindow(layout: Layout, id: WinId): Layout {
  return locate(layout, id) ? { ...layout, maximized: layout.maximized === id ? null : id } : layout;
}

export function serializeLayout(layout: Layout): string {
  return JSON.stringify({ v: 2, ...layout });
}
/** Old free-grid layouts are intentionally not migrated: their geometry has no dock meaning. */
export function parseLayout(raw: string | null): Layout | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.v !== 2 ||
      !Array.isArray(value.columns) ||
      value.columns.length > 3 ||
      !value.closed ||
      typeof value.closed !== "object" ||
      Array.isArray(value.closed)
    )
      return null;
    const seen = new Set<WinId>();
    const columns = new Set<string>();
    for (const c of value.columns) {
      if (!c || typeof c.id !== "string" || !c.id || columns.has(c.id) || !finite(c.width) || !Array.isArray(c.windows)) return null;
      columns.add(c.id);
      for (const w of c.windows) {
        if (!w || !isWin(w.id) || seen.has(w.id) || !finite(w.size)) return null;
        seen.add(w.id);
      }
    }
    for (const [id, h] of Object.entries(value.closed)) {
      const home = h as Home;
      if (
        !isWin(id) ||
        seen.has(id) ||
        !home ||
        typeof home.column !== "string" ||
        !Number.isInteger(home.columnIndex) ||
        home.columnIndex < 0 ||
        !Number.isInteger(home.index) ||
        home.index < 0 ||
        !finite(home.size) ||
        (home.width !== undefined && !finite(home.width))
      )
        return null;
      seen.add(id);
    }
    if (seen.size !== WIN_IDS.length || (value.maximized !== null && (!isWin(value.maximized) || !locate(value, value.maximized))))
      return null;
    return clampLayout({ columns: value.columns, closed: value.closed, maximized: value.maximized });
  } catch {
    return null;
  }
}
/**
 * The stored layout, or the default, fitted to the board: a stored stack that
 * would squash a window below its minimum loses its lowest-priority windows to
 * the tray. The fitted result is shown, not written back, so a taller screen
 * later still gets the stored arrangement.
 */
export function migrateLayout(raw: string | null, height = Number.POSITIVE_INFINITY, keep: readonly WinId[] = []): Layout {
  const stored = parseLayout(raw);
  return stored ? fitLayout(stored, height, keep) : defaultLayout(height);
}
