import type { Alert, WeeklyResponse } from "@aei/contract";
import { WARDS, type WardCode } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  bandPath,
  compactDate,
  dayNumber,
  isoFromDay,
  linePath,
  PHENOTYPE_ORDER,
  type Ph,
  type PillKind,
  type Pt,
  pillKind,
  pillLabel,
  pillLine,
  pillWidth,
  runs,
  SURPRISE_CAP,
  surprise,
  type WeekRow,
  weekIndex,
  weekRows,
} from "./geometry.ts";
import { LayersControl } from "./LayersControl.tsx";
import { type Layers, type LineKey, type ViewRow, viewRows, WARD_CODES, windowRows, windowStart } from "./layers.ts";
import "./WeeklyBand.css";

// The hero band: the weekly stream (resistant finds stacked by phenotype, cultures on its own
// scale) over one intensity lane per unit, on an axis that ends at the replay date. Nothing after
// that date is drawn. Alerts sit on their unit's lane as pills that say what caused them.

interface Layout {
  gutter: number;
  height: number;
  legend: number;
  top: number;
  base: number;
  lanes: number;
  pitch: number;
  axis: number;
  /** Bottom of the unit lanes. */
  lanesEnd: number;
}
/** The full band: nine lanes make 218 px; fewer lanes make it shorter. A 15 px pitch keeps a visible gap between 12 px pills in neighbouring lanes. */
const fullLayout = (n: number): Layout => {
  const lanesEnd = 68 + n * 15;
  return { gutter: 46, height: lanesEnd + 15, legend: 14, top: 20, base: 62, lanes: 68, pitch: 15, axis: lanesEnd + 12, lanesEnd };
};
const SMALL: Layout = { gutter: 0, height: 44, legend: 0, top: 3, base: 26, lanes: 0, pitch: 0, axis: 43, lanesEnd: 26 };

const PILL_H = 12;
const READ_W = 276;

interface Props {
  locale: Locale;
  start: string;
  /** The replay date: the right edge of the axis. */
  asOf: string;
  weekly: WeeklyResponse | null;
  alerts: readonly Alert[];
  /** What to show; the default is everything. */
  layers: Layers;
  /** Wide band only: the Layers button. */
  onLayers?: (next: Layers) => void;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  /** Compact strip only: a press on the band. */
  onActivate?: () => void;
}

interface PillPlace {
  /** The latest alert of the pill; a press opens its incident. */
  a: Alert;
  /** Every alert the pill stands for, oldest first (more than one: a run collapsed into "n signals"). */
  members: Alert[];
  kind: PillKind;
  x: number;
  y: number;
  w: number;
  label: string;
  s: number | null;
}

const KIND_RANK: Record<PillKind, number> = { sentinel: 3, cluster: 2, trend: 1, data: 0 };

interface Model {
  rows: ViewRow[];
  full: ViewRow[];
  weekDays: number[];
  xOf: (day: number) => number;
  right: number;
  /** Stacked bands, bottom to top, or one line per visible phenotype when overlaid. */
  layers: { ph: Ph; d: string }[];
  stacked: boolean;
  cultures: string;
  cultureDot: Pt | null;
  partial: {
    x0: number;
    x1: number;
    stacks: { ph: Ph; y: number; h: number }[];
    marks: { ph: Ph; y: number }[];
    dot: Pt | null;
  } | null;
  ymax: number;
  yTop: number;
  cmax: number;
  top: string;
  /** Weeks standing alone between gaps. */
  specks: Pt[];
  lanes: { ward: WardCode; mid: number; path: string }[];
  ticks: { x: number; year: boolean; label: string | null }[];
  pills: PillPlace[];
  dots: { x: number; kind: PillKind; id: string }[];
}

