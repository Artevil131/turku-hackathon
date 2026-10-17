import { type Locale, t } from "@aei/i18n";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { chartTitle } from "../charts/model.ts";
import type { ChartSpec } from "../charts/spec.ts";
import {
  addChart,
  boardRows,
  CHART_MIN_SIZE,
  COLS,
  clampRect,
  compactLayout,
  defaultLayout,
  fillLayout,
  fitLayout,
  focusLayout,
  isChartId,
  type Layout,
  loadFocus,
  loadLayout,
  MAX_ROWS,
  MIN_SIZE,
  type Preset,
  patchWin,
  presetLayout,
  ROW_PX,
  raise,
  removeChart,
  saveFocus,
  saveLayout,
  WIN_IDS,
  type WinId,
  winOf,
  withCharts,
} from "./layout.ts";
import "./workspace.css";

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
} as const;

/** A request to add a chart window: a new `key` adds `spec`. */
export interface ChartRequest {
  key: number;
  spec: ChartSpec;
}

/** The stacked order under 1100 px: the list first, the map last (as before). */
const STACK_ORDER: readonly WinId[] = ["signals", "notebook", "math", "assistant", "map", "graph", "grid", "reproduce"];

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

function useWide(): boolean {
  const query = "(min-width: 1100px)";
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    on();
    return () => mq.removeEventListener("change", on);
  }, []);
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

export function Workspace({
  locale,
  content,
  onOpened,
  onClosed,
  initiallyOpen,
  reveal,
  toolbar,
  overlay,
  primary = null,
  answers = [],
  lead,
  chartRequest = null,
  chartContent,
  chartMenu,
  rail,
  revealRail,
}: {
  locale: Locale;
  content: Record<WinId, ReactNode>;
  onOpened?: (id: WinId) => void;
  onClosed?: (id: WinId) => void;
  /** Windows to open on mount (a link that names the unit grid). */
  initiallyOpen?: WinId[];
  /** A window to bring forward (opening it if closed) each time `key` changes: the card on a new signal, the map on "Show on map". */
  reveal?: { id: WinId; key: string | null };
  /** Extra controls for the toolbar row (the project switcher and export). */
  toolbar?: ReactNode;
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
  const wide = useWide();
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
  const [saved, setSaved] = useState<Layout | null>(loadLayout);
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
  const base: Layout = compactLayout(fitLayout(draft ?? saved ?? defaultLayout()));
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
  // Position changes animate, but not the first placement.
  useEffect(() => {
    if (areaW <= 0 || animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [areaW, animate]);

  const commit = (next: Layout, moved?: string) => {
    const c = fillLayout(compactLayout(fitLayout(next), moved), moved);
    setSaved(c);
    saveLayout(c);
    return c;
  };
  const update = (fn: (l: Layout) => Layout, moved?: string) => commit(fn(base), moved);

  // Focus mode: remembered apart from the layout, so it survives a reload but never rewrites the user's grid.
  const titleOf = (id: string): string => {
    const c = layout.charts[id] ?? base.charts[id];
    return c ? chartTitle(locale, c, null) : t(locale, TITLE_KEY[id as WinId]);
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
    update((l) => patchWin(l, id, { open: false }));
    onClosed?.(id as WinId);
  };
  const open = (id: WinId) => {
    focusAfter.current = `ws-win-${id}`;
    update((l) => raise(patchWin(l, id, { open: true }), id), id);
    // While focused, an opened window is the one to look at.
    if (focus && focus !== id) setFocusTo(id);
    onOpened?.(id);
  };
  const toggle = (id: WinId) => (base.wins[id].open ? close(id) : open(id));
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
    saveLayout(l);
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
    </div>
  );
  // The focus bar: the focused window's title, the other windows as a rail of titles, and the way back.
  const focusBar = focused ? (
    <div className="ws-focusbar" role="group" aria-label={t(locale, "wsFocusOn")}>
      <span className="ws-layouts-label">{t(locale, "wsFocusOn")}</span>
      <strong className="ws-focusbar-current">{titleOf(focused)}</strong>
      <span className="ws-focusbar-rail">
        {[...WIN_IDS, ...Object.keys(base.charts)]
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
    saveLayout(keep);
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
      const min = isChartId(d.id) ? CHART_MIN : MIN_SIZE[d.id as WinId];
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
  const ids: readonly string[] = wide ? [...WIN_IDS, ...chartIds] : [...STACK_ORDER, ...chartIds];
  const tray = <Tray locale={locale} open={(id) => base.wins[id].open} onToggle={toggle} onReset={reset} chartMenu={chartMenu} />;
  const roleOf = (id: string): "primary" | "answer" | "quiet" | undefined =>
    primary === null ? undefined : id === primary ? "primary" : answers.includes(id as WinId) ? "answer" : "quiet";
  const place = (r: Rect): CSSProperties => ({
    transform: `translate3d(${r.x * colW}px,${r.y * ROW_PX}px,0)`,
    width: r.w * colW,
    height: r.h * ROW_PX,
  });

  return (
    <div className="ws" data-float={wide} data-animate={animate} data-focus={focused !== null} data-selection={primary !== null}>
      {wide ? null : <div className="ws-tray-row">{tray}</div>}
      {wide ? (
        <div className="ws-toolbar">
          {focusBar ?? layouts}
          {rail ? (
            <button
              type="button"
              className="ws-tool-open"
              aria-pressed={railOpen}
              aria-keyshortcuts="T"
              title={`${t(locale, railOpen ? "toolsRailHide" : "toolsRailShow")} · T`}
              onClick={() => toggleRail()}
            >
              {t(locale, "toolsWindow")}
            </button>
          ) : null}
          {toolbar}
        </div>
      ) : null}
      {rail ? (
        <div className="ws-dock" hidden={!railOpen}>
          {rail}
        </div>
      ) : null}
      {/* A double-click on the empty board (not on a window) shows or hides the tool rail. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the keyboard has T and the toolbar button. */}
      <div
        className="ws-area"
        ref={areaRef}
        style={wide ? { height: boardRows(layout) * ROW_PX } : undefined}
        onDoubleClick={rail ? (e) => e.target === e.currentTarget && toggleRail() : undefined}
      >
        {wide && dragging ? <div className="ws-ghost" aria-hidden="true" style={place(winOf(layout, dragging))} /> : null}
        {ids.map((id) => {
          const w = winOf(layout, id);
          if (!w.open) return null;
          const chart = layout.charts[id];
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
                {lead?.[id as WinId] ? <p className="ws-lead">{lead[id as WinId]}</p> : null}
                <div className="ws-body">{chart ? chartContent?.(id, chart) : content[id as WinId]}</div>
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
                  <span>{t(locale, TITLE_KEY[id])}</span>
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
