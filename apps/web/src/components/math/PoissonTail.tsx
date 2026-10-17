import { type Locale, t } from "@aei/i18n";
import { formatNum, formatPSup, poissonPlan } from "./mathHelpers.ts";
import "./PoissonTail.css";

export interface PoissonTailProps {
  observed: number;
  expected: number;
  p: number;
  /** DetectorAlert.detector */
  detector: string;
  locale: Locale;
}

const W = 320;
const H = 132;
const L = 28;
const R = 8;
const T = 22;
const B = 28;

/** The live detector's Poisson test (D-020) drawn: mass of Poisson(expected), the tail that gave p shaded (ENGINE.md section 2). */
export function PoissonTail({ observed, expected, p, detector, locale }: PoissonTailProps) {
  const plan = poissonPlan(detector, observed, expected);
  if (!plan) return <p className="math-note">{t(locale, "mathNoCount")}</p>;
  const n = plan.bars.length;
  const pw = W - L - R;
  const bw = pw / n;
  const max = Math.max(...plan.bars.map((b) => b.pmf), 1e-9);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const x = (k: number) => L + (k - plan.kMin) * bw;
  const exp = formatNum(plan.mean, locale);
  const obs = formatNum(plan.tail === "zero-run" ? 0 : observed, locale);
  const ps = formatPSup(p, locale);
  const capKey = plan.tail === "upper" ? "mathCapUpper" : plan.tail === "lower" ? "mathCapLower" : "mathCapZero";
  const tailKey = plan.tail === "upper" ? "mathTailUpper" : plan.tail === "lower" ? "mathTailLower" : "mathTailZero";
  const caption = t(locale, capKey, { observed: obs, expected: exp, p: ps, days: observed });
  const tailText = t(locale, tailKey, { observed: obs });
  const aria = t(locale, "mathPoissonAria", { expected: exp, observed: obs, tail: tailText, p: ps });
  const step = n > 40 ? 10 : n > 20 ? 5 : n > 10 ? 2 : 1;
  const meanX = L + (plan.mean - plan.kMin + 0.5) * bw;
  const obsX = x(plan.k) + bw / 2;
  return (
    <figure className="math-poisson">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria} className="math-poisson-svg">
        <line className="mp-axis" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
        <rect
          className="mp-band"
          x={x(plan.tail === "upper" ? plan.k : plan.kMin)}
          width={(plan.tail === "upper" ? plan.kMax - plan.k + 1 : plan.k - plan.kMin + 1) * bw}
          y={T}
          height={y(0) - T}
        />
        {plan.bars.map((b) => (
          <rect
            key={b.k}
            className={b.shaded ? "mp-bar mp-bar-tail" : "mp-bar"}
            x={x(b.k) + Math.min(1, bw * 0.12)}
            width={Math.max(1, bw - Math.min(2, bw * 0.24))}
            y={y(b.pmf)}
            height={Math.max(0, y(0) - y(b.pmf))}
          />
        ))}
        {/* the observed bar: outlined, plus a triangle marker, so it does not rely on fill alone */}
        <rect className="mp-obs" x={x(plan.k)} width={bw} y={T} height={y(0) - T} />
        <path className="mp-mark" d={`M${obsX - 4} ${y(0) + 12}L${obsX + 4} ${y(0) + 12}L${obsX} ${y(0) + 5}Z`} />
        <line className="mp-usual" x1={meanX} x2={meanX} y1={T - 6} y2={y(0)} />
        <text className="mp-label" x={meanX > W * 0.6 ? meanX - 3 : meanX + 3} textAnchor={meanX > W * 0.6 ? "end" : "start"} y={T - 8}>
          {t(locale, "mathUsual")} {exp}
        </text>
        {plan.bars
          .filter((b) => b.k % step === 0)
          .map((b) => (
            <text key={b.k} className="mp-tick" x={x(b.k) + bw / 2} y={H - 10} textAnchor="middle">
              {b.k}
            </text>
          ))}
      </svg>
      <figcaption className="math-poisson-cap">
        <span className="math-poisson-test">{t(locale, "mathTestLabel")} · D-020</span>
        <span className="math-poisson-formula">{caption}</span>
        <span className="math-poisson-legend">
          <i className="mp-sw mp-sw-tail" aria-hidden="true" /> {tailText}
        </span>
      </figcaption>
    </figure>
  );
}