function build(
  L: Layout,
  width: number,
  d0: number,
  asOf: string,
  rows: ViewRow[],
  alerts: readonly Alert[],
  wards: readonly WardCode[],
  layers: Layers,
  locale: Locale,
  compact: boolean,
): Model {
  const dEnd = dayNumber(asOf) + 1;
  const span = Math.max(7, dEnd - d0);
  const right = width - 3;
  const plotW = Math.max(40, right - L.gutter);
  const xOf = (day: number) => L.gutter + Math.min(1, Math.max(0, (day - d0) / span)) * plotW;
  const full = rows.filter((r) => !r.partial);
  const partialRow = rows.find((r) => r.partial);
  const h = L.base - L.top;
  const vis = PHENOTYPE_ORDER.filter((p) => layers.lines[p]);
  const stacked = layers.stacked;

  // Overlaid lines share one scale, so the top is the highest visible line; stacked, the highest total.
  const ymax = Math.max(1, ...full.map((r) => (stacked ? (r.v.total ?? 0) : Math.max(0, ...vis.map((p) => r.v.ph[p] ?? 0)))));
  const cmax = Math.max(1, ...full.map((r) => r.cultures));
  const yv = (v: number) => L.base - (v / ymax) * h * 0.96;
  const yc = (v: number) => L.base - (v / cmax) * h * 0.96;
  const xc = (r: ViewRow) => xOf(r.day + 3.5);

  const cum = (r: ViewRow, k: number) => vis.slice(0, k).reduce((s, p) => s + (r.v.ph[p] ?? 0), 0);
  const bound = (k: number): (Pt | null)[] => full.map((r) => (r.v.total === null ? null : ([xc(r), yv(cum(r, k))] as const)));
  const specks: Pt[] = [];
  const bands: Model["layers"] = [];
  let top = "";
  if (stacked) {
    vis.forEach((ph, k) => {
      const lower = runs(bound(k));
      const d = runs(bound(k + 1))
        .map((u, i) => (u.length > 1 ? bandPath(u, lower[i] ?? []) : ""))
        .join("");
      bands.push({ ph, d });
    });
    if (vis.length)
      for (const run of runs(bound(vis.length))) {
        if (run.length > 1) top += linePath(run);
        else if (run[0]) specks.push(run[0]);
      }
  } else {
    for (const ph of vis) {
      let d = "";
      for (const run of runs(full.map((r) => (r.v.ph[ph] === null ? null : ([xc(r), yv(r.v.ph[ph] ?? 0)] as const))))) {
        if (run.length > 1) d += linePath(run);
        else if (run[0]) specks.push(run[0]);
      }
      bands.push({ ph, d });
    }
  }
  const cultures = layers.lines.cult && full.length > 1 ? linePath(full.map((r) => [xc(r), yc(r.cultures)] as const)) : "";
  const last = full[full.length - 1];
  const cultureDot: Pt | null = layers.lines.cult && full.length === 1 && last ? [xc(last), yc(last.cultures)] : null;

  let partial: Model["partial"] = null;
  if (partialRow) {
    const x0 = xOf(partialRow.day);
    const x1 = right;
    const stacks: { ph: Ph; y: number; h: number }[] = [];
    const marks: { ph: Ph; y: number }[] = [];
    let acc = 0;
    if (!partialRow.hidden)
      for (const p of vis) {
        const v = partialRow.v.ph[p];
        if (v === null) continue;
        if (!stacked) marks.push({ ph: p, y: yv(v) });
        else {
          if (v > 0) stacks.push({ ph: p, y: yv(acc + v), h: Math.max(0.5, yv(acc) - yv(acc + v)) });
          acc += v;
        }
      }
    partial = {
      x0,
      x1: Math.max(x1, x0 + 4),
      stacks,
      marks,
      dot: partialRow.hidden || !layers.lines.cult ? null : [(x0 + x1) / 2, yc(partialRow.cultures)],
    };
  }

  // Unit lanes: a ribbon whose thickness follows the unit's weekly value, one scale for all lanes.
  const umax = Math.max(1, ...full.flatMap((r) => wards.map((c) => r.v.units[c] ?? 0)));
  const half = (v: number) => 0.3 + 4.3 * Math.sqrt(v / umax);
  const laneMid = (i: number) => L.lanes + i * L.pitch + L.pitch / 2;
  const lanes = compact
    ? []
    : wards.map((ward, i) => {
        const mid = laneMid(i);
        let path = "";
        for (const run of runs(full.map((r) => (r.v.units[ward] == null ? null : ([xc(r), r.v.units[ward] as number] as const))))) {
          if (run.length < 2) continue;
          const up = run.map(([x, v]) => [x, mid - half(v)] as const);
          const lo = run.map(([x, v]) => [x, mid + half(v)] as const);
          path += bandPath(up, lo);
        }
        return { ward, mid, path };
      });

  // Axis ticks: Jan 1 (labelled), the other quarters (minor).
  const ticks: Model["ticks"] = [];
  const s0 = new Date(d0 * 86_400_000);
  let y = s0.getUTCFullYear();
  let m = s0.getUTCMonth() + 1;
  for (;;) {
    if (m > 11) {
      m = 0;
      y++;
    }
    const at = Date.UTC(y, m, 1) / 86_400_000;
    if (at >= dEnd) break;
    if (m % 3 === 0) ticks.push({ x: xOf(at), year: m === 0, label: m === 0 ? String(y) : null });
    m++;
  }
  const firstLabel = ticks.find((k) => k.label);
  if (!compact && (!firstLabel || firstLabel.x - L.gutter > 64))
    ticks.unshift({ x: L.gutter, year: false, label: `${s0.getUTCMonth() + 1}.${s0.getUTCFullYear()}` });

  // Alerts: on the unit's lane (full) or as small markers on the axis (compact); hospital-wide ones on the stream.
  const from = isoFromDay(d0);
  const shown = alerts.filter((a) => a.date >= from && a.date <= asOf);
  const pills: PillPlace[] = [];
  const dots: Model["dots"] = [];
  const order = [...shown].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (compact) for (const a of order) dots.push({ x: xOf(dayNumber(a.date) + 0.5), kind: pillKind(a), id: a.id });
  else {
    // One row per lane. A pill that would touch the one before it joins it: the run becomes one "n signals" pill.
    const lanesAlerts = new Map<number, { members: Alert[]; right: number; w: number; label: string }[]>();
    for (const a of order) {
      const lane = a.ward ? wards.indexOf(a.ward) : -1;
      if (a.ward && lane < 0) continue;
      const label = pillLabel(locale, a);
      const w = pillWidth(label, pillKind(a) === "sentinel");
      const edge = Math.max(L.gutter + w, Math.min(xOf(dayNumber(a.date) + 0.5) + 3, right - 1));
      const stack = lanesAlerts.get(lane) ?? [];
      stack.push({ members: [a], right: edge, w, label });
      while (stack.length > 1) {
        const cur = stack[stack.length - 1];
        const prev = stack[stack.length - 2];
        if (!cur || !prev || cur.right - cur.w >= prev.right + 2) break;
        stack.pop();
        const members = [...prev.members, ...cur.members];
        const merged = t(locale, "tlPillSignals", { n: members.length });
        const mw = pillWidth(
          merged,
          members.some((x) => pillKind(x) === "sentinel"),
        );
        // The merged label can be wider than the last pill: keep it clear of the lane labels.
        stack[stack.length - 1] = { members, right: Math.max(L.gutter + mw, cur.right), w: mw, label: merged };
      }
      lanesAlerts.set(lane, stack);
    }
    for (const [lane, stack] of lanesAlerts)
      for (const g of stack) {
        const latest = g.members[g.members.length - 1] as Alert;
        const kind = g.members.map(pillKind).reduce((k, c) => (KIND_RANK[c] > KIND_RANK[k] ? c : k));
        const ss = g.members.map(surprise).filter((v): v is number => v !== null);
        pills.push({
          a: latest,
          members: g.members,
          kind,
          x: g.right - g.w,
          y: lane < 0 ? 1 : L.lanes + lane * L.pitch + (L.pitch - PILL_H) / 2,
          w: g.w,
          label: g.label,
          s: ss.length ? Math.max(...ss) : null,
        });
      }
  }

  return {
    rows,
    full,
    weekDays: rows.map((r) => r.day),
    xOf,
    right,
    layers: bands,
    stacked,
    cultures,
    cultureDot,
    partial,
    ymax,
    yTop: yv(ymax),
    cmax,
    top,
    specks,
    lanes,
    ticks,
    pills,
    dots,
  };
}

