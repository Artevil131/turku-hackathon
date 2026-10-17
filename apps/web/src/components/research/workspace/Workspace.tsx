import { type AeiClient, ApiError, type Project } from "@aei/contract";
import { type Locale, t } from "@aei/i18n";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { hashParams } from "../../../url.ts";
import { InfoButton } from "../../Info.tsx";
import { chartTitle } from "../charts/model.ts";
import type { ChartSpec } from "../charts/spec.ts";
import {
  addChart,
  addWindow,
  allIds,
  boardRows,
  CHART_MIN_SIZE,
  COLS,
  clampRect,
  compactLayout,
  defaultLayout,
  fillLayout,
  fitLayout,
  focusLayout,
  insertBetween,
  isChartId,
  isCopyId,
  kindOf,
  type Layout,
  loadFocus,
  loadLayout,
  MAX_ROWS,
  MIN_SIZE,
  type Preset,
  parseLayout,
  patchWin,
  presetLayout,
  ROW_PX,
  raise,
  removeChart,
  removeCopy,
  saveFocus,
  saveLayout,
  serializeLayout,
  WIN_IDS,
  type WinId,
  winOf,
  withCharts,
} from "./layout.ts";
import { templateLayout } from "./templates.ts";
import "./workspace.css";
import { DateChip } from "./DateChip.tsx";

// The window workspace of the researcher page. At 1100 px and wider the
// windows float on a 12-column grid with 24 px rows: drag the top edge to
// move, drag (or use the arrow keys on) the corner handle to resize, close
// with the button and reopen from the toolbar. Narrower, the windows stack.
// Windows compact upward like a dashboard grid: after any move, resize or
// close they float up to fill gaps, and the window being dragged pushes the
// ones it lands on down. While dragging, the window follows the pointer (a
// transform, updated once per animation frame), a soft placeholder shows the
// cell it will land in and the others move out of the way live; the grid is
// committed on release.
//
// Windows are rendered in a fixed DOM order and stacked with z-index only:
// raising one must not move its node, or a click on a button inside it
// (which focuses the button, which raises the window) is swallowed mid-press.
//
// Focus mode (the F key, the button in a window's chrome, or the focus bar)
// derives one more layout from the user's own: the focused window takes the
// whole width and the viewport's height, the others wait in a rail of titles.
// The user's layout is never written while focused, so leaving restores it.

const TITLE_KEY = {
  signals: "boardFeed",
  map: "boardGeo",
  graph: "boardGraph",
  math: "boardMath",
  assistant: "boardAssistant",
  grid: "boardGrid",
  reproduce: "boardReproduce",
  notebook: "notebookWindow",
  coverage: "boardCoverage",
  timeline: "boardTimeline",
  answer: "boardAnswer",
} as const;

/** What each window kind is, for its ⓘ. */
const GUIDE_KEY = {
  signals: "guideSignals",
  map: "guideMap",
  graph: "guideGraph",
  math: "guideMath",
  assistant: "guideAssistant",
  grid: "guideGrid",
  reproduce: "guideReproduce",
  notebook: "guideNotebook",
  coverage: "guideCoverage",
  timeline: "guideTimeline",
  answer: "guideAnswer",
} as const;

/** A request to add a chart window: a new `key` adds `spec`. */
export interface ChartRequest {
  key: number;
  spec: ChartSpec;
}

/** The stacked order under 1100 px: the list first, the map last (as before). */
const STACK_ORDER: readonly WinId[] = [
  "answer",
  "timeline",
  "signals",
  "notebook",
  "math",
  "assistant",
  "map",
  "graph",
  "grid",
  "reproduce",
  "coverage",
];

const RAIL_KEY = "aei.research.rail";
/** Whether the tool rail is shown: open unless the researcher closed it (kept beside the layout). */
function loadRail(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) !== "closed";
  } catch {
    return true;
  }
}
function saveRail(open: boolean): void {
  try {
    localStorage.setItem(RAIL_KEY, open ? "open" : "closed");
  } catch {
    // Blocked storage: the rail's state simply does not persist.
  }
}

/**
 * Whether the board has room for the free grid: its own width, not the screen's, so a collapsed or open sidebar,
 * a split pane or a small window each get the layout that fits. Until it is measured, the screen's width decides.
 */
const WIDE_BOARD_PX = 840;
function useWide(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia("(min-width: 1100px)").matches);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_BOARD_PX);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return wide;
}

type Rect = { x: number; y: number; w: number; h: number };
const CHART_MIN = CHART_MIN_SIZE;

type Drag = {
  kind: "move" | "size" | "sizeX" | "sizeY";
  id: string;
  x0: number;
  y0: number;
  scroll0: number;
  /** The layout when the drag began; every preview is computed from it. */
  base: Layout;
  rect: Rect;
  last: Rect;
  colW: number;
  areaW: number;
  el: HTMLElement | null;
  pointer: { x: number; y: number };
  raf: number | null;
};

/** Two touching windows, by id: a window put between them (`axis` "x": `a` left of `b`; "y": `a` above `b`). */
interface Between {
  a: string;
  b: string;
  axis: "x" | "y";
}

