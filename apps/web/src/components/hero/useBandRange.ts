import { type Locale, t } from "@aei/i18n";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { dayNumber, isoFromDay } from "./geometry.ts";

// A chosen stretch of weeks on the band, for the research tools to work on. The range lives in
// the URL as `from` (a week's first day) and `to` (that last week's last day, never past the
// clock). Here the band's x axis is mapped to week starts, and a drag becomes a range.

export interface BandRange {
  from: string;
  to: string;
}

/** The band's horizontal scale, as WeeklyBand's `build` draws it. */
export interface BandGeom {
  gutter: number;
  right: number;
  /** First day of the drawn window. */
  d0: number;
  /** The clock's date as a day number: the axis ends after it. */
  asOfDay: number;
  /** A week start the band uses (its first row); every week start is this plus a multiple of 7. */
  anchor: number;
}

const span = (g: BandGeom) => Math.max(7, g.asOfDay + 1 - g.d0);
const plotW = (g: BandGeom) => Math.max(40, g.right - g.gutter);

/** The day under x (fractional), unclamped. */
export const dayAtX = (g: BandGeom, x: number) => g.d0 + ((x - g.gutter) / plotW(g)) * span(g);

/** The x of a day, clamped to the plot, like the band's own `xOf`. */
export const xAtDay = (g: BandGeom, day: number) => g.gutter + Math.min(1, Math.max(0, (day - g.d0) / span(g))) * plotW(g);

/** The start of the week that holds `day`. */
export const weekStartOf = (g: BandGeom, day: number) => g.anchor + Math.floor((day - g.anchor) / 7) * 7;

/** The week start under x; a pointer past either end of the plot gives the first or last week. */
export function weekAtX(g: BandGeom, x: number): number {
  const day = Math.min(g.asOfDay, Math.max(g.d0, Math.floor(dayAtX(g, x))));
  return weekStartOf(g, day);
}

/** The range from two week starts in any order: `to` is the later week's last day, capped at the clock. */
export function snapRange(g: BandGeom, a: number, b: number): BandRange {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { from: isoFromDay(lo), to: isoFromDay(Math.min(hi + 6, Math.max(g.asOfDay, lo))) };
}

/** The first and last week starts a range covers. */
export function rangeWeeks(g: BandGeom, r: BandRange): [number, number] {
  return [weekStartOf(g, dayNumber(r.from)), weekStartOf(g, dayNumber(r.to))];
}

/** Where the range is drawn: clamped to the plot, with which ends the window cuts off. */
export function rangeX(g: BandGeom, r: BandRange): { x0: number; x1: number; clipL: boolean; clipR: boolean } {
  const f = dayNumber(r.from);
  const t = dayNumber(r.to) + 1;
  return { x0: xAtDay(g, f), x1: xAtDay(g, t), clipL: f < g.d0, clipR: t > g.asOfDay + 1 };
}

/** The range moved by whole weeks, kept between the window's first week and the clock's week. */
export function moveRange(g: BandGeom, r: BandRange, weeks: number): BandRange {
  const [a, b] = rangeWeeks(g, r);
  const lo = weekStartOf(g, g.d0);
  const hi = weekStartOf(g, g.asOfDay);
  const shift = Math.min(hi - b, Math.max(lo - a, weeks * 7));
  return snapRange(g, a + shift, b + shift);
}

/** Shift+arrow: the last week moves by one, never before the first. */
export function stretchRange(g: BandGeom, r: BandRange, dir: -1 | 1): BandRange {
  const [a, b] = rangeWeeks(g, r);
  const hi = weekStartOf(g, g.asOfDay);
  return snapRange(g, a, Math.min(hi, Math.max(a, b + dir * 7)));
}

/** Whole weeks a range spans. */
export const rangeWeekCount = (r: BandRange) => Math.max(1, Math.ceil((dayNumber(r.to) - dayNumber(r.from) + 1) / 7));

/** "2 Apr – 30 Apr" (English) or "2.4. – 30.4." (Finnish); the year is added when the ends differ in it. */
export function rangeEnds(locale: Locale, r: BandRange): { from: string; to: string } {
  const year = r.from.slice(0, 4) !== r.to.slice(0, 4);
  const fmt = new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-GB", {
    day: "numeric",
    month: locale === "fi" ? "numeric" : "short",
    year: year ? "numeric" : undefined,
    timeZone: "UTC",
  });
  const d = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));
  return { from: d(r.from), to: d(r.to) };
}

export function rangeText(locale: Locale, r: BandRange): string {
  const { from, to } = rangeEnds(locale, r);
  return `${from} – ${to}`;
}

/** "Selected: 2 Apr – 30 Apr · 4 weeks". */
export function rangeSentence(locale: Locale, r: BandRange): string {
  const n = rangeWeekCount(r);
  const weeks = n === 1 ? t(locale, "tlRangeOneWeek") : t(locale, "tlLyWeeks", { n });
  return t(locale, "tlRangeSelected", { ...rangeEnds(locale, r), weeks });
}

