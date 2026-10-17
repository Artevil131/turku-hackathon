import type { sharesByPeriod } from "@aei/compare";
import { formatDate, type Locale, t, wardName } from "@aei/i18n";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { pct } from "./model.ts";

// The chart windows' figures: one SVG each, drawn from the numbers computeChart returned. 480 wide in its own
// units and scaled to the window. Every mark is also a button (hover, focus and click give the same readout),
// the readout line sits under the figure, and the tokens come from charts.css.

export type Period = ReturnType<typeof sharesByPeriod>[number];
type Known = Period & { share: number; interval: { lo: number; hi: number } };

const W = 480;
const H = 160;
const M = { l: 40, r: 8, t: 8, b: 22 };

const isKnown = (p: Period): p is Known => p.share !== null && p.interval !== null && Number.isFinite(p.share);
const press = (act: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    act();
  }
};

export function periodWords(locale: Locale, p: Period): string {
  const span = `${formatDate(locale, p.from)}–${formatDate(locale, p.to)}`;
  return isKnown(p)
    ? `${span} · ${pct(p.share, locale)} (${pct(p.interval.lo, locale)}–${pct(p.interval.hi, locale)}) · ${p.k}/${p.n}`
    : `${span} · ${t(locale, "chartNoCultures")}`;
}

/** Marks the figure's hover/focus target for one period and reports it; the band is invisible and full height. */
function Hit({
  x,
  width,
  label,
  onHover,
  onPick,
}: {
  x: number;
  width: number;
  label: string;
  onHover: (text: string | null) => void;
  onPick?: () => void;
}) {
  return (
    <rect
      data-ui
      className="ch-hit"
      x={x}
      y={M.t}
      width={Math.max(2, width)}
      height={H - M.t - M.b}
      role="button"
      tabIndex={0}
      aria-label={label}
      onMouseEnter={() => onHover(label)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(label)}
      onBlur={() => onHover(null)}
      onClick={onPick}
      onKeyDown={onPick ? press(onPick) : undefined}
    >
      <title>{label}</title>
    </rect>
  );
}

function Frame({
  aria,
  readout,
  shown,
  children,
  h = H,
}: {
  aria: string;
  readout: string;
  shown: string | null;
  children: ReactNode;
  h?: number;
}) {
  return (
    <figure className="ch-figure">
      <svg className="ch-fig" viewBox={`0 0 ${W} ${h}`} role="img" aria-label={aria}>
        {children}
      </svg>
      <figcaption className="ch-read" aria-hidden="true">
        {shown ?? readout}
      </figcaption>
    </figure>
  );
}

const top10 = (v: number, floor: number, cap: number) => Math.min(cap, Math.max(floor, Math.ceil(v * 10) / 10));

export function ShareChart({
  points,
  locale,
  aria,
  onPick,
}: {
  points: Period[];
  locale: Locale;
  aria: string;
  onPick?: (p: Period) => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const known = points.map((p, i) => ({ p, i })).filter((e): e is { p: Known; i: number } => isKnown(e.p));
  const top = top10(Math.max(0, ...known.map((e) => e.p.interval.hi)), 0.1, 1);
  const inner = W - M.l - M.r;
  const step = points.length < 2 ? inner : inner / (points.length - 1);
  const x = (i: number) => M.l + (points.length < 2 ? inner / 2 : i * step);
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  const band =
    known.length > 0
      ? `${known.map(({ p, i }) => `${x(i)},${y(p.interval.hi)}`).join(" ")} ${[...known]
          .reverse()
          .map(({ p, i }) => `${x(i)},${y(p.interval.lo)}`)
          .join(" ")}`
      : "";
  return (
    <Frame aria={aria} readout={t(locale, "chartHoverHint")} shown={shown}>
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="ch-grid" />
          <text x={M.l - 6} y={y(v) + 4} textAnchor="end" className="ch-tick">
            {pct(v, locale)}
          </text>
        </g>
      ))}
      {band && <polygon points={band} className="ch-band" />}
      {known.length > 0 && <polyline points={known.map(({ p, i }) => `${x(i)},${y(p.share)}`).join(" ")} className="ch-line" fill="none" />}
      {known.map(({ p, i }) => (
        <circle key={p.from} cx={x(i)} cy={y(p.share)} r={2.5} className="ch-dot" />
      ))}
      {points.length > 0 && (
        <>
          <text x={M.l} y={H - 6} className="ch-tick">
            {formatDate(locale, points[0]?.from ?? "")}
          </text>
          <text x={W - M.r} y={H - 6} textAnchor="end" className="ch-tick">
            {formatDate(locale, points[points.length - 1]?.to ?? "")}
          </text>
        </>
      )}
      {points.map((p, i) => (
        <Hit
          key={p.from}
          x={x(i) - step / 2}
          width={step}
          label={periodWords(locale, p)}
          onHover={setShown}
          onPick={onPick && (() => onPick(p))}
        />
      ))}
    </Frame>
  );
}

