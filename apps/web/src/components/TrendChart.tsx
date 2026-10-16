import { formatMonth, type Locale, t } from "@aei/i18n";
import { useState } from "react";
import type { MonthPoint } from "../examples.ts";

// Twelve months of % susceptible: this unit against the hospital. Months
// with fewer isolates than the reporting floor draw as hollow points with
// no line through them.

const W = 640;
const H = 200;
const PAD = { top: 14, right: 16, bottom: 26, left: 40 };

export function TrendChart({
  locale,
  points,
  minIsolates,
  unitLabel,
}: {
  locale: Locale;
  points: MonthPoint[];
  minIsolates: number;
  unitLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const s = (r: number) => 100 - r;
  const values = points.flatMap((p) => [p.unit.n >= minIsolates ? s(p.unit.r) : 100, s(p.hospital.r)]);
  const lo = Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10);
  const ticks = [lo, Math.round((lo + 100) / 2), 100];
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (points.length - 1);
  const y = (v: number) => PAD.top + ((100 - v) * (H - PAD.top - PAD.bottom)) / (100 - lo || 1);

  // Unit line in segments broken at thin months.
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.unit.n >= minIsolates) current += `${current ? "L" : "M"}${x(i)},${y(s(p.unit.r))}`;
    else if (current) {
      segments.push(current);
      current = "";
    }
  });
  if (current) segments.push(current);
  const hospital = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(s(p.hospital.r))}`).join("");
  const hp = hover === null ? null : points[hover];

  return (
    <figure className="trend">
      <div className="trend-legend">
        <span>
          <i className="key key-unit" aria-hidden="true" />
          {unitLabel}
        </span>
        <span>
          <i className="key key-hospital" aria-hidden="true" />
          {t(locale, "hospital")}
        </span>
        <span className="muted">{t(locale, "trendAxis")}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend-svg"
        role="img"
        aria-label={t(locale, "trendTitle")}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="grid" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="tick">
              {v}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % 2 === 0 || i === points.length - 1 ? (
            <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle" className="tick">
              {formatMonth(locale, p.month)}
            </text>
          ) : null,
        )}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" /> : null}
        <path d={hospital} className="line-hospital" />
        {segments.map((d) => (
          <path key={d} d={d} className="line-unit" />
        ))}
        {points.map((p, i) =>
          p.unit.n >= minIsolates ? (
            <circle key={p.month} cx={x(i)} cy={y(s(p.unit.r))} r={i === points.length - 1 ? 4.5 : 3} className="pt-unit" />
          ) : (
            <circle key={p.month} cx={x(i)} cy={y(100) + 6} r="3.5" className="pt-thin" />
          ),
        )}
        {points.map((p, i) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: the hover readout is a convenience; every value is also listed beside the chart
          <rect
            key={`hit-${p.month}`}
            x={x(i) - (W - PAD.left - PAD.right) / (points.length - 1) / 2}
            y={0}
            width={(W - PAD.left - PAD.right) / (points.length - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <figcaption className="trend-readout num" aria-live="polite">
        {hp ? (
          <>
            <b>{formatMonth(locale, hp.month, true)}</b> · {unitLabel}:{" "}
            {hp.unit.n >= minIsolates
              ? `${Math.round(s(hp.unit.r))} % (n ${hp.unit.n})`
              : t(locale, "thinData", { n: hp.unit.n, min: minIsolates })}{" "}
            · {t(locale, "hospital")}: {Math.round(s(hp.hospital.r))} % (n {hp.hospital.n})
          </>
        ) : (
          t(locale, "trendHint")
        )}
      </figcaption>
    </figure>
  );
}