/** A range from the hash, or null unless both ends are dates in order. */
export function parseRange(from: string | null, to: string | null): BandRange | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !iso.test(from) || !iso.test(to) || from > to) return null;
  if (Number.isNaN(dayNumber(from)) || Number.isNaN(dayNumber(to))) return null;
  return { from, to };
}

type Grip = { kind: "new"; anchor: number } | { kind: "edge"; anchor: number } | { kind: "move"; base: BandRange };

/** Presses on these keep their own meaning. */
const OWN_PRESS = ".hs-pill, .hs-leg, .hs-lane-hit, .hs-lane-label, .hs-range-x";
const SLOP = 4;

/**
 * Pointer handling for the range: a drag on the week area draws one, a drag on an edge resizes it,
 * a drag inside moves it. A press that does not travel stays a plain click. While dragging, the
 * shown range is the draft; it is handed to `onRange` on release.
 */
export function useBandRange(opts: {
  svg: RefObject<SVGSVGElement | null>;
  geom: BandGeom | null;
  /** Bottom of the area a drag can start in. */
  bottom: number;
  range: BandRange | null;
  onRange?: (r: BandRange | null) => void;
  enabled: boolean;
}) {
  const { svg, geom, bottom, range, enabled } = opts;
  const [draft, setDraft] = useState<BandRange | null>(null);
  const live = useRef(opts);
  live.current = opts;
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const localX = (clientX: number) => clientX - (svg.current?.getBoundingClientRect().left ?? 0);

  /** What a press at x would grab: an edge, the inside, or nothing (a new range). */
  const zone = (x: number, touch: boolean): "from" | "to" | "inside" | null => {
    if (!geom || !range) return null;
    const { x0, x1 } = rangeX(geom, range);
    const near = touch ? 12 : 6;
    if (Math.abs(x - x0) <= near && Math.abs(x - x0) <= Math.abs(x - x1)) return "from";
    if (Math.abs(x - x1) <= near) return "to";
    return x > x0 && x < x1 ? "inside" : null;
  };

  /** Mouse only: the cursor says what a press would do. */
  const onHover = (e: PointerEvent) => {
    const el = svg.current;
    if (!el || draft || e.pointerType !== "mouse") return;
    const target = e.target as Element;
    const y = e.clientY - el.getBoundingClientRect().top;
    const z = !enabled || target.closest(OWN_PRESS) || y > bottom ? null : zone(localX(e.clientX), false);
    el.style.cursor = z === "from" || z === "to" ? "ew-resize" : z === "inside" ? "grab" : "";
  };

  /** Returns true when the press belongs to the range. */
  const onDown = (e: PointerEvent): boolean => {
    const el = svg.current;
    if (!enabled || !geom || !el || e.button !== 0 || (e.target as Element).closest(OWN_PRESS)) return false;
    const box = el.getBoundingClientRect();
    const x0 = e.clientX - box.left;
    const y = e.clientY - box.top;
    if (y > bottom || x0 < geom.gutter - 2 || x0 > geom.right + 2) return false;
    const z = zone(x0, e.pointerType !== "mouse");
    let grip: Grip;
    if (range && (z === "from" || z === "to")) {
      const [a, b] = rangeWeeks(geom, range);
      grip = { kind: "edge", anchor: z === "from" ? b : a };
    } else if (range && z === "inside") grip = { kind: "move", base: range };
    else grip = { kind: "new", anchor: weekAtX(geom, x0) };
    const id = e.pointerId;
    let moving = false;
    let last: BandRange | null = null;

    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== id) return;
      const g = live.current.geom;
      if (!g) return;
      const x = ev.clientX - box.left;
      if (!moving) {
        if (Math.abs(x - x0) < SLOP) return;
        moving = true;
        try {
          el.setPointerCapture(id);
        } catch {}
      }
      ev.preventDefault();
      last =
        grip.kind === "move"
          ? moveRange(g, grip.base, Math.round((dayAtX(g, x) - dayAtX(g, x0)) / 7))
          : snapRange(g, grip.anchor, weekAtX(g, x));
      setDraft((d) => (d && last && d.from === last.from && d.to === last.to ? d : last));
    };
    const end = (commit: boolean) => (ev?: globalThis.PointerEvent) => {
      if (ev && ev.pointerId !== id) return;
      cleanup();
      setDraft(null);
      if (!moving) return;
      // The click that follows a drag must not reach a pill or lane under the pointer.
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      if (commit && last) live.current.onRange?.(last);
    };
    const up = end(true);
    const cancel = end(false);
    const key = (k: KeyboardEvent) => {
      if (k.key !== "Escape") return;
      k.stopPropagation();
      cancel();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      stop.current = null;
    };
    stop.current?.();
    stop.current = cleanup;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    return true;
  };

  return { shown: draft ?? range, dragging: draft !== null, onDown, onHover };
}