// Windows with their own scrolling by design (a list or a page), which keep their size.
const GROWS_NOT = new Set<string>(["notebook", "timeline", "signals", "assistant"]);
const MAX_GROW_ROWS = 60;

/** Companion windows (the signal explained, map, patient flow, assistant) open beside the first window, not under everything. */
const SIDE_KINDS: ReadonlySet<WinId> = new Set<WinId>(["math", "map", "graph", "assistant"]);
function sideSlot(layout: Layout, id: WinId): Partial<Rect> {
  const here = layout.wins[id];
  if (!SIDE_KINDS.has(id) || here.open) return {};
  const others = WIN_IDS.filter((k) => k !== id && k !== "timeline" && layout.wins[k].open).map((k) => layout.wins[k]);
  if (!others.length) return {};
  const w = Math.max(MIN_SIZE[id].w, Math.min(5, here.w));
  return { x: COLS - w, y: Math.min(...others.map((o) => o.y)), w };
}

export function Workspace({
  projectId,
  project,
  client,
  onGone,
  locale,
  content,
  onOpened,
  onClosed,
  initiallyOpen,
  reveal,
  overlay,
  primary = null,
  answers = [],
  lead,
  chartRequest = null,
  chartContent,
  chartMenu,
  rail,
  revealRail,
  clock = null,
}: {
  /** The project open in this tab (null: the browser's own layout). */
  projectId?: string | null;
  project?: Project;
  /** The replay clock's day: the data's "today", shown in the toolbar (a frozen project stands at its own day). */
  clock?: string | null;
  client?: AeiClient;
  /** The project was deleted elsewhere: its layout save answered 404. */
  onGone?: () => void;
  locale: Locale;
  content: Record<WinId, ReactNode>;
  onOpened?: (id: WinId) => void;
  onClosed?: (id: WinId) => void;
  /** Windows to open on mount (a link that names the unit grid). */
  initiallyOpen?: WinId[];
  /** A window to bring forward (opening it if closed) each time `key` changes: the card on a new signal, the map on "Show on map". */
  reveal?: { id: WinId; key: string | null };
  /** Rendered over the board (the friend's full-size notebook host). */
  overlay?: ReactNode;
  /** The window that holds the selected signal: it gets the accent ring and is what F focuses. */
  primary?: WinId | null;
  /** The windows that answer the selected signal next (full tone); every other window steps back. */
  answers?: readonly WinId[];
  /** One line per window saying what it answers for the selected signal, shown at its top. */
  lead?: Partial<Record<WinId, string>>;
  /** Adds a chart window each time `key` changes (the Add as chart buttons). */
  chartRequest?: ChartRequest | null;
  /** The body of a chart window. */
  chartContent?: (id: string, spec: ChartSpec) => ReactNode;
  /** The form behind "+ Chart" in the tray; `done` closes the tray. */
  chartMenu?: (done: () => void) => ReactNode;
  /** The tool rail, docked on the left of the board; the toolbar's Tools button, T and a double-click on the empty board toggle it. */
  rail?: ReactNode;
  /** Each new value shows the rail (the card's "Open in Tools" sends the slice there). */
  revealRail?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWide(rootRef);
  const [railOpen, setRailOpen] = useState(loadRail);
  const seenRailReveal = useRef(revealRail ?? 0);
  useEffect(() => {
    if (revealRail === undefined || revealRail === seenRailReveal.current) return;
    seenRailReveal.current = revealRail;
    if (!railOpen) toggleRail(true);
  });
  const toggleRail = (to = !railOpen) => {
    setRailOpen(to);
    saveRail(to);
  };
  const areaRef = useRef<HTMLDivElement>(null);
  // null = the default layout for the board's height; set once the user changes anything.
  const initialLayout = (): Layout | null => {
    if (project?.layout) return parseLayout(JSON.stringify(project.layout));
    if (!projectId && hashParams().get("quick") === "patient") return templateLayout("patient");
    return projectId ? null : loadLayout();
  };
  const [saved, setSaved] = useState<Layout | null>(initialLayout);
  // A project keeps its own layout on the server, saved a second after the last change; the browser's layout is for project-less pages.
  const pendingSave = useRef<{ id: string; layout: Layout | null } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const [saveFailed, setSaveFailed] = useState(false);
  const flush = useCallback(() => {
    const next = pendingSave.current;
    pendingSave.current = null;
    if (!next || !client) return;
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        // Read just before replacing, so a project-dialog edit or an earlier save is not overwritten by stale props.
        const fresh = await client.project(next.id);
        await client.updateProject(next.id, { ...fresh.project, layout: JSON.parse(serializeLayout(next.layout ?? defaultLayout())) });
        setSaveFailed(false);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) onGone?.();
        else setSaveFailed(true);
      }
    });
  }, [client, onGone]);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
    },
    [flush],
  );
  const persist = (layout: Layout | null) => {
    if (project && client) {
      pendingSave.current = { id: project.id, layout };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 1000);
    } else if (!projectId) saveLayout(layout);
  };
  // Another project (or none) in the same tab: save the old one's last change, then load the new one's layout.
  // The patient quick view and the board share no layout: a switch between them re-seeds too.
  const identity = `${projectId ?? ""}:${project?.id ?? ""}:${hashParams().get("quick") ?? ""}`;
  const loadedIdentity = useRef(identity);
  useEffect(() => {
    if (loadedIdentity.current === identity) return;
    loadedIdentity.current = identity;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flush();
    setSaved(initialLayout());
    setSaveFailed(false);
  });
  // The layout previewed while a window is being dragged or resized; committed on release.
  const [draft, setDraft] = useState<Layout | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [areaW, setAreaW] = useState(0);
  // Rows from the board's top edge to the bottom of its scroll viewport: the height of a focused window.
  const [viewRows, setViewRows] = useState(24);
  const [animate, setAnimate] = useState(false);
  const [status, setStatus] = useState("");
  const [focus, setFocus] = useState<string | null>(loadFocus);
  const drag = useRef<Drag | null>(null);
  const focusAfter = useRef<string | null>(null);

  // The user's own layout (or the drag preview of it), and the layout drawn: in focus mode, derived from it.
  // A window never makes you scroll inside it: where its content is taller than its frame, the frame grows (not saved).
  const [needed, setNeeded] = useState<Record<string, number>>({});
  const own = draft ?? saved ?? defaultLayout();
  const grown = wide
    ? Object.entries(needed).reduce((l, [id, h]) => {
        const w = allIds(l).includes(id) ? winOf(l, id) : null;
        return w?.open && h > w.h ? patchWin(l, id, { h }) : l;
      }, own)
    : own;
  const base: Layout = compactLayout(fitLayout(grown));
  const focused = wide && focus !== null ? focus : null;
  const layout: Layout = focused ? compactLayout(fitLayout(focusLayout(base, focused, viewRows))) : base;
  const colW = areaW / COLS;

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAreaW(r.width);
      const scroller = el.closest<HTMLElement>(".page") ?? document.documentElement;
      const top = r.top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setViewRows(Math.max(12, Math.floor((scroller.clientHeight - top - 12) / ROW_PX)));
    };
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useLayoutEffect(() => {
    if (!wide || typeof ResizeObserver !== "function") return;
    const root = areaRef.current;
    if (!root) return;
    const measure = () => {
      const next: Record<string, number> = {};
      for (const win of root.querySelectorAll<HTMLElement>(".ws-win[data-win]")) {
        const id = win.dataset.win ?? "";
        if (GROWS_NOT.has(kindOf(base, id) ?? id)) continue;
        const frame = win.querySelector<HTMLElement>(".ws-frame");
        const body = win.querySelector<HTMLElement>(".ws-body");
        if (!frame || !body || body.scrollHeight <= body.clientHeight + 1) continue;
        next[id] = Math.min(MAX_GROW_ROWS, Math.ceil((frame.clientHeight - body.clientHeight + body.scrollHeight + 16) / ROW_PX));
      }
      setNeeded((prev) => {
        const merged = { ...prev };
        let changed = false;
        for (const [id, h] of Object.entries(next)) if (h > (merged[id] ?? 0)) (merged[id] = h), (changed = true);
        return changed ? merged : prev;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const body of root.querySelectorAll(".ws-body")) {
      ro.observe(body);
      for (const child of Array.from(body.children)) ro.observe(child);
    }
    return () => ro.disconnect();
  });
  // A narrower or wider board reflows the content, so what was needed is measured again.
  useEffect(() => setNeeded({}), [areaW]);
  // Position changes animate, but not the first placement.
  useEffect(() => {
    if (areaW <= 0 || animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [areaW, animate]);

  const commit = (next: Layout, moved?: string) => {
    const c = fillLayout(compactLayout(fitLayout(next), moved), moved);
    setSaved(c);
    persist(c);
    return c;
  };
  const update = (fn: (l: Layout) => Layout, moved?: string) => commit(fn(base), moved);

  // Focus mode: remembered apart from the layout, so it survives a reload but never rewrites the user's grid.
  const titleOf = (id: string): string => {
    const c = layout.charts[id] ?? base.charts[id];
    if (c) return chartTitle(locale, c, null);
    if (isCopyId(id)) return `${t(locale, TITLE_KEY[kindOf(base, id) ?? "signals"])} ${id.split(":")[2] ?? ""}`.trim();
    return t(locale, TITLE_KEY[id as WinId]);
  };
  const setFocusTo = (id: string | null) => {
    setFocus(id);
    saveFocus(id);
    if (id) {
      focusAfter.current = `ws-win-${id}`;
      setStatus(t(locale, "wsFocusStatus", { title: titleOf(id) }));
    } else if (focus) {
      focusAfter.current = `ws-win-${focus}`;
      setStatus(t(locale, "wsFocusLeft"));
    }
  };
  const toggleFocus = (id?: string) => {
    if (focus && (!id || id === focus)) return setFocusTo(null);
    const active = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".ws-win")?.dataset.win as WinId | undefined;
    const target = id ?? (primary && base.wins[primary].open ? primary : (active ?? primary ?? "signals"));
    setFocusTo(target);
  };
  useEffect(() => {
    if (!wide) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFocus();
      } else if (e.key === "Escape" && focus && !el?.closest(".geo-detail, .ws-pop")) {
        setFocusTo(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!rail) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.key !== "t" && e.key !== "T")) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true']") || document.querySelector("[aria-modal='true'], dialog[open]"))
        return;
      e.preventDefault();
      toggleRail();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // A link that names a window (the unit grid) opens it once the board is measured.
  const wanted = useRef(initiallyOpen);
  useEffect(() => {
    if (!wanted.current) return;
    const ids = wanted.current.filter((id) => !base.wins[id].open);
    wanted.current = undefined;
    if (ids.length) update((l) => ids.reduce((acc, id) => raise(patchWin(acc, id, { open: true }), id), l), ids[0]);
  });

  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    document.getElementById(id)?.focus();
  });

  const close = (id: string) => {
    focusAfter.current = "ws-tray-button";
    if (focus === id) setFocusTo(null);
    // A chart is not kept in the tray: closing it removes it.
    if (isChartId(id)) return void update((l) => removeChart(l, id));
    // A copy of a kind is not kept in the tray either.
    if (isCopyId(id)) return void update((l) => removeCopy(l, id));
    update((l) => patchWin(l, id, { open: false }));
    onClosed?.(id as WinId);
  };
  const open = (id: WinId) => {
    focusAfter.current = `ws-win-${id}`;
    update((l) => raise(patchWin(l, id, { open: true, ...sideSlot(l, id) }), id), id);
    // While focused, an opened window is the one to look at.
    if (focus && focus !== id) setFocusTo(id);
    onOpened?.(id);
  };
  const toggle = (id: WinId) => (base.wins[id].open ? close(id) : open(id));
  // A new window of any kind, as often as the grid allows: where the researcher asked, else under the others.
  const add = (kind: WinId, at?: Partial<Rect>, between?: Between) => {
    const added = (between ? insertBetween(base, kind, between.a, between.b, between.axis) : null) ?? addWindow(base, kind, at);
    commit(added.layout, added.id);
    focusAfter.current = `ws-win-${added.id}`;
    if (focus) setFocusTo(added.id);
    setStatus(t(locale, "wsOpenedStatus", { title: t(locale, TITLE_KEY[kind]) }));
    onOpened?.(kind);
  };
  const countOf = (kind: WinId) => allIds(base).filter((id) => kindOf(base, id) === kind && winOf(base, id).open).length;
  // The picker (a click on empty board, or the + on a frame's empty side) and the + hint near a frame's edge.
  const [picker, setPicker] = useState<{ x: number; y: number; at: Partial<Rect>; between?: Between } | null>(null);
  const [hint, setHint] = useState<{ x: number; y: number; at: Partial<Rect>; side: string; between?: Between } | null>(null);
  const free = (r: Rect) =>
    r.x >= 0 &&
    r.x + r.w <= COLS &&
    r.y >= 0 &&
    !allIds(base).some((id) => {
      const o = winOf(base, id);
      return o.open && o.x < r.x + r.w && r.x < o.x + o.w && o.y < r.y + r.h && r.y < o.y + o.h;
    });
  const cellAt = (e: { clientX: number; clientY: number }) => {
    const box = areaRef.current?.getBoundingClientRect();
    return box ? { px: e.clientX - box.left, py: e.clientY - box.top } : null;
  };
  const findHint = (px: number, py: number) => {
    const NEAR = 26;
    for (const id of allIds(base)) {
      const r = winOf(base, id);
      if (!r.open) continue;
      const right = (r.x + r.w) * colW;
      const left = r.x * colW;
      const top = r.y * ROW_PX;
      const bottom = (r.y + r.h) * ROW_PX;
      const within = py >= top && py <= bottom;
      if (within && Math.abs(px - right) <= NEAR)
        for (const w of [4, 3]) {
          const at = { x: r.x + r.w, y: r.y, w, h: r.h };
          if (free(at)) return { x: right, y: (top + bottom) / 2, at, side: "right" };
        }
      if (within && Math.abs(px - left) <= NEAR)
        for (const w of [4, 3]) {
          const at = { x: r.x - w, y: r.y, w, h: r.h };
          if (free(at)) return { x: left, y: (top + bottom) / 2, at, side: "left" };
        }
      if (px >= left && px <= right && Math.abs(py - bottom) <= NEAR) {
        const at = { x: r.x, y: r.y + r.h, w: r.w, h: 10 };
        if (free(at)) return { x: (left + right) / 2, y: bottom, at, side: "bottom" };
      }
    }
    // No empty side: the line where two windows touch offers a new window between them.
    const open = allIds(base).filter((id) => winOf(base, id).open);
    for (const a of open)
      for (const b of open) {
        if (a === b) continue;
        const A = winOf(base, a);
        const B = winOf(base, b);
        const rows = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
        const cols = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        if (A.x + A.w === B.x && rows >= 4) {
          const x = B.x * colW;
          const top = Math.max(A.y, B.y) * ROW_PX;
          const bottom = Math.min(A.y + A.h, B.y + B.h) * ROW_PX;
          if (Math.abs(px - x) <= NEAR && py >= top && py <= bottom)
            return {
              x,
              y: (top + bottom) / 2,
              at: { x: A.x, y: A.y, w: 4, h: rows },
              side: "between-x",
              between: { a, b, axis: "x" as const },
            };
        }
        if (A.y + A.h === B.y && cols >= 3) {
          const y = B.y * ROW_PX;
          const left = Math.max(A.x, B.x) * colW;
          const right = Math.min(A.x + A.w, B.x + B.w) * colW;
          if (Math.abs(py - y) <= NEAR && px >= left && px <= right)
            return { x: (left + right) / 2, y, at: { x: A.x, y: B.y, w: cols }, side: "between-y", between: { a, b, axis: "y" as const } };
        }
      }
    return null;
  };
  const onAreaMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!wide || focused || dragging || picker) return;
    const c = cellAt(e);
    const next = c ? findHint(c.px, c.py) : null;
    setHint((h) => (h?.x === next?.x && h?.y === next?.y && h?.side === next?.side ? h : next));
  };
  const onAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !wide || focused) return;
    const c = cellAt(e);
    if (!c) return;
    const x = Math.min(COLS - 3, Math.max(0, Math.floor(c.px / colW)));
    setPicker({ x: e.clientX, y: e.clientY, at: { x, y: Math.max(0, Math.floor(c.py / ROW_PX)) } });
  };
  // "Add as chart" and the tray form: a new window, brought forward (and focused when the board is in focus mode).
  const lastChart = useRef(chartRequest?.key ?? null);
  useEffect(() => {
    if (!chartRequest || chartRequest.key === lastChart.current) return;
    lastChart.current = chartRequest.key;
    const added = addChart(base, chartRequest.spec);
    commit(added.layout, added.id);
    focusAfter.current = `ws-win-${added.id}`;
    if (focus) setFocusTo(added.id);
    setStatus(t(locale, "chartAdded", { title: chartTitle(locale, chartRequest.spec, null) }));
  });
  const revealed = useRef(reveal?.key ?? null);
  useEffect(() => {
    if (!reveal || reveal.key === revealed.current) return;
    revealed.current = reveal.key;
    if (reveal.key === null) return;
    if (!base.wins[reveal.id].open) open(reveal.id);
    else if (focus && focus !== reveal.id) setFocusTo(reveal.id);
    else focusWin(reveal.id);
    // An already visible window is brought into view and flashed once, so a repeated ask is still answered.
    const el = document.getElementById(`ws-win-${reveal.id}`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      el.classList.add("ws-flash");
      setTimeout(() => el.classList.remove("ws-flash"), 1200);
    }
  });
  const PRESETS: readonly Preset[] = ["default", "map", "signals", "units", "analysis"];
  const PRESET_KEY = { default: "wsDefault", map: "wsMap", signals: "wsSignals", units: "wsUnits", analysis: "wsAnalysis" } as const;
  const applyPreset = (p: Preset) => {
    const l = withCharts(presetLayout(p), base);
    setSaved(l);
    persist(l);
    if (focus) setFocusTo(null);
    if (p === "analysis" && rail && !railOpen) toggleRail(true);
    setStatus(t(locale, "wsPresetApplied", { title: t(locale, PRESET_KEY[p]) }));
  };
  const layouts = (
    <div className="ws-layouts" role="group" aria-label={t(locale, "wsPresets")}>
      <span className="ws-layouts-label">{t(locale, "wsPresets")}</span>
      <div className="seg">
        {PRESETS.map((p) => (
          <button type="button" key={p} data-preset={p} onClick={() => applyPreset(p)}>
            {t(locale, PRESET_KEY[p])}
          </button>
        ))}
      </div>
      <DateChip locale={locale} date={project?.mode === "frozen" ? (project.asOf ?? clock) : clock} frozen={project?.mode === "frozen"} />
      <button
        type="button"
        className="ws-find"
        data-find
        onClick={() => dispatchEvent(new CustomEvent("aei:command"))}
        title={`${t(locale, "wsFind")} (/ · Ctrl+K)`}
      >
        {t(locale, "wsFind")} <kbd>/</kbd>
      </button>
    </div>
  );
  // The focus bar: the focused window's title, the other windows as a rail of titles, and the way back.
  const focusBar = focused ? (
    <div className="ws-focusbar" role="group" aria-label={t(locale, "wsFocusOn")}>
      <span className="ws-layouts-label">{t(locale, "wsFocusOn")}</span>
      <strong className="ws-focusbar-current">{titleOf(focused)}</strong>
      <span className="ws-focusbar-rail">
        {allIds(base)
          .filter((id) => id !== focused && winOf(base, id).open)
          .map((id) => (
            <button type="button" key={id} className="ws-focusbar-win" data-focus-win={id} onClick={() => setFocusTo(id)}>
              {titleOf(id)}
            </button>
          ))}
      </span>
      <button type="button" className="ws-focusbar-leave" data-focus-leave onClick={() => setFocusTo(null)}>
        {t(locale, "wsFocusLeave")}
        <kbd>Esc</kbd>
      </button>
    </div>
  ) : null;
  const reset = () => {
    // The fixed windows go back to the default; the charts the researcher added stay.
    const keep = Object.keys(base.charts).length > 0 ? withCharts(defaultLayout(), base) : null;
    setSaved(keep);
    persist(keep);
    setStatus("");
  };
  const focusWin = (id: string) => {
    if (base.order[base.order.length - 1] !== id) update((l) => raise(l, id));
  };

  const announce = (id: string, r: Rect) =>
    setStatus(t(locale, "wsStatus", { title: titleOf(id), x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }));

  const begin = (e: PointerEvent, kind: Drag["kind"], id: string) => {
    if (e.button !== 0 || !areaRef.current) return;
    if ((e.target as HTMLElement).closest("button") && kind === "move") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    focusWin(id);
    const w = winOf(base, id);
    const area = areaRef.current.getBoundingClientRect().width;
    const cw = area / COLS;
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>(".ws-win");
    const rect = { x: w.x, y: w.y, w: w.w, h: w.h };
    el?.style.setProperty("--tx", `${rect.x * cw}px`);
    el?.style.setProperty("--ty", `${rect.y * ROW_PX}px`);
    el?.style.setProperty("--tw", `${rect.w * cw}px`);
    el?.style.setProperty("--th", `${rect.h * ROW_PX}px`);
    drag.current = {
      kind,
      id,
      x0: e.clientX,
      y0: e.clientY,
      scroll0: window.scrollY,
      base,
      rect,
      last: rect,
      colW: cw,
      areaW: area,
      el,
      pointer: { x: e.clientX, y: e.clientY },
      raf: null,
    };
    setDraft(base);
    setDragging(id);
  };

  // One frame of the drag: the window follows the pointer freely; the grid cell it would take is previewed.
  const frame = (d: Drag) => {
    d.raf = null;
    const dx = d.pointer.x - d.x0;
    const dy = d.pointer.y - d.y0 + (window.scrollY - d.scroll0);
    const left0 = d.rect.x * d.colW;
    const top0 = d.rect.y * ROW_PX;
    const w0 = d.rect.w * d.colW;
    const h0 = d.rect.h * ROW_PX;
    let next: Rect;
    if (d.kind === "move") {
      const px = Math.min(Math.max(0, left0 + dx), d.areaW - w0);
      const py = Math.max(0, top0 + dy);
      d.el?.style.setProperty("--tx", `${px}px`);
      d.el?.style.setProperty("--ty", `${py}px`);
      next = { ...d.rect, x: Math.round(px / d.colW), y: Math.round(py / ROW_PX) };
    } else {
      const min = isChartId(d.id) ? CHART_MIN : MIN_SIZE[(isCopyId(d.id) ? d.id.split(":")[1] : d.id) as WinId];
      const pw = Math.min(Math.max(min.w * d.colW, w0 + (d.kind === "sizeY" ? 0 : dx)), d.areaW - left0);
      const ph = Math.max(min.h * ROW_PX, h0 + (d.kind === "sizeX" ? 0 : dy));
      d.el?.style.setProperty("--tw", `${pw}px`);
      d.el?.style.setProperty("--th", `${ph}px`);
      next = { ...d.rect, w: Math.round(pw / d.colW), h: Math.round(ph / ROW_PX) };
    }
    next = clampRect(next, d.id, MAX_ROWS);
    const l = d.last;
    if (next.x === l.x && next.y === l.y && next.w === l.w && next.h === l.h) return;
    d.last = next;
    setDraft(compactLayout(patchWin(d.base, d.id, next), d.id));
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pointer = { x: e.clientX, y: e.clientY };
    if (d.raf === null) d.raf = requestAnimationFrame(() => frame(d));
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.raf !== null) {
      cancelAnimationFrame(d.raf);
      frame(d);
    }
    const c = commit(patchWin(d.base, d.id, d.last), d.id);
    setDraft(null);
    setDragging(null);
    announce(d.id, winOf(c, d.id));
  };

  const onHandleKey = (e: KeyboardEvent, id: string) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const w = winOf(base, id);
    const r = e.shiftKey
      ? { ...w, x: w.x + (dir[0] as number), y: w.y + (dir[1] as number) }
      : { ...w, w: w.w + (dir[0] as number), h: w.h + (dir[1] as number) };
    const next = clampRect(r, id, MAX_ROWS);
    const c = update((l) => patchWin(l, id, next), id);
    announce(id, winOf(c, id));
  };

  // A fixed DOM order; the stacking comes from `order` through z-index (see the note at the top).
  const chartIds = Object.keys(layout.charts);
  const copyIds = Object.keys(layout.copies);
  const ids: readonly string[] = wide ? [...WIN_IDS, ...copyIds, ...chartIds] : [...STACK_ORDER, ...copyIds, ...chartIds];
  const tray = <Tray locale={locale} open={(id) => base.wins[id].open} onToggle={toggle} onReset={reset} chartMenu={chartMenu} />;
  const roleOf = (id: string): "primary" | "answer" | "quiet" | undefined =>
    primary === null ? undefined : id === primary ? "primary" : answers.includes((kindOf(base, id) ?? id) as WinId) ? "answer" : "quiet";
  const place = (r: Rect): CSSProperties => ({
    transform: `translate3d(${r.x * colW}px,${r.y * ROW_PX}px,0)`,
    width: r.w * colW,
    height: r.h * ROW_PX,
  });

  return (
    <div
      className="ws"
      ref={rootRef}
      data-float={wide}
      data-animate={animate}
      data-focus={focused !== null}
      data-selection={primary !== null}
    >
      {wide ? null : <div className="ws-tray-row">{tray}</div>}
      {wide ? (
        <div className="ws-toolbar">
          {focusBar ?? layouts}
          <button
            type="button"
            className="ws-add-open"
            onClick={(e) => {
              const b = e.currentTarget.getBoundingClientRect();
              setPicker({ x: b.left, y: b.bottom + 6, at: {} });
            }}
          >
            + {t(locale, "wsEmptyAdd")}
          </button>
        </div>
      ) : null}
      {rail ? (
        <div className="ws-dock" hidden={!railOpen}>
          {rail}
        </div>
      ) : null}
      {/* A click on the empty board offers a new window there; the keyboard has the Windows menu. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a pointer shortcut; the keyboard has the Windows menu. */}
      <div
        className="ws-area"
        ref={areaRef}
        // The board is at least as tall as the viewport, so there is always empty board to click.
        style={wide ? { height: Math.max(boardRows(layout), viewRows) * ROW_PX } : undefined}
        onClick={onAreaClick}
        onPointerMove={onAreaMove}
        onPointerLeave={() => setHint(null)}
      >
        {wide && hint && !dragging && !picker ? (
          <button
            type="button"
            className="ws-plus"
            data-side={hint.side}
            style={{ left: hint.x, top: hint.y }}
            aria-label={t(locale, "wsEmptyAdd")}
            title={t(locale, "wsEmptyAdd")}
            onClick={(e) => {
              const b = e.currentTarget.getBoundingClientRect();
              setPicker({ x: b.right + 6, y: b.top, at: hint.at, between: hint.between });
              setHint(null);
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        {wide && dragging ? <div className="ws-ghost" aria-hidden="true" style={place(winOf(layout, dragging))} /> : null}
        {ids.map((id) => {
          const w = winOf(layout, id);
          if (!w.open) return null;
          const chart = layout.charts[id];
          const kind = kindOf(layout, id);
          const title = titleOf(id);
          const z = layout.order.indexOf(id);
          const isFocus = focused === id;
          const style = wide
            ? ({
                ...(dragging === id
                  ? { transform: "translate3d(var(--tx),var(--ty),0)", width: "var(--tw)", height: "var(--th)" }
                  : place(w)),
                visibility: areaW > 0 ? undefined : "hidden",
                zIndex: dragging === id ? 150 : z + 1,
              } as CSSProperties)
            : undefined;
          const drags = (kind: Drag["kind"]) => ({
            onPointerDown: (e: PointerEvent) => begin(e, kind, id),
            onPointerMove: move,
            onPointerUp: end,
            onPointerCancel: end,
          });
          return (
            <section
              key={id}
              id={`ws-win-${id}`}
              className="ws-win"
              data-win={id}
              data-dragging={dragging === id}
              data-role={roleOf(id)}
              data-focus={isFocus || undefined}
              style={style}
              tabIndex={-1}
              aria-label={title}
              // Raising reorders the DOM; doing it under a button press would swallow that button's click.
              onPointerDownCapture={wide ? (e) => (e.target as Element).closest("button") || focusWin(id) : undefined}
              onFocusCapture={wide ? () => focusWin(id) : undefined}
            >
              <div className="ws-frame">
                {kind && lead?.[kind] ? <p className="ws-lead">{lead[kind]}</p> : null}
                <div className="ws-body">{chart ? chartContent?.(id, chart) : kind ? content[kind] : null}</div>
                {wide && !focused ? (
                  <>
                    <div className="ws-grip" aria-hidden="true" {...drags("move")} />
                    <div className="ws-edge ws-edge-r" aria-hidden="true" {...drags("sizeX")} />
                    <div className="ws-edge ws-edge-b" aria-hidden="true" {...drags("sizeY")} />
                    <button
                      type="button"
                      className="ws-handle"
                      title={`${t(locale, "wsHandle", { title })}. ${t(locale, "wsHint")}`}
                      aria-label={`${t(locale, "wsHandle", { title })}. ${t(locale, "wsHint")}`}
                      {...drags("size")}
                      onKeyDown={(e) => onHandleKey(e, id)}
                    />
                  </>
                ) : null}
                {kind ? (
                  <span className="ws-guide">
                    <InfoButton locale={locale} label={t(locale, "guideLabel")} align="end">
                      {t(locale, GUIDE_KEY[kind])}
                    </InfoButton>
                  </span>
                ) : null}
                {wide ? (
                  <button
                    type="button"
                    className="ws-focus"
                    data-focus-toggle={id}
                    aria-pressed={isFocus}
                    aria-label={isFocus ? t(locale, "wsFocusLeave") : t(locale, "wsFocus", { title })}
                    title={`${isFocus ? t(locale, "wsFocusLeave") : t(locale, "wsFocus", { title })} · F`}
                    onClick={() => toggleFocus(id)}
                  >
                    {isFocus ? (
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                        <path
                          d="M6.5 2.5v4h-4M9.5 13.5v-4h4M2.5 9.5h4v4M13.5 6.5h-4v-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                        <path
                          d="M2.5 6.5v-4h4M13.5 9.5v4h-4M2.5 9.5v4h4M13.5 6.5v-4h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ws-close"
                  aria-label={t(locale, "wsClose", { title })}
                  title={t(locale, "wsClose", { title })}
                  onClick={() => close(id)}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
                    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {wide ? <div className="ws-traydock">{tray}</div> : null}
      {/* The two things you reach for most, bottom left of the project screen and always in view: add a window, the tools. */}
      <div className="ws-float-bar">
        <button
          type="button"
          className="ws-add-float"
          data-add-window
          onClick={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            setPicker({ x: b.left, y: b.top - 440, at: {} });
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {t(locale, "wsEmptyAdd")}
        </button>
        {rail ? (
          <button
            type="button"
            className="ws-tool-float"
            aria-pressed={railOpen}
            aria-keyshortcuts="T"
            title={`${t(locale, railOpen ? "toolsRailHide" : "toolsRailShow")} · T`}
            onClick={() => toggleRail()}
          >
            {t(locale, "toolsWindow")}
          </button>
        ) : null}
      </div>
      {picker ? (
        <WindowPicker
          locale={locale}
          x={picker.x}
          y={picker.y}
          count={countOf}
          onPick={(kind) => {
            add(kind, picker.at, picker.between);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {saveFailed ? <p role="alert">{t(locale, "layoutSaveError")}</p> : null}
      {overlay}
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/** The tray: one quiet icon button that lists the panels with checkmarks, the keyboard hint and the reset link. */
function Tray({
  locale,
  open,
  onToggle,
  onReset,
  chartMenu,
}: {
  locale: Locale;
  open: (id: WinId) => boolean;
  onToggle: (id: WinId) => void;
  onReset: () => void;
  chartMenu?: (done: () => void) => ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const [adding, setAdding] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setShown(false);
      document.getElementById("ws-tray-button")?.focus();
    };
    const onPointer = (e: globalThis.PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setShown(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [shown]);
  return (
    <div className="ws-tray" ref={root}>
      <button
        type="button"
        id="ws-tray-button"
        className="ws-tray-button"
        aria-expanded={shown}
        aria-controls="ws-tray-pop"
        aria-label={t(locale, "wsToolbar")}
        title={t(locale, "wsToolbar")}
        onClick={() => setShown((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="5" height="12" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="2" width="5" height="5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9.5" width="5" height="4.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {shown ? (
        <div className="ws-pop" id="ws-tray-pop" role="group" aria-label={t(locale, "wsToolbar")}>
          <ul className="ws-pop-list">
            {WIN_IDS.map((id) => (
              <li key={id}>
                <label className="ws-pop-row">
                  <input type="checkbox" checked={open(id)} data-toggle={id} onChange={() => onToggle(id)} />
                  <span>{t(locale, `pick_${id}` as "pick_signals")}</span>
                </label>
              </li>
            ))}
          </ul>
          {chartMenu ? (
            <>
              <button type="button" className="ws-pop-reset ws-pop-chart" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
                {t(locale, "chartTray")}
              </button>
              {adding
                ? chartMenu(() => {
                    setAdding(false);
                    setShown(false);
                  })
                : null}
            </>
          ) : null}
          <p className="ws-pop-hint">{t(locale, "wsHint")}</p>
          <button type="button" className="ws-pop-reset" onClick={onReset}>
            {t(locale, "wsReset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** What to put in an empty place: every kind of window, with how many are open already. */
function WindowPicker({
  locale,
  x,
  y,
  count,
  onPick,
  onClose,
}: {
  locale: Locale;
  x: number;
  y: number;
  count: (id: WinId) => number;
  onPick: (id: WinId) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    const pointer = (e: globalThis.PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [onClose]);
  const left = Math.max(8, Math.min(x, innerWidth - 232));
  const top = Math.max(8, Math.min(y, innerHeight - 640));
  return (
    <div className="ws-picker" ref={ref} role="menu" aria-label={t(locale, "wsEmptyAdd")} style={{ left, top }}>
      <p className="ws-picker-head">{t(locale, "wsEmptyAdd")}</p>
      {WIN_IDS.map((id) => (
        <button type="button" role="menuitem" key={id} data-add={id} onClick={() => onPick(id)}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="ws-picker-text">
            <strong>{t(locale, `pick_${id}` as "pick_signals")}</strong>
          </span>
          {count(id) ? <span className="ws-picker-n">{count(id)}</span> : null}
        </button>
      ))}
    </div>
  );
}
