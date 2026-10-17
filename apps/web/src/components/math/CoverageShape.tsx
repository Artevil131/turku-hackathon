import { type Locale, t } from "@aei/i18n";
import { betaCurve, formatNum } from "./mathHelpers.ts";
import "./CoverageShape.css";

export interface CoverageShapeProps {
  covered: number;
  known: number;
  /** The list's 95 % Wilson interval (D-023), as shares 0..1. */
  interval: [number, number] | null;
  /** The bar as a share: 0.8 (mild) or 0.9 (severe). */
  bar: number;
  locale: Locale;
}

const W = 320;
const H = 112;
const L = 8;
const R = 8;
const T = 20;
const B = 24;

/** The likelihood of the share given `covered` of `known`: Beta(covered+1, known−covered+1), flat prior (ENGINE.md section 3). */
export function CoverageShape({ covered, known, interval, bar, locale }: CoverageShapeProps) {
  if (known <= 0) return <p className="cs-note">{t(locale, "mathNoData")}</p>;
  const curve = betaCurve(covered, known);
  const max = Math.max(...curve.map((c) => c.y), 1e-9);
  const px = (s: number) => L + s * (W - L - R);
  const py = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = curve.map((c, i) => `${i ? "L" : "M"}${px(c.x).toFixed(1)} ${py(c.y).toFixed(1)}`).join("");
  const share = covered / known;
  const pct = (s: number) => formatNum(s * 100, locale);
  const lo = interval ? pct(interval[0]) : "";
  const hi = interval ? pct(interval[1]) : "";
  const aria = t(locale, "mathCoverageAria", { covered, known, share: pct(share), lo, hi, bar: pct(bar) });
  const caption = t(locale, "mathCoverageCaption", { covered, known });
  const base = py(0);
  const dotY = py(curve[Math.min(200, Math.round(share * 200))]?.y ?? 0);
  return (
    <figure className="math-cshape">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="cs-svg">
        {interval && <rect className="cs-band" x={px(interval[0])} y={T} width={px(interval[1]) - px(interval[0])} height={base - T} />}
        <path className="cs-area" d={`${path}L${px(1)} ${base}L${px(0)} ${base}Z`} />
        <path className="cs-curve" d={path} />
        <line className="cs-axis" x1={L} x2={W - R} y1={base} y2={base} />
        <line className="cs-bar" x1={px(bar)} x2={px(bar)} y1={T - 12} y2={base} />
        <text className="cs-tick" x={px(bar) + (bar > 0.85 ? -3 : 3)} y={T - 7} textAnchor={bar > 0.85 ? "end" : "start"}>
          {t(locale, "mathBar", { bar: pct(bar) })}
        </text>
        <circle className="cs-dot" cx={px(share)} cy={dotY} r="4" />
        {[0, 25, 50, 75, 100].map((v) => (
          <text key={v} className="cs-tick" x={px(v / 100)} y={H - 8} textAnchor={v === 0 ? "start" : v === 100 ? "end" : "middle"}>
            {v} %
          </text>
        ))}
      </svg>
      <figcaption className="cs-cap">
        {interval && (
          <span className="cs-int">
            <i className="cs-sw" aria-hidden="true" /> {t(locale, "mathInterval", { lo, hi })} · {covered}/{known} = {pct(share)} %
          </span>
        )}
        <span className="cs-text">{caption}</span>
      </figcaption>
    </figure>
  );
}
