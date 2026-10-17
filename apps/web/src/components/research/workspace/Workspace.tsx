import { type Locale, t } from "@aei/i18n";
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  closeWindow,
  defaultLayout,
  equalize,
  fitLayout,
  type Layout,
  locate,
  MIN_BODY,
  maximizeWindow,
  migrateLayout,
  minWindowHeight,
  moveWindow,
  type Preset,
  presetLayout,
  reopenWindow,
  resizeColumns,
  resizeStack,
  type Slot,
  STORAGE_KEY,
  serializeLayout,
  WIN_IDS,
  type WinId,
} from "./layout.ts";
import "./workspace.css";

const TITLE_KEY = {
  signals: "boardFeed",
  map: "boardGeo",
  graph: "boardGraph",
  math: "boardMath",
  assistant: "boardAssistant",
  grid: "boardGrid",
} as const;
const STACK_ORDER: readonly WinId[] = ["signals", "math", "assistant", "map", "graph", "grid"];
const PRESETS = ["default", "map", "signals", "units"] as const;
const PRESET_KEY = { default: "wsDefault", map: "wsMap", signals: "wsSignals", units: "wsUnits" } as const;
function loadLayout(): Layout {
  try {
    return migrateLayout(localStorage.getItem(STORAGE_KEY));
  } catch {
    return defaultLayout();
  }
}
function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeLayout(layout));
  } catch {
    /* Blocked storage: keep the session usable. */
  }
}
function useWide() {
  const [wide, setWide] = useState(() => typeof matchMedia === "function" && matchMedia("(min-width: 1100px)").matches);
  useEffect(() => {
    const mq = matchMedia("(min-width: 1100px)");
    const change = () => setWide(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return wide;
}
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Reorders and reveals animate as one View Transition where the browser has one; otherwise they apply at once. */
function viewChange(update: () => void) {
  if (typeof document.startViewTransition !== "function" || reducedMotion()) {
    update();
    return;
  }
  // flushSync keeps the state update inside the transition's snapshot.
  document.startViewTransition(() => flushSync(update));
}
type Move = { kind: "move"; id: WinId; x: number; y: number; active: boolean; slot: Slot | null; top: number };
type Resize = {
  kind: "column" | "stack";
  column: number;
  index: number;
  origin: number;
  span: number;
  minimum: number | [number, number];
  base: Layout;
  last: Layout;
};
type Gesture = Move | Resize;
type Drop = { slot: Slot; top: number };

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
  initiallyOpen?: WinId[];
  /** Opens `id` from the tray, without moving focus, whenever `key` changes to a new value. */
  reveal?: { id: WinId; key: string | null };
}) {
  const wide = useWide();
  const [layout, setLayout] = useState<Layout>(() => (initiallyOpen ?? []).reduce(reopenWindow, loadLayout()));
  // Windows render only once the stored layout is fitted to the measured board, so none mounts squashed.
  const [fitted, setFitted] = useState(false);
  const [draft, setDraft] = useState<Layout | null>(null);
  const [moving, setMoving] = useState<{ id: WinId; x: number; y: number } | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [status, setStatus] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const focusAfter = useRef<string | null>(null);
  const shown = draft ?? layout;
  const title = (id: WinId) => t(locale, TITLE_KEY[id]);
  const commit = (next: Layout) => {
    setLayout(next);
    saveLayout(next);
  };
  /** Layout changes that reorder or reveal windows: animated as one view transition. */
  const reflow = (next: Layout) => viewChange(() => commit(next));
  const keep = useRef(initiallyOpen ?? []);
  useLayoutEffect(() => {
    if (fitted) return;
    const height = area.current?.clientHeight ?? 0;
    if (wide && height > 0) setLayout((l) => fitLayout(l, height, keep.current));
    setFitted(true);
  }, [fitted, wide]);
  const boardHeight = () => (wide && area.current?.clientHeight) || Number.POSITIVE_INFINITY;
  const revealed = useRef(reveal?.key ?? null);
  useEffect(() => {
    if (!reveal || reveal.key === revealed.current) return;
    revealed.current = reveal.key;
    if (reveal.key === null || !layout.closed[reveal.id]) return;
    reflow(reopenWindow(layout, reveal.id));
    onOpened?.(reveal.id);
  });
  /** Per-window floors for the two windows beside a stack splitter, as fractions of the stack. */
  const stackMinimum = (column: number, index: number, span: number): [number, number] => {
    const windows = layout.columns[column]?.windows ?? [];
    const floor = (id: WinId | undefined) => Math.max(0.16, id ? minWindowHeight(id) / Math.max(1, span) : 0);
    return [floor(windows[index]?.id), floor(windows[index + 1]?.id)];
  };
  const cancel = useCallback(() => {
    gesture.current = null;
    root.current?.removeAttribute("data-resizing");
    setDraft(null);
    setMoving(null);
    setDrop(null);
  }, []);
  useEffect(() => {
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current) {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [cancel]);
  useEffect(() => {
    if (!wide) cancel();
  }, [wide, cancel]);
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });
  const announceMove = (next: Layout, id: WinId) => {
    const at = locate(next, id);
    if (at) setStatus(t(locale, "wsStatus", { title: title(id), x: at.column + 1, y: at.index + 1 }));
  };
  const close = (id: WinId) => {
    focusAfter.current = "ws-tray-button";
    reflow(closeWindow(layout, id));
    setStatus(t(locale, "wsClosed", { title: title(id) }));
    onClosed?.(id);
  };
  const open = (id: WinId) => {
    focusAfter.current = `ws-title-${id}`;
    reflow(reopenWindow(layout, id));
    onOpened?.(id);
  };
  const preset = (p: Preset) => {
    cancel();
    focusAfter.current = "ws-tray-button";
    const next = presetLayout(p, boardHeight());
    for (const id of WIN_IDS) {
      if (locate(layout, id) && !locate(next, id)) onClosed?.(id);
      if (!locate(layout, id) && locate(next, id)) onOpened?.(id);
    }
    reflow(next);
    setStatus(t(locale, "wsPresetApplied", { title: t(locale, PRESET_KEY[p]) }));
  };
  const keyboardMove = (e: KeyboardEvent, id: WinId) => {
    if (!e.altKey || shown.maximized || !wide) return;
    const at = locate(layout, id);
    if (!at) return;
    let slot: Slot;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const column = at.column + (e.key === "ArrowLeft" ? -1 : 1);
      if (column < 0 || column >= layout.columns.length) return;
      slot = { column, index: layout.columns[column]?.windows.length ?? 0 };
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      slot = { column: at.column, index: at.index + (e.key === "ArrowUp" ? -1 : 2) };
    } else return;
    e.preventDefault();
    focusAfter.current = `ws-title-${id}`;
    const next = moveWindow(layout, id, slot);
    commit(next);
    announceMove(next, id);
  };
  const capture = (e: PointerEvent) => {
    e.preventDefault();
    // Capture on the stable board, never on a window that may be reparented on drop.
    area.current?.setPointerCapture(e.pointerId);
  };
  const beginMove = (e: PointerEvent, id: WinId) => {
    if (!wide || shown.maximized || e.button !== 0) return;
    capture(e);
    e.currentTarget instanceof HTMLElement && e.currentTarget.focus();
    gesture.current = { kind: "move", id, x: e.clientX, y: e.clientY, active: false, slot: null, top: 0 };
  };
  const beginResize = (e: PointerEvent, kind: Resize["kind"], column: number, index: number) => {
    if (e.button !== 0 || !area.current) return;
    e.preventDefault();
    // Splitters stay mounted; capturing here preserves their double-click target.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).focus();
    const el = kind === "column" ? area.current : area.current.querySelector<HTMLElement>(`[data-column-index="${column}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const count = kind === "column" ? layout.columns.length : (layout.columns[column]?.windows.length ?? 1);
    const span = (kind === "column" ? rect.width : rect.height) - (count - 1) * 8;
    gesture.current = {
      kind,
      column,
      index,
      origin: kind === "column" ? e.clientX : e.clientY,
      span,
      minimum: kind === "column" ? Math.min(1 / count, Math.max(0.18, 240 / span)) : stackMinimum(column, index, span),
      base: layout,
      last: layout,
    };
    // Dock transitions stay off while the pointer drags (see workspace.css).
    root.current?.setAttribute("data-resizing", "true");
  };
  const hitSlot = (x: number, y: number): Drop | null => {
    const board = area.current;
    if (!board) return null;
    const bounds = board.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
    const columns = [...board.querySelectorAll<HTMLElement>(".ws-column")];
    for (const [i, col] of columns.entries()) {
      const r = col.getBoundingClientRect();
      if (layout.columns.length < 3 && Math.abs(x - r.left) < 20) return { slot: { column: i, index: 0, newColumn: true }, top: 0 };
      if (layout.columns.length < 3 && i === columns.length - 1 && Math.abs(x - r.right) < 20)
        return { slot: { column: i + 1, index: 0, newColumn: true }, top: 0 };
      if (x < r.left - 4 || x > r.right + 4) continue;
      const windows = [...col.querySelectorAll<HTMLElement>(".ws-win")];
      for (const [j, win] of windows.entries()) {
        const w = win.getBoundingClientRect();
        // The marker sits in the column's scrolled content, so offsets include its scroll.
        if (y < w.top + w.height / 2) return { slot: { column: i, index: j }, top: Math.max(2, w.top - r.top + col.scrollTop - 4) };
      }
      return { slot: { column: i, index: windows.length }, top: Math.max(2, col.scrollHeight - 4) };
    }
    return null;
  };
  const pointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "move") {
      if (!g.active && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return;
      g.active = true;
      const target = hitSlot(e.clientX, e.clientY);
      g.slot = target?.slot ?? null;
      g.top = target?.top ?? 0;
      setDrop(target);
      setMoving({ id: g.id, x: e.clientX, y: e.clientY });
    } else {
      const delta = ((g.kind === "column" ? e.clientX : e.clientY) - g.origin) / g.span;
      g.last =
        g.kind === "column" ? resizeColumns(g.base, g.index, delta, g.minimum) : resizeStack(g.base, g.column, g.index, delta, g.minimum);
      setDraft(g.last);
    }
  };
  const pointerUp = (e: PointerEvent) => {
    pointerMove(e);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "move") {
      if (g.active && g.slot) {
        const next = moveWindow(layout, g.id, g.slot);
        focusAfter.current = `ws-title-${g.id}`;
        commit(next);
        announceMove(next, g.id);
      }
    } else commit(g.last);
    cancel();
  };
  const splitter = (column: number, index: number, vertical: boolean) => {
    const values = vertical ? shown.columns.map((c) => c.width) : (shown.columns[column]?.windows.map((w) => w.size) ?? []);
    const value = values[index] ?? 0.5;
    const reset = () => commit(equalize(layout, vertical ? undefined : column));
    return (
      <div
        className={`ws-splitter ${vertical ? "ws-splitter-col" : "ws-splitter-row"}`}
        role="separator"
        tabIndex={0}
        aria-orientation={vertical ? "vertical" : "horizontal"}
        aria-label={t(locale, vertical ? "wsColumnResize" : "wsStackResize")}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={t(locale, "wsSplitterHint")}
        onPointerDown={(e) => beginResize(e, vertical ? "column" : "stack", column, index)}
        onDoubleClick={reset}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Home") {
            e.preventDefault();
            reset();
            return;
          }
          const sign = vertical ? { ArrowLeft: -1, ArrowRight: 1 }[e.key] : { ArrowUp: -1, ArrowDown: 1 }[e.key];
          if (!sign) return;
          e.preventDefault();
          const el = vertical ? area.current : area.current?.querySelector<HTMLElement>(`[data-column-index="${column}"]`);
          const span = Math.max(1, ((vertical ? el?.clientWidth : el?.clientHeight) ?? 1) - (values.length - 1) * 8);
          commit(
            vertical
              ? resizeColumns(layout, index, sign * 0.03, Math.min(1 / values.length, Math.max(0.18, 240 / span)))
              : resizeStack(layout, column, index, sign * 0.03, stackMinimum(column, index, span)),
          );
        }}
      />
    );
  };
  // Never raise/reparent a window on pointerdown or focus: that swallowed the old close button's click.
  const renderWindow = (id: WinId, size = 1) => (
    <section
      key={id}
      id={`ws-win-${id}`}
      className="ws-win"
      data-win={id}
      data-dragging={moving?.id === id}
      data-min-body={MIN_BODY[id]}
      hidden={!!shown.maximized && shown.maximized !== id}
      style={{ flexGrow: shown.maximized ? 1 : size, "--ws-min": `${minWindowHeight(id)}px` } as CSSProperties}
      aria-label={title(id)}
    >
      <header className="ws-header">
        <button
          type="button"
          className="ws-title"
          id={`ws-title-${id}`}
          title={t(locale, "wsMoveHint")}
          onPointerDown={(e) => beginMove(e, id)}
          onKeyDown={(e) => keyboardMove(e, id)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M5 3v10M10 3v10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 2" />
          </svg>
          <span>{title(id)}</span>
        </button>
        <button
          type="button"
          className="ws-action ws-maximize"
          aria-label={t(locale, shown.maximized === id ? "wsRestore" : "wsMaximize", { title: title(id) })}
          title={t(locale, shown.maximized === id ? "wsRestore" : "wsMaximize", { title: title(id) })}
          onClick={() => {
            focusAfter.current = `ws-title-${id}`;
            reflow(maximizeWindow(layout, id));
          }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d={shown.maximized === id ? "M5 3h8v8M3 5h8v8H3z" : "M3 3h10v10H3z"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
        <button
          type="button"
          className="ws-action ws-close"
          aria-label={t(locale, "wsClose", { title: title(id) })}
          title={t(locale, "wsClose", { title: title(id) })}
          onClick={() => close(id)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="ws-body">{content[id]}</div>
    </section>
  );
  return (
    <div className="ws" ref={root} data-docked={wide}>
      <div className="ws-toolbar">
        {/* Ready-made layouts, one click each; the tray keeps the per-window switches. */}
        <div className="ws-layouts" role="group" aria-label={t(locale, "wsPresets")}>
          <span className="ws-layouts-label">{t(locale, "wsPresets")}</span>
          <div className="seg">
            {PRESETS.map((p) => (
              <button type="button" key={p} data-preset={p} onClick={() => preset(p)}>
                {t(locale, PRESET_KEY[p])}
              </button>
            ))}
          </div>
        </div>
        <Tray locale={locale} layout={layout} onToggle={(id) => (locate(layout, id) ? close(id) : open(id))} onPreset={preset} />
      </div>
      <div
        className="ws-area"
        ref={area}
        data-maximized={!!shown.maximized}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        {wide && !fitted
          ? null
          : wide
            ? shown.columns.map((col, ci) => (
                <Fragment key={col.id}>
                  {ci && !shown.maximized ? splitter(ci, ci - 1, true) : null}
                  <div
                    className="ws-column"
                    data-column-index={ci}
                    style={{ flexGrow: shown.maximized ? 1 : col.width }}
                    hidden={!!shown.maximized && !col.windows.some((w) => w.id === shown.maximized)}
                  >
                    {col.windows.map((w, wi) => (
                      <Fragment key={w.id}>
                        {wi && !shown.maximized ? splitter(ci, wi - 1, false) : null}
                        {renderWindow(w.id, w.size)}
                      </Fragment>
                    ))}
                    {drop && !drop.slot.newColumn && drop.slot.column === ci ? (
                      <div className="ws-insert" style={{ top: drop.top }} />
                    ) : null}
                  </div>
                </Fragment>
              ))
            : STACK_ORDER.filter((id) => locate(shown, id)).map((id) => renderWindow(id))}
        {wide && fitted && !shown.columns.length ? <p className="ws-empty">{t(locale, "wsEmptyBoard")}</p> : null}
        {drop?.slot.newColumn ? (
          <div
            className="ws-new-column"
            style={{
              left:
                drop.slot.column === shown.columns.length
                  ? "calc(100% - 24px)"
                  : `${shown.columns.slice(0, drop.slot.column).reduce((s, c) => s + c.width, 0) * 100}%`,
            }}
          >
            {t(locale, "wsNewColumn")}
          </div>
        ) : null}
      </div>
      {moving ? (
        <div className="ws-drag-label" aria-hidden="true" style={{ left: moving.x + 12, top: moving.y + 12 }}>
          {title(moving.id)}
        </div>
      ) : null}
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function Tray({
  locale,
  layout,
  onToggle,
  onPreset,
}: {
  locale: Locale;
  layout: Layout;
  onToggle: (id: WinId) => void;
  onPreset: (p: Preset) => void;
}) {
  const [shown, setShown] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const closed = WIN_IDS.filter((id) => layout.closed[id]);
  const open = WIN_IDS.filter((id) => !layout.closed[id]);
  useEffect(() => {
    if (!shown) return;
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShown(false);
        document.getElementById("ws-tray-button")?.focus();
      }
    };
    const pointer = (e: globalThis.PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setShown(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
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
        onClick={() => setShown((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2 2h12v12H2zM6 2v12M10 2v12" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        {t(locale, "wsToolbar")}
        {closed.length ? <span className="ws-tray-count">· {t(locale, "wsClosedCount", { n: closed.length })}</span> : null}
      </button>
      {shown ? (
        <div className="ws-pop" id="ws-tray-pop" role="group" aria-label={t(locale, "wsToolbar")}>
          {/* Closed windows first: they are what the count on the button promises. */}
          <p className="ws-pop-head">{t(locale, closed.length ? "wsDock" : "wsAllOpen")}</p>
          {closed.length ? (
            <ul className="ws-pop-list">
              {closed.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="ws-pop-open"
                    data-reopen={id}
                    aria-label={t(locale, "wsReopen", { title: t(locale, TITLE_KEY[id]) })}
                    onClick={() => onToggle(id)}
                  >
                    <span>{t(locale, TITLE_KEY[id])}</span>
                    <span className="ws-pop-open-tag" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      {t(locale, "wsOpenAction")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="ws-pop-head">{t(locale, "wsOpenWindows")}</p>
          <ul className="ws-pop-list">
            {open.map((id) => (
              <li key={id}>
                <label className="ws-pop-row">
                  <input type="checkbox" checked data-toggle={id} onChange={() => onToggle(id)} />
                  <span>{t(locale, TITLE_KEY[id])}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ws-presets" role="group" aria-label={t(locale, "wsPresets")}>
            <p>{t(locale, "wsPresets")}</p>
            {PRESETS.map((p) => (
              <button
                type="button"
                data-preset={p}
                key={p}
                onClick={() => {
                  onPreset(p);
                  setShown(false);
                }}
              >
                {t(locale, PRESET_KEY[p])}
              </button>
            ))}
          </div>
          <p className="ws-pop-hint">{t(locale, "wsHint")}</p>
          <button
            type="button"
            className="ws-pop-reset"
            onClick={() => {
              onPreset("default");
              setShown(false);
            }}
          >
            {t(locale, "wsReset")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