export function Bars({ points, locale, aria, onPick }: { points: Period[]; locale: Locale; aria: string; onPick?: (p: Period) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  const max = Math.max(1, ...points.map((p) => p.k));
  const top = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const inner = W - M.l - M.r;
  const slot = points.length === 0 ? inner : inner / points.length;
  const y = (v: number) => M.t + (1 - v / top) * (H - M.t - M.b);
  return (
    <Frame aria={aria} readout={t(locale, "chartHoverHint")} shown={shown}>
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="ch-grid" />
          <text x={M.l - 6} y={y(v) + 4} textAnchor="end" className="ch-tick">
            {Number.isInteger(v) ? v : v.toLocaleString(locale)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <rect
          key={p.from}
          className="ch-bar"
          x={M.l + i * slot + slot * 0.12}
          y={y(p.k)}
          width={Math.max(1, slot * 0.76)}
          height={H - M.b - y(p.k)}
        />
      ))}
      {points.length > 0 && (
        <>
          <text x={M.l} y={H - 6} className="ch-tick">
            {formatDate(locale, points[0]?.from ?? "")}
          </text>
          <text x={W - M.r} y={H - 6} textAnchor="end" className="ch-tick">
            {formatDate(locale, points[points.length - 1]?.to ?? "")}
          </text>
        </>
      )}
      {points.map((p, i) => (
        <Hit
          key={p.from}
          x={M.l + i * slot}
          width={slot}
          label={`${formatDate(locale, p.from)}–${formatDate(locale, p.to)} · ${t(locale, "chartBarWords", { k: p.k, n: p.n })}`}
          onHover={setShown}
          onPick={onPick && (() => onPick(p))}
        />
      ))}
    </Frame>
  );
}

const COLS = 3;
const PW = (W - 8 * (COLS - 1)) / COLS;
const PH = 84;

export function SmallMultiples({
  units,
  locale,
  aria,
  onPick,
}: {
  units: { unit: string; points: Period[] }[];
  locale: Locale;
  aria: string;
  onPick?: (unit: string) => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  // One scale for every panel, so the panels can be compared.
  const top = top10(Math.max(0, ...units.flatMap((u) => u.points.filter(isKnown).map((p) => p.interval.hi))), 0.1, 1);
  const rows = Math.max(1, Math.ceil(units.length / COLS));
  const h = rows * (PH + 8);
  return (
    <Frame aria={aria} readout={t(locale, "chartHoverHint")} shown={shown} h={h}>
      {units.map((u, n) => {
        const ox = (n % COLS) * (PW + 8);
        const oy = Math.floor(n / COLS) * (PH + 8);
        const known = u.points.map((p, i) => ({ p, i })).filter((e): e is { p: Known; i: number } => isKnown(e.p));
        const x = (i: number) => ox + 4 + (u.points.length < 2 ? (PW - 8) / 2 : (i * (PW - 8)) / (u.points.length - 1));
        const y = (v: number) => oy + 16 + (1 - v / top) * (PH - 22);
        const last = [...known].pop();
        const label = `${wardName(locale, u.unit as never)} · ${last ? `${pct(last.p.share, locale)} (${last.p.k}/${last.p.n})` : t(locale, "chartNoCultures")}`;
        const band = known.length
          ? `${known.map(({ p, i }) => `${x(i)},${y(p.interval.hi)}`).join(" ")} ${[...known]
              .reverse()
              .map(({ p, i }) => `${x(i)},${y(p.interval.lo)}`)
              .join(" ")}`
          : "";
        return (
          <g
            key={u.unit}
            className="ch-panel"
            role="button"
            tabIndex={0}
            aria-label={label}
            onMouseEnter={() => setShown(label)}
            onMouseLeave={() => setShown(null)}
            onFocus={() => setShown(label)}
            onBlur={() => setShown(null)}
            onClick={onPick && (() => onPick(u.unit))}
            onKeyDown={onPick ? press(() => onPick(u.unit)) : undefined}
          >
            <title>{label}</title>
            <rect data-ui className="ch-panel-bg" x={ox} y={oy} width={PW} height={PH} rx={4} />
            <text x={ox + 6} y={oy + 11} className="ch-tick ch-panel-name">
              {wardName(locale, u.unit as never)}
            </text>
            <line x1={ox + 4} x2={ox + PW - 4} y1={y(0)} y2={y(0)} className="ch-grid" />
            {band && <polygon points={band} className="ch-band" />}
            {known.length > 0 && (
              <polyline points={known.map(({ p, i }) => `${x(i)},${y(p.share)}`).join(" ")} className="ch-line" fill="none" />
            )}
            {last && <circle cx={x(last.i)} cy={y(last.p.share)} r={2.5} className="ch-dot" />}
          </g>
        );
      })}
    </Frame>
  );
}