const PH_CLASS: Record<Ph, string> = { esbl: "hs-ph-esbl", mrsa: "hs-ph-mrsa", vre: "hs-ph-vre", cpe: "hs-ph-cpe" };

/** Pattern fills so the four phenotypes never rely on colour alone. */
function Patterns({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-esbl`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" className="hs-fill-esbl" />
      </pattern>
      <pattern id={`${id}-mrsa`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" className="hs-fill-mrsa" />
        <rect width="1.6" height="5" className="hs-pat-light" />
      </pattern>
      <pattern id={`${id}-vre`} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" className="hs-fill-vre" />
        <circle cx="2.5" cy="2.5" r="1" className="hs-pat-light" />
      </pattern>
      <pattern id={`${id}-cpe`} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" className="hs-fill-cpe" />
        <path d="M0 2.5H5M2.5 0V5" className="hs-pat-line" />
      </pattern>
      <pattern id={`${id}-part`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect width="5" height="5" className="hs-part-bg" />
        <rect width="1" height="5" className="hs-part-line" />
      </pattern>
    </defs>
  );
}

interface StaticProps {
  m: Model;
  L: Layout;
  id: string;
  locale: Locale;
  compact: boolean;
  asOf: string;
  disabled: boolean;
  layers: Layers;
  /** Pixels at the right of the legend row kept for the Layers button. */
  reserve: number;
  onToggle: (k: LineKey) => void;
  /** A pill was opened: the pointer readout goes away. */
  onOpen: () => void;
}

/** Everything that does not change with the pointer; re-rendered only when the data, width or date change. */
const StaticLayer = memo(function StaticLayer({
  m,
  L,
  id,
  locale,
  compact,
  asOf,
  disabled,
  layers,
  reserve,
  onToggle,
  onOpen,
}: StaticProps) {
  const lanesEnd = L.lanesEnd;
  const todayLabel = `${t(locale, "tlToday")} · ${compactDate(asOf)}`;
  const todayW = Math.ceil(todayLabel.length * 6.6 + 10);
  const open = (a: Alert) => {
    onOpen();
    location.hash = `research?inc=${encodeURIComponent(a.incident ?? a.id)}`;
  };
  return (
    <g>
      <line className="hs-base" x1={L.gutter} x2={m.right} y1={L.base} y2={L.base} />
      {m.stacked
        ? m.layers.map((l) => <path key={l.ph} d={l.d} className="hs-layer" style={{ fill: `url(#${id}-${l.ph})` }} />)
        : m.layers.map((l) => <path key={l.ph} d={l.d} className={`hs-line hs-ln-${l.ph}`} />)}
      {m.top ? <path className="hs-top" d={m.top} /> : null}
      {m.specks.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="hs-speck" cx={x} cy={y} r={1.6} />
      ))}
      {m.cultures ? (
        <>
          <path className="hs-cult-halo" d={m.cultures} />
          <path className="hs-cult" d={m.cultures} />
        </>
      ) : null}
      {!compact && !m.layers.length && !layers.lines.cult ? (
        <text className="hs-legend" x={(L.gutter + m.right) / 2} y={L.base - 18} textAnchor="middle">
          {t(locale, "tlLyEmpty")}
        </text>
      ) : null}
      {m.cultureDot ? <circle className="hs-cult-dot" cx={m.cultureDot[0]} cy={m.cultureDot[1]} r={2} /> : null}

      {m.partial ? (
        <g>
          {m.partial.stacks.map((s) => (
            <rect
              key={s.ph}
              x={m.partial?.x0}
              y={s.y}
              width={(m.partial?.x1 ?? 0) - (m.partial?.x0 ?? 0)}
              height={s.h}
              style={{ fill: `url(#${id}-${s.ph})` }}
              className="hs-partial-bar"
            />
          ))}
          {m.partial.marks.map((k) => (
            <line key={k.ph} className={`hs-line hs-ln-${k.ph}`} x1={m.partial?.x0} x2={m.partial?.x1} y1={k.y} y2={k.y} />
          ))}
          <rect
            className="hs-partial"
            x={m.partial.x0}
            y={L.top}
            width={m.partial.x1 - m.partial.x0}
            height={lanesEnd - L.top}
            style={{ fill: `url(#${id}-part)` }}
          />
          {m.partial.dot ? <circle className="hs-cult-dot" data-hollow cx={m.partial.dot[0]} cy={m.partial.dot[1]} r={2} /> : null}
        </g>
      ) : null}

      {!compact
        ? m.lanes.map((l) => (
            <g key={l.ward}>
              <line className="hs-lane-line" x1={L.gutter} x2={m.right} y1={l.mid} y2={l.mid} />
              {l.path ? <path className="hs-ribbon" d={l.path} /> : null}
              <text className="hs-lane-label" x={L.gutter - 6} y={l.mid + 4} textAnchor="end">
                <title>{wardName(locale, l.ward)}</title>
                {l.ward}
              </text>
            </g>
          ))
        : null}

      {!compact ? (
        <>
          <line className="hs-yaxis" x1={L.gutter} x2={L.gutter} y1={L.top} y2={lanesEnd} />
          <line className="hs-grid" x1={L.gutter - 3} x2={m.right} y1={m.yTop} y2={m.yTop} />
          <line className="hs-yaxis" x1={L.gutter - 3} x2={L.gutter} y1={L.base} y2={L.base} />
          <text className="hs-ylab" x={L.gutter - 6} y={m.yTop + 4} textAnchor="end">
            {ratioLabel(layers, m.ymax)}
          </text>
          <text className="hs-ylab" x={L.gutter - 6} y={L.base + 4} textAnchor="end">
            0
          </text>
          <Legend id={id} L={L} locale={locale} right={m.right - reserve} layers={layers} onToggle={onToggle} />
        </>
      ) : null}

      {m.ticks.map((k) => (
        <g key={`${k.x}-${k.label ?? ""}`}>
          <line
            className="hs-tick"
            data-year={k.year || undefined}
            x1={k.x}
            x2={k.x}
            y1={compact ? L.base : lanesEnd}
            y2={(compact ? L.base : lanesEnd) + (k.year ? 5 : 3)}
          />
          {k.label && (compact || k.x + 40 < m.right - todayW - 8) ? (
            <text className="hs-axis-text" x={k.x + 3} y={L.axis}>
              {k.label}
            </text>
          ) : null}
        </g>
      ))}

      {compact
        ? m.dots.map((d) => (
            <path
              key={d.id}
              className="hs-dot"
              data-kind={d.kind}
              d={d.kind === "sentinel" ? `M${d.x} ${L.base + 2}l3 5h-6z` : `M${d.x - 2.5} ${L.base + 2}h5v5h-5z`}
            />
          ))
        : null}

      {m.pills.map((p) => (
        <g
          key={p.a.id}
          className="hs-pill"
          data-kind={p.kind}
          data-count={p.members.length > 1 ? p.members.length : undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={p.members.map((x) => pillLine(locale, x)).join("; ")}
          data-week={weekIndex(m.weekDays, dayNumber(p.a.date))}
          onClick={() => open(p.a)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              open(p.a);
            }
          }}
        >
          <title>{`${p.members.map((x) => pillLine(locale, x)).join("\n")}\n${t(locale, "tlOpenIncident")}`}</title>
          <rect className="hs-pill-hit" x={p.x - 2} y={p.y - 1} width={p.w + 4} height={PILL_H + 2} />
          <rect className="hs-pill-bg" x={p.x} y={p.y} width={p.w} height={PILL_H} rx={2.5} />
          {p.kind === "sentinel" ? <path className="hs-pill-glyph" d={`M${p.x + 5} ${p.y + 2.5}l3.5 6h-7z`} /> : null}
          <text className="hs-pill-text" x={p.x + (p.kind === "sentinel" ? 12 : 4)} y={p.y + 9}>
            {p.label}
          </text>
          {p.s !== null ? (
            <>
              <rect className="hs-pill-track" x={p.x + 1} y={p.y + PILL_H - 1.5} width={p.w - 2} height={1.5} />
              <rect
                className="hs-pill-bar"
                x={p.x + 1}
                y={p.y + PILL_H - 1.5}
                width={Math.max(1, ((p.w - 2) * p.s) / SURPRISE_CAP)}
                height={1.5}
              />
            </>
          ) : null}
        </g>
      ))}

      {m.partial && !compact ? (
        <line className="hs-partial-rule" x1={m.partial.x0} x2={m.right} y1={lanesEnd + 2} y2={lanesEnd + 2} />
      ) : null}
      <line className="hs-today" x1={m.right} x2={m.right} y1={0} y2={compact ? L.height : lanesEnd + 4} />
      {!compact ? (
        <g>
          <rect className="hs-today-bg" x={m.right - todayW} y={L.axis - 12} width={todayW} height={15} rx={3} />
          <text className="hs-today-text" x={m.right - 5} y={L.axis} textAnchor="end">
            {todayLabel}
          </text>
        </g>
      ) : null}
    </g>
  );
});

