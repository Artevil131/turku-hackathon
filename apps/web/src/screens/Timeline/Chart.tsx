import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { addDays, maxDate, minDate, toDayNumber } from "../../model/dates.ts";
import type { Signal } from "../../model/types.ts";
import type { FeedMeta, IsoDate } from "../../feed/types.ts";
import { formatDate, formatMonth, formatNumber, formatShare, t, type Locale } from "../../i18n/index.ts";
import { SeverityBadge } from "../../ui/Badge.tsx";
import { unitName } from "../../ui/defaults.ts";
import { Icon } from "../../ui/Icon.tsx";
import { Sheet } from "../../ui/Sheet.tsx";
import { MIN_ISOLATES } from "../../ui/ShareBar.tsx";
import { packSegments, type Lane, type Packed, type WeeklyView } from "./aggregate.ts";
import { GlyphMark, KindGlyph, SEVERITY_FILL } from "./Glyph.tsx";
import { basisText, institutionLabel, signalTitle, signalWhen, signalWhere, Summary } from "./words.tsx";

/*
  The timeline chart: x = weeks from the feed's first to its last day; one row
  per lane. Built by hand in SVG. The static layer (bars, heat strips, segments,
  NOW, the hatched future) is memoised; hover, the keyboard cursor and the
  selection are drawn on a light overlay so pointer moves never redraw it all.
*/

const AXIS_H = 34;
const FOOT_H = 26;
const PAD_L = 6;
const PAD_R = 16;
const FLAG_TOP = 10;
const FLAG_H = 28;
const BAR_TOP = FLAG_TOP + FLAG_H + 10;
const BAR_H = 52;
const ALL_H = BAR_TOP + BAR_H + 8;
const GROUP_H = 26;
const LANE_MIN = 40;
const SEG_H = 14;
const TRACK_GAP = 4;
const LANE_PAD = 7;
const MIN_SEG = 14;
const POP_W = 340;

export interface Group {
  institution: string | null;
  codes: string[];
}

type Row =
  | { kind: "all"; key: string; y: number; h: number; label: string }
  | { kind: "group"; key: string; y: number; h: number; label: string }
  | { kind: "unit" | "hospital"; key: string; y: number; h: number; label: string; sub?: string; lane: Lane | null; packed: Packed[]; tracks: number };

type LaneRow = Extract<Row, { kind: "unit" | "hospital" }>;
type CursorRow = Exclude<Row, { kind: "group" }>;

type Pinned =
  | { type: "signal"; id: string; x: number; y: number; byKey: boolean }
  | { type: "week"; week: number; row: number; x: number; y: number; byKey: boolean };

interface Hit {
  week: number;
  row: number; // index into cursorRows, -1 = none
  signal: Signal | null;
  x: number;
  y: number;
}

function niceCeil(v: number): number {
  const step = v <= 0.1 ? 0.02 : v <= 0.3 ? 0.05 : 0.1;
  return Math.max(step, Math.ceil(v / step) * step);
}

