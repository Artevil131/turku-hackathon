import type { Alert, WeeklyResponse } from "@aei/contract";
import { WARDS, type WardCode } from "@aei/domain";
import { type Locale, phenotypeName, t, wardName } from "@aei/i18n";
import { type KeyboardEvent, memo, type PointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  bandPath,
  compactDate,
  dayNumber,
  linePath,
  PHENOTYPE_ORDER,
  type Ph,
  type PillKind,
  type Pt,
  pillKind,
  pillLabel,
  pillLine,
  pillWidth,
  SURPRISE_CAP,
  surprise,
  type WeekRow,
  weekIndex,
  weekRows,
} from "./geometry.ts";
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
}
const FULL: Layout = { gutter: 40, height: 170, legend: 12, top: 15, base: 53, lanes: 58, pitch: 11, axis: 168 };
const SMALL: Layout = { gutter: 0, height: 44, legend: 0, top: 3, base: 26, lanes: 0, pitch: 0, axis: 43 };

const PILL_H = 10;
const READ_W = 276;

interface Props {
  locale: Locale;
  start: string;
  /** The replay date: the right edge of the axis. */
  asOf: string;
  weekly: WeeklyResponse | null;
  alerts: readonly Alert[];
  compact?: boolean;
  disabled?: boolean;
  label: string;
  /** Compact strip only: a press on the band. */
  onActivate?: () => void;
}

interface PillPlace {
  a: Alert;
  kind: PillKind;
  x: number;
  y: number;
  w: number;
  label: string;
  short: boolean;
  s: number | null;
}

interface Model {
  rows: WeekRow[];
  full: WeekRow[];
  weekDays: number[];
  xOf: (day: number) => number;
  right: number;
  layers: string[];
  cultures: string;
  cultureDot: Pt | null;
  partial: { x0: number; x1: number; stacks: { ph: Ph; y: number; h: number }[]; dot: Pt | null } | null;
  ymax: number;
  cmax: number;
  top: Pt[];
  lanes: { ward: WardCode; mid: number; path: string }[];
  ticks: { x: number; year: boolean; label: string | null }[];
  pills: PillPlace[];
  dots: { x: number; kind: PillKind; id: string }[];
}