/** The top of the y axis: a count, or a ratio to one decimal below 10. */
function fmtVal(v: number | null, layers: Layers): string {
  if (v === null) return "–";
  return layers.metric === "count" ? String(v) : v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}

function ratioLabel(layers: Layers, v: number): string {
  if (layers.metric === "count") return String(v);
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}

/**
 * The legend doubles as the line toggles: a press on an entry hides or shows that line, and a
 * hidden entry is struck through as well as dimmed.
 */
function Legend({
  id,
  L,
  locale,
  right,
  layers,
  onToggle,
}: {
  id: string;
  L: Layout;
  locale: Locale;
  right: number;
  layers: Layers;
  onToggle: (k: LineKey) => void;
}) {
  const items = PHENOTYPE_ORDER.map((p) => ({ k: p as LineKey, name: phenotypeName(p), w: 17 + phenotypeName(p).length * 6.6 }));
  let x = L.gutter;
  const placed = items.map((it) => {
    const at = x;
    x += it.w + 8;
    return { ...it, at };
  });
  const full = t(locale, "tlCulturesScale");
  const short = t(locale, "tlCulturesShort");
  const room = right - x - 18;
  const text = full.length * 6.2 <= room ? full : short.length * 6.2 <= room ? short : null;
  const cultW = 17 + (text ? text.length * 6.2 : 0);
  const tag = layers.metric === "ratio" ? t(locale, "tlYRatio") : null;
  const tagW = tag ? tag.length * 6.2 + 8 : 0;
  const ratio = t(locale, "tlPillLegend");
  const ratioNote = right - (x + cultW) - tagW - 24 >= ratio.length * 6.2 ? ratio : null;
  const toggle = (k: LineKey, name: string, at: number, w: number, swatch: ReactNode, label: string | null) => {
    const on = layers.lines[k];
    return (
      <g
        key={k}
        className="hs-leg"
        data-off={on ? undefined : true}
        role="checkbox"
        aria-checked={on}
        tabIndex={0}
        aria-label={t(locale, "tlLyToggle", { name })}
        onClick={() => onToggle(k)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggle(k);
          }
        }}
      >
        <title>{t(locale, "tlLyToggle", { name })}</title>
        <rect className="hs-leg-hit" x={at - 3} y={-3} width={w + 6} height={18} />
        {swatch}
        {label ? (
          <text className="hs-legend" x={at + 17} y={11}>
            {label}
          </text>
        ) : null}
        {on ? null : <path className="hs-leg-strike" d={`M${at} 7.5h${w}`} />}
      </g>
    );
  };
  return (
    <g>
      {placed.map((it) =>
        toggle(
          it.k,
          it.name,
          it.at,
          it.w,
          layers.stacked ? (
            <rect className="hs-swatch" x={it.at} y={3} width={13} height={8} style={{ fill: `url(#${id}-${it.k})` }} />
          ) : (
            <path className={`hs-line hs-ln-${it.k}`} d={`M${it.at} 7.5h13`} />
          ),
          it.name,
        ),
      )}
      {/* No room for even the short label: leave the cultures toggle to the Layers menu rather than show a bare dash. */}
      {text ? toggle("cult", t(locale, "tlLyCultures"), x, cultW, <path className="hs-cult" d={`M${x} 7.5h13`} />, text) : null}
      {ratioNote ? (
        <text className="hs-legend" x={right - 8 - tagW} y={11} textAnchor="end">
          {ratioNote}
        </text>
      ) : null}
      {tag ? (
        <text className="hs-legend hs-legend-tag" x={right - 8} y={11} textAnchor="end">
          {tag}
        </text>
      ) : null}
    </g>
  );
}

