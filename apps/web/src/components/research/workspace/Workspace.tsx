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
import {
  boardRows,
  COLS,
  clampRect,
  compactLayout,
  defaultLayout,
  fitLayout,
  type Layout,
  loadLayout,
  MAX_ROWS,
  MIN_SIZE,
  type Preset,
  patchWin,
  presetLayout,
  ROW_PX,
  raise,
  saveLayout,
  WIN_IDS,
  type WinId,
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

const TITLE_KEY = {
  signals: "boardFeed",
  map: "boardGeo",
  graph: "boardGraph",
  math: "boardMath",
  assistant: "boardAssistant",
  grid: "boardGrid",
} as const;

/** The stacked order under 1100 px: the list first, the map last (as before). */
const STACK_ORDER: readonly WinId[] = ["signals", "math", "assistant", "map", "graph", "grid"];

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

type Drag = {
  kind: "move" | "size" | "sizeX" | "sizeY";
  id: WinId;
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
}: {
  locale: Locale;
  content: Record<WinId, ReactNode>;
  onOpened?: (id: WinId) => void;
  onClosed?: (id: WinId) => void;
  /** Windows to open on mount (a link that names the unit grid). */
  initiallyOpen?: WinId[];
  /** A window to bring forward (opening it if closed) each time `key` changes: the card on a new signal, the map on "Show on map". */
  reveal?: { id: WinId; key: string | null };
}) {
  const wide = useWide();
  const areaRef = useRef<HTMLDivElement>(null);
  // null = the default layout for the board's height; set once the user changes anything.
  const [saved, setSaved] = useState<Layout | null>(loadLayout);
  // The layout previewed while a window is being dragged or resized; committed on release.
  const [draft, setDraft] = useState<Layout | null>(null);
  const [dragging, setDragging] = useState<WinId | null>(null);
  const [areaW, setAreaW] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [status, setStatus] = useState("");
  const drag = useRef<Drag | null>(null);
  const focusAfter = useRef<string | null>(null);

  const layout: Layout = compactLayout(fitLayout(draft ?? saved ?? defaultLayout()));
  const colW = areaW / COLS;

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setAreaW(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Position changes animate, but not the first placement.
  useEffect(() => {
    if (areaW <= 0 || animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [areaW, animate]);

  const commit = (next: Layout, moved?: WinId) => {
    const c = compactLayout(fitLayout(next), moved);
    setSaved(c);
    saveLayout(c);
    return c;
  };
  const update = (fn: (l: Layout) => Layout, moved?: WinId) => commit(fn(layout), moved);

  // A link that names a window (the unit grid) opens it once the board is measured.
  const wanted = useRef(initiallyOpen);
  useEffect(() => {
    if (!wanted.current) return;
    const ids = wanted.current.filter((id) => !layout.wins[id].open);
    wanted.current = undefined;
    if (ids.length) update((l) => ids.reduce((acc, id) => raise(patchWin(acc, id, { open: true }), id), l), ids[0]);
  });

  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    document.getElementById(id)?.focus();
  });

  const close = (id: WinId) => {
    focusAfter.current = "ws-tray-button";
    update((l) => patchWin(l, id, { open: false }));
    onClosed?.(id);
  };
  const open = (id: WinId) => {
    focusAfter.current = `ws-win-${id}`;
    update((l) => raise(patchWin(l, id, { open: true }), id), id);
    onOpened?.(id);
  };
  const toggle = (id: WinId) => (layout.wins[id].open ? close(id) : open(id));
  const revealed = useRef(reveal?.key ?? null);
  useEffect(() => {
    if (!reveal || reveal.key === revealed.current) return;
    revealed.current = reveal.key;
    if (reveal.key === null) return;
    if (!layout.wins[reveal.id].open) open(reveal.id);
    else focusWin(reveal.id);
  });
  const PRESETS: readonly Preset[] = ["default", "map", "signals", "units"];
  const PRESET_KEY = { default: "wsDefault", map: "wsMap", signals: "wsSignals", units: "wsUnits" } as const;
  const applyPreset = (p: Preset) => {
    const l = presetLayout(p);
    setSaved(l);
    saveLayout(l);
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
  const reset = () => {
    setSaved(null);
    saveLayout(null);
    setStatus("");
  };
  const focusWin = (id: WinId) => {
    if (layout.order[layout.order.length - 1] !== id) update((l) => raise(l, id));
  };

  const announce = (id: WinId, r: Rect) =>
    setStatus(t(locale, "wsStatus", { title: t(locale, TITLE_KEY[id]), x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }));

  const begin = (e: PointerEvent, kind: Drag["kind"], id: WinId) => {
    if (e.button !== 0 || !areaRef.current) return;
    if ((e.target as HTMLElement).closest("button") && kind === "move") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    focusWin(id);
    const w = layout.wins[id];
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
      base: layout,
      rect,
      last: rect,
      colW: cw,
      areaW: area,
      el,
      pointer: { x: e.clientX, y: e.clientY },
      raf: null,
    };
    setDraft(layout);
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
      const min = MIN_SIZE[d.id];
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
    announce(d.id, c.wins[d.id]);
  };

  const onHandleKey = (e: KeyboardEvent, id: WinId) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const w = layout.wins[id];
    const r = e.shiftKey
      ? { ...w, x: w.x + (dir[0] as number), y: w.y + (dir[1] as number) }
      : { ...w, w: w.w + (dir[0] as number), h: w.h + (dir[1] as number) };
    const next = clampRect(r, id, MAX_ROWS);
    const c = update((l) => patchWin(l, id, next), id);
    announce(id, c.wins[id]);
  };

  const ids = wide ? layout.order : STACK_ORDER;
  const tray = <Tray locale={locale} open={(id) => layout.wins[id].open} onToggle={toggle} onReset={reset} />;
  const place = (r: Rect): CSSProperties => ({
    transform: `translate3d(${r.x * colW}px,${r.y * ROW_PX}px,0)`,
    width: r.w * colW,
    height: r.h * ROW_PX,
  });

  return (
    <div className="ws" data-float={wide} data-animate={animate}>
      {wide ? null : <div className="ws-tray-row">{tray}</div>}
      {wide ? <div className="ws-toolbar">{layouts}</div> : null}
      <div className="ws-area" ref={areaRef} style={wide ? { height: boardRows(layout) * ROW_PX } : undefined}>
        {wide && dragging ? <div className="ws-ghost" aria-hidden="true" style={place(layout.wins[dragging])} /> : null}
        {ids.map((id, z) => {
          const w = layout.wins[id];
          if (!w.open) return null;
          const title = t(locale, TITLE_KEY[id]);
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
              style={style}
              tabIndex={-1}
              aria-label={title}
              // Raising reorders the DOM; doing it under a button press would swallow that button's click.
              onPointerDownCapture={wide ? (e) => (e.target as Element).closest("button") || focusWin(id) : undefined}
              onFocusCapture={wide ? () => focusWin(id) : undefined}
            >
              <div className="ws-frame">
                <div className="ws-body">{content[id]}</div>
                {wide ? (
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
      {wide ? <div className="ws-rail">{tray}</div> : null}
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
}: {
  locale: Locale;
  open: (id: WinId) => boolean;
  onToggle: (id: WinId) => void;
  onReset: () => void;
}) {
  const [shown, setShown] = useState(false);
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
          <p className="ws-pop-hint">{t(locale, "wsHint")}</p>
          <button type="button" className="ws-pop-reset" onClick={onReset}>
            {t(locale, "wsReset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
