import { useId } from "react";

/*
  Sparkline: a small trend line (SVG). Gaps (null) break the line, so months
  with too few results are not drawn as if they were known.
    values     (number | null)[]     oldest first
    label      string                accessible description, required ("Resistance by month, last 12 months: 8 % to 14 %")
    band?      { lo: (number|null)[]; hi: (number|null)[] }   a shaded expected range (e.g. history), same length as values
    min?, max? number                y range; default from the data (and band)
    width?     number                px, default 120 (ignored when fluid)
    height?    number                px, default 32
    fluid?     boolean               stretch to the container width
    tone?      "neutral" | "high" | "medium" | "good"
    last?      boolean               dot on the last known value, default true
    marks?     number[]              indexes to mark with a small dot (e.g. when a signal fired)
*/

export function Sparkline({
  values,
  label,
  band,
  min,
  max,
  width = 120,
  height = 32,
  fluid = false,
  tone = "neutral",
  last = true,
  marks,
}: {
  values: readonly (number | null)[];
  label: string;
  band?: { lo: readonly (number | null)[]; hi: readonly (number | null)[] };
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  fluid?: boolean;
  tone?: "neutral" | "high" | "medium" | "good";
  last?: boolean;
  marks?: readonly number[];
}) {
  const clip = useId();
  const W = fluid ? 300 : width;
  const H = height;
  const pad = 3;
  const known = [...values, ...(band?.lo ?? []), ...(band?.hi ?? [])].filter((v): v is number => v !== null && Number.isFinite(v));
  let lo = min ?? (known.length ? Math.min(...known) : 0);
  let hi = max ?? (known.length ? Math.max(...known) : 1);
  if (hi - lo < 1e-9) {
    lo -= 0.5;
    hi += 0.5;
  }
  const n = values.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);

  // Line segments, broken at nulls.
  const segments: string[] = [];
  let cur = "";
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  let bandPath = "";
  if (band) {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i < n; i++) {
      const a = band.lo[i];
      const b = band.hi[i];
      if (a == null || b == null) continue;
      top.push(`${x(i).toFixed(1)},${y(b).toFixed(1)}`);
      bottom.unshift(`${x(i).toFixed(1)},${y(a).toFixed(1)}`);
    }
    if (top.length > 1) bandPath = `M${top.join("L")}L${bottom.join("L")}Z`;
  }

  let lastIndex = -1;
  for (let i = n - 1; i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      lastIndex = i;
      break;
    }
  }
  const lastValue = lastIndex >= 0 ? values[lastIndex] : null;

  return (
    <svg
      className={`k-spark tone-${tone}${fluid ? " is-fluid" : ""}`}
      width={fluid ? "100%" : W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={clip}>
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {bandPath ? <path className="k-spark-band" d={bandPath} /> : null}
        {segments.map((d) => (
          <path key={d} className="k-spark-line" d={d} vectorEffect="non-scaling-stroke" />
        ))}
        {!fluid && marks
          ? marks.map((i) => {
              const v = values[i];
              return v == null ? null : <circle key={`m${i}`} className="k-spark-mark" cx={x(i)} cy={y(v)} r={2.5} />;
            })
          : null}
        {!fluid && last && lastValue != null ? <circle className="k-spark-dot" cx={x(lastIndex)} cy={y(lastValue)} r={2.75} /> : null}
      </g>
    </svg>
  );
}