function summaryText(locale: Locale, rows: WeekRow[], asOf: string, layers: Layers): string {
  const usable = rows.filter((r) => !r.hidden).slice(-4);
  if (!usable.length) return t(locale, "tlSummaryNone");
  const shownPh = PHENOTYPE_ORDER.filter((p) => layers.lines[p]);
  const list = (shownPh.length ? shownPh : PHENOTYPE_ORDER)
    .map((p) => `${phenotypeName(p)} ${usable.map((r) => r.ph[p]).join(", ")}`)
    .join("; ");
  return t(locale, "tlSummary", { date: compactDate(asOf), list, cultures: usable.map((r) => r.cultures).join(", ") });
}

export function WeeklyBand(p: Props) {
  const { locale, start, asOf, weekly, alerts, layers, onLayers, compact = false, disabled = false } = p;
  const id = `hs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const wrap = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<{ idx: number; kbd: boolean } | null>(null);
  const [place, setPlace] = useState<"below" | "above" | "inside">("below");

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.max(120, el.clientWidth));
    const ro = new ResizeObserver(() => setWidth(Math.max(120, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rawRows = useMemo(() => weekRows(weekly, asOf), [weekly, asOf]);
  const win = useMemo(() => windowRows(rawRows, layers.window), [rawRows, layers.window]);
  const rows = useMemo(() => viewRows(win, layers), [win, layers]);
  const wards = useMemo(
    () => WARD_CODES.filter((c) => layers.units[c] !== false && weekly?.units[c] !== undefined),
    [weekly, layers.units],
  );
  const L = useMemo(() => (compact ? SMALL : fullLayout(weekly ? wards.length : WARD_CODES.length)), [compact, weekly, wards.length]);
  const d0 = windowStart(start, win[0], layers.window);
  const shownAlerts = useMemo(() => alerts.filter((a) => layers.kinds[pillKind(a)]), [alerts, layers.kinds]);
  const m = useMemo(
    () => build(L, width, d0, asOf, rows, shownAlerts, wards, layers, locale, compact),
    [L, width, d0, asOf, rows, shownAlerts, wards, layers, locale, compact],
  );
  const summary = useMemo(() => summaryText(locale, win, asOf, layers), [locale, win, asOf, layers]);
  const control = !compact && onLayers !== undefined;
  const withLabel = width >= 520;
  const reserve = control ? (withLabel ? 30 + t(locale, "tlLayers").length * 6.2 : 30) : 0;
  const onToggle = useCallback(
    (k: LineKey) => onLayers?.({ ...layers, lines: { ...layers.lines, [k]: !layers.lines[k] } }),
    [layers, onLayers],
  );

  const idxAt = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || m.weekDays.length === 0) return -1;
    const x = clientX - r.left;
    if (x < L.gutter || x > m.right) return -1;
    const span = Math.max(7, dayNumber(asOf) + 1 - d0);
    const day = d0 + ((x - L.gutter) / Math.max(40, m.right - L.gutter)) * span;
    return weekIndex(m.weekDays, Math.floor(day));
  };

  // Pointer moves are read at most once per frame.
  const frame = useRef(0);
  const pending = useRef(0);
  const idxAtRef = useRef(idxAt);
  idxAtRef.current = idxAt;
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const onMove = (e: PointerEvent) => {
    if (compact || disabled || e.pointerType !== "mouse") return;
    pending.current = e.clientX;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const idx = idxAtRef.current(pending.current);
      setHover((h) => (idx < 0 ? null : h?.idx === idx && !h.kbd ? h : { idx, kbd: false }));
    });
  };
  const onDown = (e: PointerEvent) => {
    if (compact) {
      p.onActivate?.();
      return;
    }
    if (e.pointerType === "mouse" || disabled || (e.target as Element).closest(".hs-pill, .hs-leg")) return;
    const idx = idxAt(e.clientX);
    setHover(idx < 0 ? null : { idx, kbd: false });
  };

  const clearHover = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    setHover(null);
  }, []);

  const lastIdx = m.rows.length - 1;
  const onSliderKey = (e: KeyboardEvent) => {
    const at = hover?.idx ?? lastIdx;
    let to = at;
    if (e.key === "ArrowLeft") to = Math.max(0, at - 1);
    else if (e.key === "ArrowRight") to = Math.min(lastIdx, at + 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = lastIdx;
    else if (e.key === "Escape") {
      setHover(null);
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    setHover({ idx: to, kbd: true });
  };

  const row = hover ? m.rows[hover.idx] : undefined;
  const lanesEnd = L.lanesEnd;
  const cx = row ? m.xOf(row.day + 3.5) : 0;
  const hx0 = row ? m.xOf(row.day) : 0;
  const hx1 = row ? Math.min(m.right, m.xOf(row.day + 7)) : 0;
  const rowAlerts = row ? shownAlerts.filter((a) => a.date >= row.date && a.date <= row.last) : [];
  const readLeft = Math.min(Math.max(cx - READ_W / 2, 0), Math.max(0, width - READ_W));
  const readPh = PHENOTYPE_ORDER.filter((ph) => layers.lines[ph]);
  const sliderText = row
    ? `${t(locale, "tlWeekRange", { from: compactDate(row.date), to: compactDate(row.last) })}: ${readPh.map((ph) => `${phenotypeName(ph)} ${fmtVal(row.v.ph[ph], layers)}`).join(", ")}${layers.metric === "ratio" ? ` ${t(locale, "tlYRatio")}` : ""}; ${t(locale, "tlCultures")} ${row.cultures}`
    : "";

  // The readout closes when the pointer leaves, on Esc, on scroll, on a press elsewhere and when the
  // choices change; it flips above the band, or inside it, when there is no room below.
  const hovering = hover !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new choice or window invalidates the week index
  useEffect(() => setHover(null), [layers, asOf]);
  useEffect(() => {
    if (!hovering) return;
    const close = () => setHover(null);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close();
    const onPress = (e: globalThis.PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("blur", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("blur", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [hovering]);
  const hoverIdx = hover?.idx;
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again for each week the readout moves to
  useLayoutEffect(() => {
    const r = readRef.current;
    const w = wrap.current;
    if (!r || !w) return;
    const box = w.getBoundingClientRect();
    const need = r.offsetHeight + 8;
    setPlace(box.bottom + need <= window.innerHeight - 8 ? "below" : box.top - need >= 8 ? "above" : "inside");
  }, [hoverIdx]);

  return (
    <div
      className="hs"
      ref={wrap}
      style={{ height: L.height }}
      data-compact={compact || undefined}
      data-disabled={disabled || undefined}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
        setHover((h) => (h?.kbd ? h : null));
      }}
    >
      <svg
        className="hs-svg"
        width={width}
        height={L.height}
        role="group"
        aria-label={p.label}
        aria-describedby={`${id}-sum`}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onFocus={(e) => {
          const w = Number((e.target as Element).getAttribute("data-week") ?? "-1");
          if (w >= 0) setHover({ idx: w, kbd: true });
        }}
        onBlur={() => setHover((h) => (h?.kbd ? null : h))}
      >
        <Patterns id={id} />
        {!compact && m.rows.length > 0 ? (
          <rect
            className="hs-slider"
            x={L.gutter}
            y={0}
            width={Math.max(0, m.right - L.gutter)}
            height={lanesEnd}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={t(locale, "tlStream")}
            aria-valuemin={0}
            aria-valuemax={lastIdx}
            aria-valuenow={hover?.idx ?? lastIdx}
            aria-valuetext={sliderText || summary}
            onKeyDown={onSliderKey}
            onFocus={() => setHover((h) => h ?? { idx: lastIdx, kbd: true })}
          />
        ) : null}
        <StaticLayer
          m={m}
          L={L}
          id={id}
          locale={locale}
          compact={compact}
          asOf={asOf}
          disabled={disabled}
          layers={layers}
          reserve={reserve}
          onToggle={onToggle}
          onOpen={clearHover}
        />
        {row && !row.hidden ? (
          <g className="hs-cross">
            <rect className="hs-cross-week" x={hx0} y={L.top - 1} width={Math.max(3, hx1 - hx0)} height={lanesEnd - L.top + 1} />
            <line className="hs-cross-line" x1={cx} x2={cx} y1={L.top - 1} y2={lanesEnd} />
          </g>
        ) : null}
      </svg>
      <span id={`${id}-sum`} className="visually-hidden">
        {summary}
      </span>
      {control && onLayers ? <LayersControl locale={locale} layers={layers} onChange={onLayers} withLabel={withLabel} /> : null}
      {row && !compact ? (
        <div
          className="hs-read"
          ref={readRef}
          data-place={place}
          style={{ left: readLeft, width: READ_W }}
          role={hover?.kbd ? "status" : undefined}
          aria-hidden={hover?.kbd ? undefined : true}
        >
          <div className="hs-read-head">
            <b className="num">{t(locale, "tlWeekRange", { from: compactDate(row.date), to: compactDate(row.last) })}</b>
            {row.partial ? <span className="hs-read-partial">{t(locale, "tlPartial", { to: compactDate(row.last) })}</span> : null}
          </div>
          {row.hidden ? null : (
            <>
              <div className="hs-read-grid hs-read-ph">
                {readPh.map((ph) => (
                  <span key={ph} className="hs-read-item" title={layers.metric === "ratio" ? `${row.ph[ph]} / ${row.cultures}` : undefined}>
                    <svg width="12" height="8" aria-hidden="true">
                      <rect className={`hs-swatch ${PH_CLASS[ph]}`} width="12" height="8" style={{ fill: `url(#${id}-${ph})` }} />
                    </svg>
                    {phenotypeName(ph)} <b className="num">{fmtVal(row.v.ph[ph], layers)}</b>
                    {layers.metric === "ratio" ? <span className="hs-read-raw num">({row.ph[ph]})</span> : null}
                  </span>
                ))}
                {layers.lines.cult ? (
                  <span className="hs-read-item hs-read-cult">
                    {t(locale, "tlCultures")} <b className="num">{row.cultures}</b>
                  </span>
                ) : null}
              </div>
              <div className="hs-read-grid hs-read-units">
                {WARDS.filter((w) => wards.includes(w.code) && row.v.units[w.code] !== undefined).map((w) => (
                  <span key={w.code} className="hs-read-item" title={wardName(locale, w.code)}>
                    {w.code} <b className="num">{fmtVal(row.v.units[w.code] ?? null, layers)}</b>
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="hs-read-alerts">
            <span className="hs-read-label">{t(locale, "tlAlertsThisWeek")}</span>
            {rowAlerts.length ? (
              <ul>
                {rowAlerts.map((a) => (
                  <li key={a.id}>{pillLine(locale, a)}</li>
                ))}
              </ul>
            ) : (
              <span> {t(locale, "tlNoSignals")}</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
