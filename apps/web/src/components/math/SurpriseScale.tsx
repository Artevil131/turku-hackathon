import { type Locale, t } from "@aei/i18n";
import { parameterDefaults } from "@aei/methods";
import { ALPHA, formatNum, formatPSup, surprise } from "./mathHelpers.ts";
import "./SurpriseScale.css";

export interface SurpriseScaleProps {
  p: number;
  /** DetectorAlert.detector; sets the alert threshold (D-020). */
  detector: string;
  locale: Locale;
}

const MAX = 6;

/** A tiny gauge of −log10 p (0 to 6+) with the detector's alert threshold marked. */
export function SurpriseScale({ p, detector, locale }: SurpriseScaleProps) {
  const alpha = ALPHA[detector] ?? parameterDefaults.phenotypeExcess.alpha;
  const value = surprise(p, MAX);
  const thr = -Math.log10(alpha);
  const past = p < alpha;
  const pos = (v: number) => `${(v / MAX) * 100}%`;
  const v = formatNum(-Math.log10(p), locale);
  const aria = t(locale, "mathSurpriseAria", { value: v, threshold: formatPSup(alpha, locale) });
  return (
    <span className="math-surprise" role="img" aria-label={aria}>
      <span className="ms-head">
        <span className="ms-label">{t(locale, "mathSurpriseLabel")}</span>
        <span className="ms-value">
          {v}
          {value >= MAX ? "+" : ""} {past ? "▲" : "▽"}
        </span>
      </span>
      <span className="ms-track" aria-hidden="true">
        <span className="ms-fill" style={{ width: pos(value) }} />
        <span className="ms-thr" style={{ left: pos(thr) }} />
      </span>
      <span className="ms-foot">
        <span>0</span>
        <span>6+</span>
      </span>
      <span className="ms-thr-label" style={{ paddingRight: `${(1 - thr / MAX) * 100}%` }}>
        {t(locale, "mathSurpriseThreshold", { alpha: formatPSup(alpha, locale) })}
      </span>
    </span>
  );
}
