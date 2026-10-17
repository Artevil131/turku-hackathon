import { type Locale, t } from "@aei/i18n";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  boardRows,
  COLS,
  clampRect,
  defaultLayout,
  fitLayout,
  type Layout,
  loadLayout,
  MAX_ROWS,
  patchWin,
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

type Drag = {
  kind: "move" | "size" | "sizeX" | "sizeY";
  id: WinId;
  x0: number;
  y0: number;
  rect: { x: number; y: number; w: number; h: number };
  colW: number;
};

export function Workspace({
  locale,
  content,
  onOpened,
  onClosed,
  initiallyOpen,
}: {
  locale: Locale;
  content: Record<WinId, ReactNode>;
  onOpened?: (id: WinId) => void;
  onClosed?: (id: WinId) => void;
  /** Windows to open on mount (a link that names the unit grid). */
  initiallyOpen?: WinId[];
}) {
  const wide = useWide();
  const areaRef = useRef<HTMLDivElement>(null);
  // null = the default layout for the board's height; set once the user changes anything.
  const [saved, setSaved] = useState<Layout | null>(loadLayout);
  const [status, setStatus] = useState("");
  const drag = useRef<Drag | null>(null);
  const focusAfter = useRef<string | null>(null);

  const layout: Layout = fitLayout(saved ?? defaultLayout());

  const update = (fn: (l: Layout) => Layout) => {
    const next = fn(layout);
    setSaved(next);
    saveLayout(next);
  };

  // A link that names a window (the unit grid) opens it once the board is measured.
  const wanted = useRef(initiallyOpen);
  useEffect(() => {
    if (!wanted.current) return;
    const ids = wanted.current.filter((id) => !layout.wins[id].open);
    wanted.current = undefined;
    if (ids.length) update((l) => ids.reduce((acc, id) => raise(patchWin(acc, id, { open: true }), id), l));
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
    update((l) => raise(patchWin(l, id, { open: true }), id));
    onOpened?.(id);
  };
  const toggle = (id: WinId) => (layout.wins[id].open ? close(id) : open(id));
  const reset = () => {
    setSaved(null);
    saveLayout(null);
    setStatus("");
  };
  const focusWin = (id: WinId) => {
    if (layout.order[layout.order.length - 1] !== id) update((l) => raise(l, id));
  };

  const announce = (id: WinId, r: { x: number; y: number; w: number; h: number }) =>
    setStatus(t(locale, "wsStatus", { title: t(locale, TITLE_KEY[id]), x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }));

  const begin = (e: PointerEvent, kind: Drag["kind"], id: WinId) => {
    if (e.button !== 0 || !areaRef.current) return;
    if ((e.target as HTMLElement).closest("button") && kind === "move") return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const w = layout.wins[id];
    drag.current = {
      kind,
      id,
      x0: e.clientX,
      y0: e.clientY,
      rect: { x: w.x, y: w.y, w: w.w, h: w.h },
      colW: areaRef.current.getBoundingClientRect().width / COLS,
    };
    focusWin(id);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.x0) / d.colW);
    const dy = Math.round((e.clientY - d.y0) / ROW_PX);
    const r =
      d.kind === "move"
        ? { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy }
        : { ...d.rect, w: d.rect.w + (d.kind === "sizeY" ? 0 : dx), h: d.rect.h + (d.kind === "sizeX" ? 0 : dy) };
    const next = clampRect(r, d.id, MAX_ROWS);
    const cur = layout.wins[d.id];
    if (next.x === cur.x && next.y === cur.y && next.w === cur.w && next.h === cur.h) return;
    update((l) => patchWin(l, d.id, next));
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d) announce(d.id, layout.wins[d.id]);
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
    update((l) => patchWin(l, id, next));
    announce(id, next);
  };

  const ids = wide ? layout.order : STACK_ORDER;
  const tray = <Tray locale={locale} open={(id) => layout.wins[id].open} onToggle={toggle} onReset={reset} />;

  return (
    <div className="ws" data-float={wide}>
      {wide ? null : <div className="ws-tray-row">{tray}</div>}
      <div className="ws-area" ref={areaRef} style={wide ? { height: boardRows(layout) * ROW_PX } : undefined}>
        {ids.map((id, z) => {
          const w = layout.wins[id];
          if (!w.open) return null;
          const title = t(locale, TITLE_KEY[id]);
          const style = wide ? ({ "--x": w.x, "--y": w.y, "--w": w.w, "--h": w.h, zIndex: z + 1 } as React.CSSProperties) : undefined;
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
              style={style}
              tabIndex={-1}
              aria-label={title}
              onPointerDownCapture={wide ? () => focusWin(id) : undefined}
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
                  <input type="checkbox" checked={open(id)} onChange={() => onToggle(id)} />
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
