import { Fragment, type ReactNode } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, formatShare, type Locale, type MessageKey, t } from "../../i18n/index.ts";
import type { Share, Signal } from "../../model/types.ts";
import { antibioticName, Org, signalKindLabel, unitName } from "../../ui/index.ts";
import { capFirst, humanize } from "./model.ts";

// Words for the Treat screen, built from t() and the feed's own names.

/** The server's windows (libs/utils/coverage): a year of first isolates, and the unit's last 28 days for context. */
export const WEEKS = 4;
export const MONTHS = 12;

/** A message whose {placeholders} may be React nodes (e.g. an italic organism name). */
export function tn(locale: Locale, key: MessageKey, vars: Record<string, ReactNode>): ReactNode {
  const parts = t(locale, key).split(/(\{\w+\})/);
  return parts.map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return part;
    const v = vars[m[1]!];
    return <Fragment key={i}>{v === undefined ? part : v}</Fragment>;
  });
}

/** "Woman" / "Man" for the patient chips; any other sex code is shown as the feed writes it. */
export function sexChipLabel(locale: Locale, code: string): string {
  if (code === "F") return t(locale, "treat.sex.F");
  if (code === "M") return t(locale, "treat.sex.M");
  return code;
}

export function institutionLabel(locale: Locale, code: string): string {
  if (code === "hospital") return t(locale, "treat.institution.hospital");
  if (code === "primary_care") return t(locale, "treat.institution.primary_care");
  return humanize(code);
}

/** "A, B and C" in the reader's language. */
export function listText(locale: Locale, items: string[]): string {
  try {
    return new Intl.ListFormat(locale === "fi" ? "fi-FI" : "en-GB", { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** "84 % · 110/131", "9 results — too few" or "No results". */
export function figText(locale: Locale, share: Share, min: number): string {
  if (share.n === 0) return t(locale, "treat.fig.none");
  if (share.n < min)
    return share.n === 1 ? t(locale, "treat.fig.tooFewOne") : t(locale, "treat.fig.tooFew", { n: formatNumber(locale, share.n) });
  return t(locale, "treat.fig.value", {
    percent: formatShare(locale, share.works / share.n),
    works: formatNumber(locale, share.works),
    n: formatNumber(locale, share.n),
  });
}

/** A share inside a sentence: a percentage from at least `min`, otherwise the plain count "9/14". */
export function shortShare(locale: Locale, share: Share | undefined, min: number): string {
  if (!share || share.n === 0) return "–";
  if (share.n < min) return `${formatNumber(locale, share.works)}/${formatNumber(locale, share.n)}`;
  return formatShare(locale, share.works / share.n);
}

export function drugName(locale: Locale, meta: FeedMeta, code: string): string {
  return capFirst(antibioticName(locale, meta, code));
}

/** One plain sentence for a signal on the doctor's screen. */
export function signalSentence(locale: Locale, meta: FeedMeta, s: Signal, ward: string, min: number): ReactNode {
  const where =
    s.ward === null
      ? t(locale, "treat.signal.hospital")
      : s.ward === ward
        ? t(locale, "treat.signal.thisUnit")
        : t(locale, "treat.signal.onUnit", { unit: unitName(locale, meta, s.ward) });
  const count = s.patients ?? s.observed;
  const patients =
    count === 1 ? t(locale, "treat.signal.patientsOne") : t(locale, "treat.signal.patients", { count: formatNumber(locale, count) });
  const flag = s.phenotype ? s.phenotype.toUpperCase() : signalKindLabel(locale, s.kind);
  const organism = s.organism ? <Org name={s.organism} short /> : "–";
  const expected = formatNumber(locale, s.expected ?? 0, (s.expected ?? 0) >= 10 ? 0 : 1);
  const antibiotic = s.antibiotic ? drugName(locale, meta, s.antibiotic) : "";
  const recent = shortShare(locale, s.recent, min);
  const before = shortShare(locale, s.baseline, min);
  return tn(locale, `treat.signal.${s.kind}`, {
    where,
    patients,
    flag,
    organism,
    expected,
    observed: formatNumber(locale, s.observed),
    antibiotic,
    recent,
    before,
  });
}