function build(
  L: Layout,
  width: number,
  start: string,
  asOf: string,
  rows: WeekRow[],
  alerts: readonly Alert[],
  locale: Locale,
  compact: boolean,
): Model {
  const d0 = dayNumber(start);
  const dEnd = dayNumber(asOf) + 1;
  const span = Math.max(7, dEnd - d0);
  const right = width - 2;
  const plotW = Math.max(40, right - L.gutter);
  const xOf = (day: number) => L.gutter + Math.min(1, Math.max(0, (day - d0) / span)) * plotW;
  const full = rows.filter((r) => !r.partial);
  const partialRow = rows.find((r) => r.partial);
  const h = L.base - L.top;

  const ymax = Math.max(1, ...full.map((r) => r.total));
  const cmax = Math.max(1, ...full.map((r) => r.cultures));
  const yv = (v: number) => L.base - (v / ymax) * h * 0.96;
  const yc = (v: number) => L.base - (v / cmax) * h * 0.96;
  const xc = (r: WeekRow) => xOf(r.day + 3.5);

  const cum = (r: WeekRow, k: number) => PHENOTYPE_ORDER.slice(0, k).reduce((s, p) => s + r.ph[p], 0);
  const bound = (k: number): Pt[] => full.map((r) => [xc(r), yv(cum(r, k))] as const);
  const layers = full.length > 1 ? PHENOTYPE_ORDER.map((_, k) => bandPath(bound(k + 1), bound(k))) : [];
  const cultures = full.length > 1 ? linePath(full.map((r) => [xc(r), yc(r.cultures)] as const)) : "";
  const last = full[full.length - 1];
  const cultureDot: Pt | null = full.length === 1 && last ? [xc(last), yc(last.cultures)] : null;

  let partial: Model["partial"] = null;
  if (partialRow) {
    const x0 = xOf(partialRow.day);
    const x1 = right;
    const stacks: { ph: Ph; y: number; h: number }[] = [];
    let acc = 0;
    if (!partialRow.hidden)
      for (const p of PHENOTYPE_ORDER) {
        const v = partialRow.ph[p];
        if (v > 0) stacks.push({ ph: p, y: yv(acc + v), h: Math.max(0.5, yv(acc) - yv(acc + v)) });
        acc += v;
      }
    partial = {
      x0,
      x1: Math.max(x1, x0 + 4),
      stacks,
      dot: partialRow.hidden ? null : [(x0 + x1) / 2, yc(partialRow.cultures)],
    };
  }

  const top: Pt[] = full.map((r) => [xc(r), yv(r.total)] as const);

  // Unit lanes: a ribbon whose thickness follows the unit's weekly count, one scale for all lanes.
  const wards = (WARDS.map((w) => w.code) as WardCode[]).filter((c) => full.some((r) => r.units[c] !== undefined));
  const umax = Math.max(1, ...full.flatMap((r) => wards.map((c) => r.units[c] ?? 0)));
  const half = (v: number) => 0.3 + 4.3 * Math.sqrt(v / umax);
  const laneMid = (i: number) => L.lanes + i * L.pitch + L.pitch / 2;
  const lanes = compact
    ? []
    : wards.map((ward, i) => {
        const mid = laneMid(i);
        const pts = full.map((r) => [xc(r), r.units[ward] ?? 0] as const);
        const up = pts.map(([x, v]) => [x, mid - half(v)] as const);
        const lo = pts.map(([x, v]) => [x, mid + half(v)] as const);
        return { ward, mid, path: full.length > 1 ? bandPath(up, lo) : "" };
      });

  // Axis ticks: Jan 1 (labelled), the other quarters (minor).
  const ticks: Model["ticks"] = [];
  const s0 = new Date(`${start}T00:00:00Z`);
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
  const shown = alerts.filter((a) => a.date >= start && a.date <= asOf);
  const placed = new Map<number, [number, number][]>();
  const pills: PillPlace[] = [];
  const dots: Model["dots"] = [];
  const order = [...shown].sort((a, b) => b.date.localeCompare(a.date));
  for (const a of order) {
    const kind = pillKind(a);
    const ax = xOf(dayNumber(a.date) + 0.5);
    if (compact) {
      dots.push({ x: ax, kind, id: a.id });
      continue;
    }
    const lane = a.ward ? wards.indexOf(a.ward) : -1;
    if (a.ward && lane < 0) continue;
    const label = pillLabel(locale, a);
    const glyph = kind === "sentinel";
    const key = lane;
    const taken = placed.get(key) ?? [];
    let w = pillWidth(label, glyph);
    let x0 = Math.max(L.gutter, ax - w + 3);
    let short = false;
    if (taken.some(([p, q]) => x0 < q + 1 && x0 + w > p - 1)) {
      short = true;
      w = 10;
      x0 = Math.max(L.gutter, ax - 7);
    }
    taken.push([x0, x0 + w]);
    placed.set(key, taken);
    pills.push({
      a,
      kind,
      x: x0,
      y: lane < 0 ? 1 : L.lanes + lane * L.pitch + (L.pitch - PILL_H) / 2,
      w,
      label,
      short,
      s: surprise(a),
    });
  }

  return {
    rows,
    full,
    weekDays: rows.map((r) => r.day),
    xOf,
    right,
    layers,
    cultures,
    cultureDot,
    partial,
    ymax,
    cmax,
    top,
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
}

/** Everything that does not change with the pointer; re-rendered only when the data, width or date change. */
const StaticLayer = memo(function StaticLayer({ m, L, id, locale, compact, asOf, disabled }: StaticProps) {
  const lanesEnd = compact ? L.base : L.lanes + m.lanes.length * L.pitch;
  const open = (a: Alert) => {
    location.hash = `research?inc=${encodeURIComponent(a.incident ?? a.id)}`;
  };
  return (
    <g>
      <line className="hs-base" x1={L.gutter} x2={m.right} y1={L.base} y2={L.base} />
      {m.layers.map((d, k) => (
        <path key={PHENOTYPE_ORDER[k]} d={d} className="hs-layer" style={{ fill: `url(#${id}-${PHENOTYPE_ORDER[k]})` }} />
      ))}
      {m.layers.length ? <path className="hs-top" d={linePath(m.top)} /> : null}
      {m.cultures ? (
        <>
          <path className="hs-cult-halo" d={m.cultures} />
          <path className="hs-cult" d={m.cultures} />
        </>
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
              <text className="hs-lane-label" x={L.gutter - 5} y={l.mid + 3} textAnchor="end">
                <title>{wardName(locale, l.ward)}</title>
                {l.ward}
              </text>
            </g>
          ))
        : null}

      {!compact ? (
        <>
          <text className="hs-ylab" x={L.gutter - 5} y={L.top + 7} textAnchor="end">
            {m.ymax}
          </text>
          <text className="hs-ylab" x={L.gutter - 5} y={L.base} textAnchor="end">
            0
          </text>
          <Legend id={id} L={L} locale={locale} />
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
          {k.label && (compact || k.x + 40 < m.right - 112) ? (
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
          data-short={p.short || undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={pillLine(locale, p.a)}
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
          <title>{`${pillLine(locale, p.a)} · ${t(locale, "tlOpenIncident")}`}</title>
          <rect className="hs-pill-hit" x={p.x - 2} y={p.y - 1} width={p.w + 4} height={PILL_H + 2} />
          <rect className="hs-pill-bg" x={p.x} y={p.y} width={p.w} height={PILL_H} rx={2.5} />
          {p.kind === "sentinel" ? <path className="hs-pill-glyph" d={`M${p.x + 4.5} ${p.y + 2}l3 5.5h-6z`} /> : null}
          {p.short ? null : (
            <text className="hs-pill-text" x={p.x + (p.kind === "sentinel" ? 11 : 4)} y={p.y + 7}>
              {p.label}
            </text>
          )}
          {p.s !== null ? (
            <>
              <rect className="hs-pill-track" x={p.x + 1} y={p.y + PILL_H - 2} width={p.w - 2} height={1.5} />
              <rect
                className="hs-pill-bar"
                x={p.x + 1}
                y={p.y + PILL_H - 2}
                width={Math.max(1, ((p.w - 2) * p.s) / SURPRISE_CAP)}
                height={1.5}
              />
            </>
          ) : null}
        </g>
      ))}

      <line className="hs-today" x1={m.right} x2={m.right} y1={0} y2={compact ? L.height : lanesEnd + 2} />
      {!compact ? (
        <text className="hs-today-text" x={m.right - 4} y={L.axis} textAnchor="end">
          {t(locale, "tlToday")} · {compactDate(asOf)}
        </text>
      ) : null}
    </g>
  );
});

function Legend({ id, L, locale }: { id: string; L: Layout; locale: Locale }) {
  let x = L.gutter;
  return (
    <g>
      {PHENOTYPE_ORDER.map((p) => {
        const name = phenotypeName(p);
        const at = x;
        x += 20 + name.length * 6.2 + 8;
        return (
          <g key={p}>
            <rect className="hs-swatch" x={at} y={2} width={14} height={7} style={{ fill: `url(#${id}-${p})` }} />
            <text className="hs-legend" x={at + 18} y={9}>
              {name}
            </text>
          </g>
        );
      })}
      <path className="hs-cult" d={`M${x} 5.5h14`} />
      <text className="hs-legend" x={x + 18} y={9}>
        {t(locale, "tlCulturesScale")}
      </text>
    </g>
  );
}

function summaryText(locale: Locale, rows: WeekRow[], asOf: string): string {
  const usable = rows.filter((r) => !r.hidden).slice(-4);
  if (!usable.length) return t(locale, "tlSummaryNone");
  const list = PHENOTYPE_ORDER.map((p) => `${phenotypeName(p)} ${usable.map((r) => r.ph[p]).join(", ")}`).join("; ");
  return t(locale, "tlSummary", { date: compactDate(asOf), list, cultures: usable.map((r) => r.cultures).join(", ") });
}

export function WeeklyBand(p: Props) {
  const { locale, start, asOf, weekly, alerts, compact = false, disabled = false } = p;
  const L = compact ? SMALL : FULL;
  const id = `hs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<{ idx: number; kbd: boolean } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.max(120, el.clientWidth));
    const ro = new ResizeObserver(() => setWidth(Math.max(120, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => weekRows(weekly, asOf), [weekly, asOf]);
  const m = useMemo(
    () => build(L, width, start, asOf, rows, alerts, locale, compact),
    [L, width, start, asOf, rows, alerts, locale, compact],
  );
  const summary = useMemo(() => summaryText(locale, rows, asOf), [locale, rows, asOf]);

  const idxAt = (clientX: number) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || m.weekDays.length === 0) return -1;
    const x = clientX - r.left;
    if (x < L.gutter || x > m.right) return -1;
    const span = Math.max(7, dayNumber(asOf) + 1 - dayNumber(start));
    const day = dayNumber(start) + ((x - L.gutter) / Math.max(40, m.right - L.gutter)) * span;
    return weekIndex(m.weekDays, Math.floor(day));
  };

  const onMove = (e: PointerEvent) => {
    if (compact || disabled || e.pointerType !== "mouse") return;
    const idx = idxAt(e.clientX);
    setHover((h) => (idx < 0 ? null : h?.idx === idx && !h.kbd ? h : { idx, kbd: false }));
  };
  const onDown = (e: PointerEvent) => {
    if (compact) {
      p.onActivate?.();
      return;
    }
    if (e.pointerType === "mouse" || disabled || (e.target as Element).closest(".hs-pill")) return;
    const idx = idxAt(e.clientX);
    setHover(idx < 0 ? null : { idx, kbd: false });
  };

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
  const lanesEnd = compact ? L.base : L.lanes + m.lanes.length * L.pitch;
  const cx = row ? m.xOf(row.day + 3.5) : 0;
  const hx0 = row ? m.xOf(row.day) : 0;
  const hx1 = row ? Math.min(m.right, m.xOf(row.day + 7)) : 0;
  const rowAlerts = row ? alerts.filter((a) => a.date >= row.date && a.date <= row.last) : [];
  const readLeft = Math.min(Math.max(cx - READ_W / 2, 0), Math.max(0, width - READ_W));
  const sliderText = row
    ? `${t(locale, "tlWeekRange", { from: compactDate(row.date), to: compactDate(row.last) })}: ${PHENOTYPE_ORDER.map((ph) => `${phenotypeName(ph)} ${row.ph[ph]}`).join(", ")}; ${t(locale, "tlCultures")} ${row.cultures}`
    : "";

  return (
    <div
      className="hs"
      ref={wrap}
      style={{ height: L.height }}
      data-compact={compact || undefined}
      data-disabled={disabled || undefined}
      onPointerLeave={() => setHover((h) => (h?.kbd ? h : null))}
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
        <StaticLayer m={m} L={L} id={id} locale={locale} compact={compact} asOf={asOf} disabled={disabled} />
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
      {row && !compact ? (
        <div
          className="hs-read"
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
                {PHENOTYPE_ORDER.map((ph) => (
                  <span key={ph} className="hs-read-item">
                    <svg width="12" height="8" aria-hidden="true">
                      <rect className={`hs-swatch ${PH_CLASS[ph]}`} width="12" height="8" style={{ fill: `url(#${id}-${ph})` }} />
                    </svg>
                    {phenotypeName(ph)} <b className="num">{row.ph[ph]}</b>
                  </span>
                ))}
                <span className="hs-read-item hs-read-cult">
                  {t(locale, "tlCultures")} <b className="num">{row.cultures}</b>
                </span>
              </div>
              <div className="hs-read-grid hs-read-units">
                {WARDS.filter((w) => row.units[w.code] !== undefined).map((w) => (
                  <span key={w.code} className="hs-read-item" title={wardName(locale, w.code)}>
                    {w.code} <b className="num">{row.units[w.code]}</b>
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