export function TimelineChart({
  locale,
  meta,
  view,
  groups,
  signals,
  desktop,
  highlight,
  onSeek,
  onOpenSignal,
}: {
  locale: Locale;
  meta: FeedMeta;
  view: WeeklyView;
  groups: Group[];
  signals: readonly Signal[];
  desktop: boolean;
  /** A signal to ring (e.g. the list item under the pointer). */
  highlight: string | null;
  onSeek: (date: IsoDate) => void;
  onOpenSignal: (id: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width > 0 && width < 640;
  const labelW = narrow ? 112 : 188;
  const W = view.weeks.length;
  const minCol = narrow ? 6 : 5;
  const colW = width ? Math.max(minCol, (width - labelW - PAD_L - PAD_R - 2) / W) : minCol;
  const plotW = PAD_L + W * colW + PAD_R;
  const k = colW / 7;
  const day0 = toDayNumber(view.weeks[0]!.start);
  const xNow = Math.max(0, (view.nowDay + 1) * k);
  const xEnd = W * colW;

  // ---------- Rows and segment layout (depends on width) ----------
  const { rows, height } = useMemo(() => {
    const xOfDay = (iso: IsoDate, end: boolean) => (toDayNumber(iso) - day0 + (end ? 1 : 0)) * k;
    const laneByCode = new Map(view.lanes.map((l) => [l.code, l]));
    const byLane = new Map<string | null, Signal[]>();
    const known = new Set(groups.flatMap((g) => g.codes));
    for (const s of signals) {
      const key = s.ward && known.has(s.ward) ? s.ward : null;
      const list = byLane.get(key);
      if (list) list.push(s);
      else byLane.set(key, [s]);
    }
    const out: Row[] = [];
    let y = AXIS_H;
    out.push({ kind: "all", key: "all", y, h: ALL_H, label: t(locale, "timeline.lane.all") });
    y += ALL_H;
    const laneRow = (kind: "unit" | "hospital", key: string, label: string, list: Signal[], lane: Lane | null, sub?: string): LaneRow => {
      const { items, tracks } = packSegments(list, xOfDay, MIN_SEG, xNow);
      const h = Math.max(LANE_MIN, LANE_PAD * 2 + tracks * SEG_H + Math.max(0, tracks - 1) * TRACK_GAP);
      return { kind, key, y, h, label, sub, lane, packed: items, tracks };
    };
    for (const g of groups) {
      out.push({ kind: "group", key: `g:${g.institution ?? ""}`, y, h: GROUP_H, label: institutionLabel(locale, g.institution) });
      y += GROUP_H;
      for (const code of g.codes) {
        const row = laneRow("unit", code, unitName(locale, meta, code), byLane.get(code) ?? [], laneByCode.get(code) ?? null);
        out.push(row);
        y += row.h;
      }
    }
    y += 10;
    const hosp = laneRow("hospital", "hospital", t(locale, "timeline.lane.hospital"), byLane.get(null) ?? [], null, t(locale, "timeline.lane.hospitalSub"));
    out.push(hosp);
    y += hosp.h;
    return { rows: out, height: y + FOOT_H };
  }, [view, groups, signals, k, day0, xNow, locale, meta]);

  const cursorRows = useMemo(() => rows.filter((r): r is CursorRow => r.kind !== "group"), [rows]);
  const signalById = useMemo(() => new Map(signals.map((s) => [s.id, s])), [signals]);

  // ---------- Static layer ----------
  const flagScale = useMemo(() => {
    let max = 0;
    view.flag.forEach((f, w) => {
      if (w <= view.nowWeek && f.n >= MIN_ISOLATES) max = Math.max(max, f.flagged / f.n);
    });
    return niceCeil(max);
  }, [view]);

  const staticLayer = useMemo(() => {
    const parts: ReactNode[] = [];
    const gap = colW >= 4 ? 1 : 0;
    const contentBottom = height - FOOT_H;

    // Month axis and year lines.
    const first = view.weeks[0]!.start;
    let m = `${first.slice(0, 7)}-01`;
    if (m < first) m = addMonthIso(m);
    const last = view.weeks[W - 1]!.end;
    const ticks: ReactNode[] = [];
    let i = 0;
    while (m <= last && i < 600) {
      const x = (toDayNumber(m) - day0) * k;
      const month = Number(m.slice(5, 7));
      const isYear = month === 1 || i === 0;
      ticks.push(<line key={`t${m}`} x1={x} x2={x} y1={AXIS_H - 6} y2={AXIS_H} className="timeline-tick" />);
      if (isYear) {
        ticks.push(
          <text key={`y${m}`} x={x + 3} y={AXIS_H - 20} className="timeline-axis-year">
            {m.slice(0, 4)}
          </text>,
        );
        if (month === 1) ticks.push(<line key={`yl${m}`} x1={x} x2={x} y1={AXIS_H} y2={contentBottom} className="timeline-yearline" />);
      }
      if (month % 3 === 1 && colW * 4.3 * 3 >= 40) {
        ticks.push(
          <text key={`m${m}`} x={x + 3} y={AXIS_H - 8} className="timeline-axis-month">
            {formatMonth(locale, m, false).replace(".", "")}
          </text>,
        );
      }
      m = addMonthIso(m);
      i++;
    }
    parts.push(<g key="axis">{ticks}</g>);

    for (const row of rows) {
      if (row.kind === "group") {
        parts.push(<line key={row.key} x1={0} x2={xEnd} y1={row.y + row.h - 0.5} y2={row.y + row.h - 0.5} className="timeline-groupline" />);
        continue;
      }
      if (row.kind === "all") {
        // Results per week (bars) and, in its own band above, the share with a resistance flag.
        const bars: ReactNode[] = [];
        const base = row.y + BAR_TOP + BAR_H;
        for (let w = 0; w <= view.nowWeek && w < W; w++) {
          const n = view.total[w]!;
          if (n === 0 || view.maxTotal === 0) continue;
          const h = Math.max(1.5, (n / view.maxTotal) * BAR_H);
          const x = w * colW + gap / 2;
          const bw = Math.max(1, Math.min(colW - gap, xNow - x));
          const partial = view.weeks[w]!.released < 7;
          bars.push(<rect key={w} x={x} y={base - h} width={bw} height={h} rx={Math.min(1.5, bw / 2)} className={partial ? "timeline-bar is-partial" : "timeline-bar"} />);
        }
        parts.push(<line key="base" x1={0} x2={xNow} y1={base + 0.5} y2={base + 0.5} className="timeline-baseline" />);
        parts.push(<g key="bars">{bars}</g>);
        const fTop = row.y + FLAG_TOP;
        parts.push(<line key="fbase" x1={0} x2={xNow} y1={fTop + FLAG_H + 0.5} y2={fTop + FLAG_H + 0.5} className="timeline-gridline" />);
        let d = "";
        let pen = false;
        let lastPt: [number, number] | null = null;
        for (let w = 0; w <= view.nowWeek && w < W; w++) {
          const f = view.flag[w]!;
          if (f.n < MIN_ISOLATES) {
            pen = false;
            continue;
          }
          const released = view.weeks[w]!.released;
          const x = Math.min(xNow, w * colW + (colW * Math.min(7, released)) / 14);
          const y = fTop + FLAG_H - (f.flagged / f.n / flagScale) * FLAG_H;
          d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
          pen = true;
          lastPt = [x, y];
        }
        if (d) parts.push(<path key="flag" d={d} className="timeline-flagline" />);
        if (lastPt) parts.push(<circle key="flagdot" cx={lastPt[0]} cy={lastPt[1]} r={2.6} className="timeline-flagdot" />);
        parts.push(<line key={`sep-${row.key}`} x1={0} x2={xEnd} y1={row.y + row.h - 0.5} y2={row.y + row.h - 0.5} className="timeline-laneline" />);
        continue;
      }
      // Unit lanes: heat strip of weekly volume.
      if (row.kind === "unit" && row.lane) {
        const cells: ReactNode[] = [];
        for (let w = 0; w <= view.nowWeek && w < W; w++) {
          const v = row.lane.heat[w]!;
          if (v <= 0) continue;
          const x = w * colW;
          const bw = Math.min(colW - gap, xNow - x);
          if (bw <= 0) continue;
          cells.push(<rect key={w} x={x} y={row.y + 3} width={bw} height={row.h - 6} fillOpacity={0.1 + 0.62 * v} className="timeline-heat" />);
        }
        parts.push(<g key={`h-${row.key}`}>{cells}</g>);
      }
      parts.push(<line key={`sep-${row.key}`} x1={0} x2={xEnd} y1={row.y + row.h - 0.5} y2={row.y + row.h - 0.5} className="timeline-laneline" />);
      // Signal segments.
      const segs: ReactNode[] = [];
      const stackH = row.tracks * SEG_H + Math.max(0, row.tracks - 1) * TRACK_GAP;
      const top0 = row.y + (row.h - stackH) / 2;
      for (const p of row.packed) {
        const y = top0 + p.track * (SEG_H + TRACK_GAP);
        const w = p.x2 - p.x1;
        segs.push(
          <g key={p.signal.id} className={`timeline-seg is-${p.signal.severity}`}>
            <rect x={p.x1} y={y} width={w} height={SEG_H} rx={SEG_H / 2} fill={SEVERITY_FILL[p.signal.severity]} className="timeline-seg-body" />
            <GlyphMark kind={p.signal.kind} x={p.x1 + SEG_H / 2} y={y + SEG_H / 2} color="var(--surface)" />
          </g>,
        );
      }
      parts.push(<g key={`s-${row.key}`}>{segs}</g>);
    }

    // Not yet arrived: hatched, nothing drawn or computed in it.
    if (xEnd - xNow > 0.5) {
      parts.push(<rect key="future" x={xNow} y={AXIS_H} width={xEnd - xNow + PAD_R / 2} height={contentBottom - AXIS_H} fill={`url(#${uid}-hatch)`} className="timeline-future" />);
      const label = t(locale, "timeline.notYet");
      const lw = label.length * 6.4 + 20;
      if (xEnd - xNow > lw + 16) {
        const cx = xNow + Math.min((xEnd - xNow) / 2, 16 + lw / 2 + 40);
        parts.push(
          <g key="futurelabel" className="timeline-future-label">
            <rect x={cx - lw / 2} y={AXIS_H + ALL_H / 2 - 11} width={lw} height={22} rx={11} />
            <text x={cx} y={AXIS_H + ALL_H / 2 + 4} textAnchor="middle">
              {label}
            </text>
          </g>,
        );
      }
    }

    // NOW.
    if (view.nowWeek >= 0) {
      const label = `${t(locale, "timeline.now")} · ${formatDate(locale, view.asOf)}`;
      const lw = label.length * 6.6 + 18;
      const px = Math.min(Math.max(lw / 2, xNow), plotW - PAD_L - lw / 2);
      parts.push(
        <g key="now" className="timeline-now">
          <line x1={xNow} x2={xNow} y1={AXIS_H - 4} y2={contentBottom} />
          <rect x={px - lw / 2} y={2} width={lw} height={20} rx={10} />
          <text x={px} y={16} textAnchor="middle">
            {label}
          </text>
        </g>,
      );
    }
    return parts;
  }, [rows, view, colW, k, day0, xNow, xEnd, plotW, height, W, flagScale, locale, uid]);

  // ---------- Interaction state ----------
  const [hover, setHover] = useState<Hit | null>(null);
  const [cursor, setCursor] = useState<{ week: number; row: number } | null>(null);
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [scrollX, setScrollX] = useState(0);
  const [nowInView, setNowInView] = useState(true);
  const [scrollable, setScrollable] = useState(false);
  const autoScroll = useRef(false);
  const follow = useRef(true);
  const didInit = useRef(false);

  const nowVisible = useCallback(
    (el: HTMLDivElement) => {
      const x = labelW + PAD_L + xNow - el.scrollLeft;
      return x >= labelW + 4 && x <= el.clientWidth - 4;
    },
    [labelW, xNow],
  );

  const scrollToX = useCallback(
    (plotX: number, at: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const vis = el.clientWidth - labelW;
      const target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, Math.round(PAD_L + plotX - vis * at)));
      if (Math.abs(target - el.scrollLeft) >= 1) {
        autoScroll.current = true;
        el.scrollLeft = target;
      }
      setScrollX(el.scrollLeft);
    },
    [labelW],
  );

  const syncScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollable(el.scrollWidth > el.clientWidth + 2);
    setNowInView(nowVisible(el));
  }, [nowVisible]);

  // Start at NOW; keep NOW in view while the simulation moves, unless the user scrolled away.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !width) return;
    if (!didInit.current) {
      didInit.current = true;
      scrollToX(xNow, 0.72);
    } else if (follow.current && !nowVisible(el)) {
      scrollToX(xNow, 0.72);
    }
    syncScrollState();
  }, [width, xNow, scrollToX, nowVisible, syncScrollState]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollX(el.scrollLeft);
    if (autoScroll.current) autoScroll.current = false;
    else follow.current = nowVisible(el);
    setNowInView(nowVisible(el));
    setHover(null);
  }, [nowVisible]);

  // ---------- Hit testing ----------
  const hitAt = useCallback(
    (x: number, y: number, touch: boolean): Hit => {
      const week = Math.max(0, Math.min(W - 1, Math.floor(x / colW)));
      let rowIndex = -1;
      let signal: Signal | null = null;
      for (let r = 0; r < cursorRows.length; r++) {
        const row = cursorRows[r]!;
        if (y < row.y || y >= row.y + row.h) continue;
        rowIndex = r;
        if (row.kind === "unit" || row.kind === "hospital") {
          const stackH = row.tracks * SEG_H + Math.max(0, row.tracks - 1) * TRACK_GAP;
          const top0 = row.y + (row.h - stackH) / 2;
          const tol = touch ? 8 : 3;
          let best: { s: Signal; d: number } | null = null;
          for (const p of row.packed) {
            const sy = top0 + p.track * (SEG_H + TRACK_GAP);
            if (x < p.x1 - tol || x > p.x2 + tol) continue;
            if (y < sy - (touch ? 6 : 3) || y > sy + SEG_H + (touch ? 6 : 3)) continue;
            const d = Math.abs(y - (sy + SEG_H / 2)) + (x < p.x1 ? p.x1 - x : x > p.x2 ? x - p.x2 : 0);
            if (!best || d < best.d) best = { s: p.signal, d };
          }
          signal = best?.s ?? null;
        }
        break;
      }
      return { week, row: rowIndex, signal, x, y };
    },
    [W, colW, cursorRows],
  );

  const pointFrom = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left - PAD_L, y: e.clientY - rect.top };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") return;
    const { x, y } = pointFrom(e);
    if (y < AXIS_H - 6 || y > height - FOOT_H || x < 0 || x > xEnd) {
      setHover(null);
      return;
    }
    setHover(hitAt(x, y, false));
  };

  const segmentAnchor = (s: Signal): { x: number; y: number } | null => {
    for (const row of cursorRows) {
      if (row.kind !== "unit" && row.kind !== "hospital") continue;
      const p = row.packed.find((q) => q.signal.id === s.id);
      if (!p) continue;
      const stackH = row.tracks * SEG_H + Math.max(0, row.tracks - 1) * TRACK_GAP;
      const top0 = row.y + (row.h - stackH) / 2;
      return { x: Math.min(p.x2, Math.max(p.x1, p.x1 + 10)), y: top0 + p.track * (SEG_H + TRACK_GAP) + SEG_H };
    }
    return null;
  };

  const openHit = (hit: Hit, byKey: boolean) => {
    if (hit.signal) {
      const a = segmentAnchor(hit.signal) ?? { x: hit.x, y: hit.y };
      setPinned({ type: "signal", id: hit.signal.id, x: a.x, y: a.y, byKey });
      return;
    }
    const row = cursorRows[hit.row];
    const y = row ? row.y + row.h : hit.y;
    setPinned({ type: "week", week: hit.week, row: Math.max(0, hit.row), x: (hit.week + 0.5) * colW, y, byKey });
  };

  const onClick = (e: ReactPointerEvent<SVGSVGElement>) => {
    const { x, y } = pointFrom(e);
    if (x < 0 || x > xEnd + PAD_R / 2 || y < AXIS_H - 6 || y > height - FOOT_H) return;
    const hit = hitAt(Math.min(x, xEnd - 0.01), y, e.pointerType !== "mouse");
    setHover(null);
    if (cursor) setCursor({ week: hit.week, row: Math.max(0, hit.row) });
    openHit(hit, false);
  };

  // ---------- Keyboard ----------
  const signalsInCell = useCallback(
    (week: number, rowIndex: number): Signal[] => {
      const wk = view.weeks[week];
      const row = cursorRows[rowIndex];
      if (!wk || !row) return [];
      const overlaps = (s: Signal) => s.firstDate <= wk.end && s.lastDate >= wk.start;
      if (row.kind === "all") return signals.filter(overlaps);
      return row.packed.map((p) => p.signal).filter(overlaps);
    },
    [view.weeks, cursorRows, signals],
  );

  const ensureVisible = (week: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const x = PAD_L + week * colW;
    const vis = el.clientWidth - labelW;
    const left = el.scrollLeft;
    if (x < left + 16) {
      autoScroll.current = true;
      el.scrollLeft = Math.max(0, x - 16);
    } else if (x + colW > left + vis - 16) {
      autoScroll.current = true;
      el.scrollLeft = x + colW - vis + 16;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const cur = cursor ?? { week: Math.max(0, view.nowWeek), row: 0 };
    let next = cur;
    switch (e.key) {
      case "ArrowRight":
        next = { ...cur, week: Math.min(W - 1, cur.week + (e.shiftKey ? 4 : 1)) };
        break;
      case "ArrowLeft":
        next = { ...cur, week: Math.max(0, cur.week - (e.shiftKey ? 4 : 1)) };
        break;
      case "ArrowDown":
        next = { ...cur, row: Math.min(cursorRows.length - 1, cur.row + 1) };
        break;
      case "ArrowUp":
        next = { ...cur, row: Math.max(0, cur.row - 1) };
        break;
      case "PageDown":
        next = { ...cur, week: Math.min(W - 1, cur.week + 13) };
        break;
      case "PageUp":
        next = { ...cur, week: Math.max(0, cur.week - 13) };
        break;
      case "Home":
        next = { ...cur, week: 0 };
        break;
      case "End":
        next = { ...cur, week: Math.max(0, view.nowWeek) };
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        setCursor(cur);
        const inCell = signalsInCell(cur.week, cur.row);
        const row = cursorRows[cur.row];
        const only = inCell.length === 1 && row?.kind !== "all" ? inCell[0]! : null;
        openHit({ week: cur.week, row: cur.row, signal: only, x: (cur.week + 0.5) * colW, y: row ? row.y + row.h / 2 : AXIS_H }, true);
        return;
      }
      case "Escape":
        if (pinned) {
          e.preventDefault();
          setPinned(null);
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    setCursor(next);
    ensureVisible(next.week);
  };

  // ---------- Popover lifecycle ----------
  const closePinned = useCallback(() => {
    // Focus goes back to the chart when it was in the popover (or the popover was opened from the keyboard).
    const inside = popRef.current?.contains(document.activeElement) ?? false;
    setPinned((p) => {
      if (p?.byKey || inside) window.setTimeout(() => scrollRef.current?.focus({ preventScroll: true }), 0);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pinned || !desktop) return;
    popRef.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".timeline-svg")) return;
      setPinned(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned, desktop]);

  // A pinned signal that is gone after a rewind closes by itself.
  useEffect(() => {
    if (pinned?.type === "signal" && !signalById.has(pinned.id)) setPinned(null);
  }, [pinned, signalById]);

  // ---------- Words ----------
  const rowLabel = (row: CursorRow | undefined) => (row ? row.label : "");
  const cellText = (week: number, rowIndex: number): string => {
    const wk = view.weeks[week];
    const row = cursorRows[rowIndex];
    if (!wk || !row) return "";
    const date = formatDate(locale, wk.start, "long");
    if (wk.released === 0) return t(locale, "timeline.cursor.future", { lane: rowLabel(row), date });
    const count = formatNumber(locale, row.kind === "unit" ? (row.lane?.counts[week] ?? 0) : view.total[week]!);
    let text =
      wk.released < 7
        ? t(locale, "timeline.cursor.partial", { lane: rowLabel(row), date, days: wk.released, count })
        : t(locale, "timeline.cursor.week", { lane: rowLabel(row), date, count });
    if (row.kind === "all") {
      const f = view.flag[week]!;
      if (f.n >= MIN_ISOLATES) text += ` ${t(locale, "timeline.cursor.flag", { value: formatShare(locale, f.flagged / f.n) })}`;
    }
    const inCell = signalsInCell(week, rowIndex);
    if (inCell.length)
      text += ` ${t(locale, "timeline.cursor.signals", {
        list: inCell.map((s) => `${signalTitle(locale, s)} (${t(locale, `common.severity.${s.severity}`)})`).join(", "),
      })}`;
    return text;
  };
  const liveText = cursor ? cellText(cursor.week, cursor.row) : "";

  // ---------- Overlay ----------
  const overlay: ReactNode[] = [];
  const contentBottom = height - FOOT_H;
  const markWeek = (week: number, cls: string, label: boolean) => {
    const wk = view.weeks[week];
    if (!wk) return;
    overlay.push(<rect key={`col-${cls}`} x={week * colW} y={AXIS_H} width={colW} height={contentBottom - AXIS_H} className={`timeline-col ${cls}`} />);
    if (label) {
      const text = formatDate(locale, wk.start);
      const lw = text.length * 6.6 + 16;
      const cx = Math.min(Math.max(lw / 2, (week + 0.5) * colW), plotW - PAD_L - lw / 2);
      overlay.push(
        <g key={`lbl-${cls}`} className={`timeline-collabel ${cls}`}>
          <rect x={cx - lw / 2} y={contentBottom + 3} width={lw} height={20} rx={10} />
          <text x={cx} y={contentBottom + 17} textAnchor="middle">
            {text}
          </text>
        </g>,
      );
    }
  };
  if (hover && !pinned) markWeek(hover.week, "is-hover", !cursor);
  if (cursor) {
    markWeek(cursor.week, "is-cursor", true);
    const row = cursorRows[cursor.row];
    if (row) overlay.push(<rect key="cell" x={cursor.week * colW - 1} y={row.y + 1} width={colW + 2} height={row.h - 3} rx={3} className="timeline-cell" />);
  }
  if (pinned?.type === "week") {
    const row = cursorRows[pinned.row];
    overlay.push(<rect key="pcol" x={pinned.week * colW} y={AXIS_H} width={colW} height={contentBottom - AXIS_H} className="timeline-col is-pinned" />);
    if (row) overlay.push(<rect key="pcell" x={pinned.week * colW - 1} y={row.y + 1} width={colW + 2} height={row.h - 3} rx={3} className="timeline-cell" />);
  }
  const ringIds = new Set<string>();
  if (highlight) ringIds.add(highlight);
  if (pinned?.type === "signal") ringIds.add(pinned.id);
  if (hover?.signal && !pinned) ringIds.add(hover.signal.id);
  if (ringIds.size) {
    for (const row of cursorRows) {
      if (row.kind !== "unit" && row.kind !== "hospital") continue;
      const stackH = row.tracks * SEG_H + Math.max(0, row.tracks - 1) * TRACK_GAP;
      const top0 = row.y + (row.h - stackH) / 2;
      for (const p of row.packed) {
        if (!ringIds.has(p.signal.id)) continue;
        const y = top0 + p.track * (SEG_H + TRACK_GAP);
        overlay.push(<rect key={`ring-${p.signal.id}`} x={p.x1 - 3} y={y - 3} width={p.x2 - p.x1 + 6} height={SEG_H + 6} rx={(SEG_H + 6) / 2} className="timeline-ring" />);
      }
    }
  }

  // ---------- Popover content ----------
  const pinnedSignal = pinned?.type === "signal" ? (signalById.get(pinned.id) ?? null) : null;
  const hoverSignal = !pinned && hover?.signal ? hover.signal : null;

  const signalBody = (s: Signal) => {
    const still = s.lastDate === view.asOf && s.firstDate !== s.lastDate;
    return (
      <div className="timeline-detail">
        <p className="timeline-detail-sum">
          <Summary locale={locale} meta={meta} signal={s} />
        </p>
        <dl className="timeline-detail-dl">
          <div>
            <dt>{t(locale, "timeline.detail.where")}</dt>
            <dd>{signalWhere(locale, meta, s)}</dd>
          </div>
          <div>
            <dt>{t(locale, "timeline.detail.when")}</dt>
            <dd className="u-num">
              {signalWhen(locale, s)}
              {still ? <span className="u-muted"> · {t(locale, "timeline.detail.still", { date: formatDate(locale, s.lastDate) })}</span> : null}
            </dd>
          </div>
        </dl>
        <p className="u-small u-muted u-num">{basisText(locale, s)}</p>
      </div>
    );
  };

  const signalHead = (s: Signal) => (
    <div className="timeline-pop-head">
      <KindGlyph kind={s.kind} severity={s.severity} size={22} />
      <div className="timeline-pop-titles">
        <p className="timeline-pop-title">{signalTitle(locale, s)}</p>
        <SeverityBadge locale={locale} severity={s.severity} size="sm" />
      </div>
    </div>
  );

  const replayDate = (s: Signal) => maxDate(meta.start, addDays(s.firstDate, -1));

  const signalActions = (s: Signal) => (
    <div className="timeline-pop-actions">
      <button
        type="button"
        className="k-btn is-primary"
        onClick={() => {
          setPinned(null);
          onOpenSignal(s.id);
        }}
      >
        {t(locale, "timeline.detail.open")}
        <Icon name="arrow-right" size={18} />
      </button>
      <button
        type="button"
        className="k-btn is-sim-ghost"
        title={t(locale, "timeline.detail.replayHint")}
        onClick={() => {
          setPinned(null);
          onSeek(replayDate(s));
        }}
      >
        <Icon name="refresh" size={16} />
        {t(locale, "timeline.detail.replay", { date: formatDate(locale, replayDate(s)) })}
      </button>
    </div>
  );

  const weekParts = (week: number, rowIndex: number) => {
    const wk = view.weeks[week]!;
    const row = cursorRows[rowIndex];
    const from = maxDate(wk.start, meta.start);
    const to = minDate(wk.end, meta.end);
    const future = wk.released === 0;
    const isNow = week === view.nowWeek;
    const goingBack = from < view.asOf && !isNow;
    const count = row?.kind === "unit" ? (row.lane?.counts[week] ?? 0) : view.total[week]!;
    const f = view.flag[week]!;
    const inCell = signalsInCell(week, rowIndex);
    const title = t(locale, "timeline.week.title", { date: formatDate(locale, from, "long") });
    const body = (
      <div className="timeline-detail">
        <p className="u-small u-muted u-num">{t(locale, "timeline.week.range", { from: formatDate(locale, from), to: formatDate(locale, to, "long") })}</p>
        {future ? (
          <p className="u-small">{t(locale, "timeline.week.future")}</p>
        ) : (
          <dl className="timeline-detail-dl">
            <div>
              <dt>{row?.kind === "unit" ? row.label : t(locale, "timeline.lane.all")}</dt>
              <dd className="u-num">
                {t(locale, "timeline.week.results", { count: formatNumber(locale, count) })}
                {wk.released < 7 ? <span className="u-muted"> · {t(locale, "timeline.week.partial", { days: wk.released })}</span> : null}
              </dd>
            </div>
            {row?.kind !== "unit" ? (
              <div>
                <dt>{t(locale, "timeline.lane.flag")}</dt>
                <dd className="u-num">
                  {f.n >= MIN_ISOLATES
                    ? t(locale, "timeline.week.flag", { value: formatShare(locale, f.flagged / f.n) })
                    : t(locale, "timeline.week.flagFew", { n: formatNumber(locale, f.n) })}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
        {!future ? (
          inCell.length ? (
            <div className="u-stack-sm">
              <p className="u-eyebrow">{t(locale, "timeline.week.signals")}</p>
              <ul className="timeline-pop-list">
                {inCell.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="timeline-pop-item"
                      onClick={() => {
                        setPinned(null);
                        onOpenSignal(s.id);
                      }}
                    >
                      <KindGlyph kind={s.kind} severity={s.severity} size={18} />
                      <span className="timeline-pop-item-text">
                        <span className="u-strong">{signalTitle(locale, s)}</span>
                        <span className="u-muted"> · {signalWhere(locale, meta, s)}</span>
                      </span>
                      <span className="u-sr">{t(locale, `common.severity.${s.severity}`)}</span>
                      <Icon name="chevron-right" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              {inCell.length > 6 ? <p className="u-xs u-muted">{t(locale, "common.toast.more", { count: inCell.length - 6 })}</p> : null}
            </div>
          ) : (
            <p className="u-small u-muted">{t(locale, "timeline.week.none")}</p>
          )
        ) : null}
        {isNow ? <p className="u-small u-muted">{t(locale, "timeline.week.isNow")}</p> : goingBack ? <p className="u-small u-muted">{t(locale, "timeline.week.past")}</p> : null}
      </div>
    );
    const actions = (
      <div className="timeline-pop-actions">
        <button
          type="button"
          className="k-btn is-sim"
          disabled={from === view.asOf}
          onClick={() => {
            setPinned(null);
            onSeek(from);
          }}
        >
          <Icon name="skip" size={16} />
          {t(locale, "timeline.week.jump", { date: formatDate(locale, from) })}
        </button>
        {to !== from ? (
          <button
            type="button"
            className="k-btn is-sim-ghost"
            disabled={to === view.asOf}
            onClick={() => {
              setPinned(null);
              onSeek(to);
            }}
          >
            {t(locale, "timeline.week.jumpEnd", { date: formatDate(locale, to) })}
          </button>
        ) : null}
      </div>
    );
    return { title, body, actions };
  };

  // Position of a floating box anchored at a plot point.
  const scroller = scrollRef.current;
  const place = (ax: number, ay: number, w: number) => {
    const offTop = scroller?.offsetTop ?? 0;
    const offLeft = scroller?.offsetLeft ?? 0;
    const wrapW = wrapRef.current?.clientWidth ?? width;
    const cx = offLeft + labelW + PAD_L + ax - scrollX;
    const left = Math.max(8, Math.min(wrapW - w - 8, cx - w / 2));
    const above = ay > height * 0.6;
    return { left, top: offTop + ay + (above ? -10 : 8), above };
  };

  let floating: ReactNode = null;
  let sheet: ReactNode = null;
  if (pinned) {
    let head: ReactNode;
    let body: ReactNode;
    let actions: ReactNode;
    let title: string;
    if (pinned.type === "signal" && pinnedSignal) {
      title = signalTitle(locale, pinnedSignal);
      head = signalHead(pinnedSignal);
      body = signalBody(pinnedSignal);
      actions = signalActions(pinnedSignal);
    } else if (pinned.type === "week") {
      const p = weekParts(pinned.week, pinned.row);
      title = p.title;
      head = <p className="timeline-pop-title">{p.title}</p>;
      body = p.body;
      actions = p.actions;
    } else {
      title = "";
    }
    if (title) {
      if (desktop) {
        const pos = place(pinned.x, pinned.y, POP_W);
        floating = (
          <div
            ref={popRef}
            className={`timeline-pop${pos.above ? " is-above" : ""}`}
            style={{ left: pos.left, top: pos.top, width: POP_W }}
            role="dialog"
            aria-label={title}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closePinned();
              }
            }}
          >
            <div className="timeline-pop-top">
              {head}
              <button type="button" className="k-iconbtn is-sm" onClick={closePinned} aria-label={t(locale, "timeline.detail.close")}>
                <Icon name="close" size={18} />
              </button>
            </div>
            {body}
            {actions}
          </div>
        );
      } else {
        sheet = (
          <Sheet
            open
            onClose={closePinned}
            title={title}
            locale={locale}
            size="sm"
            tone={pinned.type === "week" ? "sim" : "default"}
            footer={actions}
            subtitle={pinned.type === "signal" && pinnedSignal ? signalWhere(locale, meta, pinnedSignal) : undefined}
          >
            {pinned.type === "signal" && pinnedSignal ? (
              <div className="u-row">
                <KindGlyph kind={pinnedSignal.kind} severity={pinnedSignal.severity} size={22} />
                <SeverityBadge locale={locale} severity={pinnedSignal.severity} size="sm" />
              </div>
            ) : null}
            {body}
          </Sheet>
        );
      }
    }
  } else if (hover && desktop) {
    // A light, non-interactive tooltip; a click pins the full popover.
    const pos = place(hover.signal ? (segmentAnchor(hover.signal)?.x ?? hover.x) : (hover.week + 0.5) * colW, hover.signal ? (segmentAnchor(hover.signal)?.y ?? hover.y) : hover.y + 14, 300);
    floating = (
      <div className={`timeline-tip${pos.above ? " is-above" : ""}`} style={{ left: pos.left, top: pos.top, width: 300 }} aria-hidden="true">
        {hoverSignal ? (
          <>
            {signalHead(hoverSignal)}
            <p className="timeline-detail-sum">
              <Summary locale={locale} meta={meta} signal={hoverSignal} />
            </p>
            <p className="u-xs u-muted u-num">
              {signalWhere(locale, meta, hoverSignal)} · {signalWhen(locale, hoverSignal)}
            </p>
          </>
        ) : (
          <>
            <p className="u-small u-num">{cellText(hover.week, hover.row < 0 ? 0 : hover.row)}</p>
            <p className="u-xs timeline-tip-sim">{t(locale, "timeline.week.jump", { date: formatDate(locale, maxDate(view.weeks[hover.week]!.start, meta.start)) })}</p>
          </>
        )}
      </div>
    );
  }

  // ---------- Labels (sticky column) ----------
  const labels = rows.map((row) => {
    const style = { top: row.y, height: row.h };
    const active = cursor && cursorRows[cursor.row]?.key === row.key;
    if (row.kind === "group")
      return (
        <div key={row.key} className="timeline-label is-group" style={style} title={row.label}>
          <span className="u-eyebrow">{row.label}</span>
        </div>
      );
    if (row.kind === "all")
      return (
        <div key={row.key} className={`timeline-label is-all${active ? " is-active" : ""}`} style={style}>
          <span className="timeline-label-name">{row.label}</span>
          <span className="timeline-label-sub" style={{ top: FLAG_TOP + 10 }}>
            <svg width="14" height="6" aria-hidden="true">
              <line x1="0" x2="14" y1="3" y2="3" className="timeline-flagline" />
            </svg>
            {t(locale, "timeline.lane.flag")}
            <span className="u-num"> {t(locale, "timeline.lane.flagScale", { max: formatShare(locale, flagScale) })}</span>
          </span>
          <span className="timeline-label-sub" style={{ top: BAR_TOP + BAR_H / 2 - 6 }}>
            <span className="timeline-swatch is-bar" aria-hidden="true" />
            {t(locale, "timeline.lane.results")}
            <span className="u-num"> {t(locale, "timeline.lane.max", { count: formatNumber(locale, view.maxTotal) })}</span>
          </span>
        </div>
      );
    return (
      <div key={row.key} className={`timeline-label is-lane${active ? " is-active" : ""}`} style={style} title={row.label}>
        <span className="timeline-label-name">{row.label}</span>
        {row.sub ? <span className="timeline-label-note">{row.sub}</span> : null}
      </div>
    );
  });

  const hintText = desktop ? t(locale, "timeline.chart.clickHint") : t(locale, "timeline.chart.tapHint");

  return (
    <div className="timeline-chart" ref={wrapRef}>
      <div className="timeline-chart-bar">
        <p className="u-small u-muted">{hintText}</p>
        {scrollable ? (
          <div className="timeline-chart-tools">
            {!desktop ? (
              <span className="timeline-scrollhint u-xs" aria-hidden="true">
                <Icon name="chevron-left" size={14} />
                {t(locale, "timeline.chart.scroll")}
                <Icon name="chevron-right" size={14} />
              </span>
            ) : null}
            {!nowInView ? (
              <button
                type="button"
                className="k-btn is-secondary is-sm"
                onClick={() => {
                  follow.current = true;
                  scrollToX(xNow, 0.72);
                  syncScrollState();
                }}
              >
                {t(locale, "timeline.chart.toNow")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={`timeline-scrollbox${scrollable ? " is-scrollable" : ""}`}>
      <div
        className="timeline-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        role="application"
        aria-label={t(locale, "timeline.chart.label", {
          start: formatDate(locale, meta.start, "long"),
          end: formatDate(locale, meta.end, "long"),
          now: formatDate(locale, view.asOf, "long"),
        })}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target !== e.currentTarget) return;
          let keyboard = true;
          try {
            keyboard = e.currentTarget.matches(":focus-visible");
          } catch {
            /* older browsers: assume keyboard */
          }
          if (keyboard && !cursor) setCursor({ week: Math.max(0, view.nowWeek), row: 0 });
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && (popRef.current?.contains(next) || e.currentTarget.contains(next))) return;
          if (!pinned) setCursor(null);
        }}
      >
        <div className="timeline-canvas" style={{ width: labelW + plotW, height }}>
          <div className="timeline-labels" style={{ width: labelW, height }} aria-hidden="true">
            {labels}
          </div>
          <svg
            className="timeline-svg"
            width={plotW}
            height={height}
            viewBox={`${-PAD_L} 0 ${plotW} ${height}`}
            aria-hidden="true"
            focusable="false"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => onClick(e as unknown as ReactPointerEvent<SVGSVGElement>)}
          >
            <defs>
              <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" className="timeline-hatch-bg" />
                <line x1="0" y1="0" x2="0" y2="7" className="timeline-hatch-line" />
              </pattern>
            </defs>
            {staticLayer}
            <g className="timeline-overlay">{overlay}</g>
          </svg>
        </div>
      </div>
      </div>
      <p className="u-sr" aria-live="polite" aria-atomic="true">
        {liveText}
      </p>
      {floating}
      {sheet}
    </div>
  );
}

function addMonthIso(iso: IsoDate): IsoDate {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}
