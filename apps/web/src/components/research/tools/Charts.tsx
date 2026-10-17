import type { betaPosterior, sharesByPeriod } from "@aei/compare";

type Beta = ReturnType<typeof betaPosterior>;
type PeriodShare = ReturnType<typeof sharesByPeriod>[number];

import type { Locale } from "@aei/i18n";

// Two small SVG figures for result cells, drawn from the numbers the gear returned; tokens from styles.css.

const W = 480;
const pct = (v: number, locale: Locale) => `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;

export function ShareLine({ points, locale, aria }: { points: PeriodShare[]; locale: Locale; aria: string }) {
  const H = 150;
  const m = { l: 40, r: 8, t: 8, b: 22 };
  type Known = { p: PeriodShare & { share: number; interval: { lo: number; hi: number } }; i: number };
  // Periods with no denominator have a null share and interval; they leave a gap in the line.
  const known = points
    .map((p, i) => ({ p, i }))
    .filter((e): e is Known => e.p.share !== null && e.p.interval !== null && Number.isFinite(e.p.share));
  const top = Math.min(1, Math.max(0.1, Math.ceil(Math.max(0, ...known.map(({ p }) => p.interval.hi)) * 10) / 10));
  const x = (i: number) => m.l + (points.length < 2 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (points.length - 1));
  const y = (v: number) => m.t + (1 - v / top) * (H - m.t - m.b);
  const band =
    known.length > 0
      ? `${known.map(({ p, i }) => `${x(i)},${y(p.interval.hi)}`).join(" ")} ${[...known]
          .reverse()
          .map(({ p, i }) => `${x(i)},${y(p.interval.lo)}`)
          .join(" ")}`
      : "";
  const line = known.map(({ p, i }) => `${x(i)},${y(p.share)}`).join(" ");
  return (
    <svg className="tl-fig" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={aria}>
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="tl-grid" />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" className="tl-tick">
            {pct(v, locale)}
          </text>
        </g>
      ))}
      {band && <polygon points={band} className="tl-band" />}
      {line && <polyline points={line} className="tl-line" fill="none" />}
      {known.map(({ p, i }) => (
        <circle key={p.from} cx={x(i)} cy={y(p.share)} r={2.5} className="tl-dot" />
      ))}
      {points.length > 0 && (
        <>
          <text x={m.l} y={H - 6} className="tl-tick">
            {points[0]?.from.slice(5)}
          </text>
          <text x={W - m.r} y={H - 6} textAnchor="end" className="tl-tick">
            {points[points.length - 1]?.to.slice(5)}
          </text>
        </>
      )}
    </svg>
  );
}

export function BetaCurve({ flat, discounted, locale, aria }: { flat: Beta; discounted: Beta | null; locale: Locale; aria: string }) {
  const H = 150;
  const m = { l: 8, r: 8, t: 8, b: 22 };
  const curves = [flat, ...(discounted ? [discounted] : [])];
  const lo = Math.min(...curves.map((c) => c.interval.lo));
  const hi = Math.max(...curves.map((c) => c.interval.hi));
  const pad = Math.max(0.01, hi - lo);
  const d0 = Math.max(0, lo - pad);
  const d1 = Math.min(1, hi + pad);
  const peak = Math.max(...curves.flatMap((c) => c.grid.filter((g) => g.x >= d0 && g.x <= d1).map((g) => g.y)), 1e-9);
  const x = (v: number) => m.l + ((v - d0) / (d1 - d0)) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - v / peak) * (H - m.t - m.b);
  const path = (c: Beta) =>
    c.grid
      .filter((g) => g.x >= d0 && g.x <= d1)
      .map((g) => `${x(g.x)},${y(g.y)}`)
      .join(" ");
  return (
    <svg className="tl-fig" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={aria}>
      <rect
        x={x(flat.interval.lo)}
        y={m.t}
        width={Math.max(1, x(flat.interval.hi) - x(flat.interval.lo))}
        height={H - m.t - m.b}
        className="tl-band"
      />
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="tl-grid" />
      <polyline points={path(flat)} className="tl-line" fill="none" />
      {discounted && <polyline points={path(discounted)} className="tl-line tl-line-alt" fill="none" />}
      {[d0, flat.mean, d1].map((v, i) => (
        <text key={v} x={x(v)} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="tl-tick">
          {pct(v, locale)}
        </text>
      ))}
      <line x1={x(flat.mean)} x2={x(flat.mean)} y1={m.t} y2={H - m.b} className="tl-mean" />
    </svg>
  );
}
