import { Fragment, type ReactNode } from "react";
import { DEFAULT_COVERAGE, EVERY_UNIT, isScreen } from "../../engine/coverage.ts";
import type { PatientQuery, Share, Signal, Widening } from "../../engine/types.ts";
import type { FeedMeta } from "../../feed/types.ts";
import { formatNumber, formatShare, t, type Locale, type MessageKey } from "../../i18n/index.ts";
import { antibioticByCode, antibioticName, Org, signalKindLabel, specimenName, unitName } from "../../ui/index.ts";
import { capFirst, humanize, midSentence, type coverGap } from "./model.ts";

// Words for the Treat screen, built from t() and the feed's own names.

/** Weeks in the engine's recent window and months in its year window (from the engine's defaults). */
export const WEEKS = Math.round(DEFAULT_COVERAGE.recentDays / 7);
export const MONTHS = Math.round(DEFAULT_COVERAGE.yearDays / 30.44);

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

/** "men 65+ caught in hospital" (en) / "miehet, 65+, sairaalassa saatu" (fi), or null when no group filter is set. */
export function whoPhrase(locale: Locale, q: PatientQuery): string | null {
  const parts: string[] = [];
  if (q.sex === "F") parts.push(t(locale, "treat.who.F"));
  else if (q.sex === "M") parts.push(t(locale, "treat.who.M"));
  else if (q.sex) parts.push(q.sex);
  if (q.age) {
    if (!q.sex) parts.push(t(locale, "treat.who.patients"));
    parts.push(t(locale, q.age === "65plus" ? "treat.who.65plus" : "treat.who.under65"));
  }
  if (q.onset) {
    if (!q.sex && !q.age) parts.push(t(locale, "treat.who.patients"));
    parts.push(t(locale, q.onset === "hospital" ? "treat.who.hospital" : "treat.who.community"));
  }
  return parts.length ? parts.join(t(locale, "treat.who.sep")) : null;
}

const DIM_KEY: Record<Widening, MessageKey> = {
  age: "treat.dim.age",
  sex: "treat.dim.sex",
  onset: "treat.dim.onset",
  ward: "treat.dim.ward",
};

function list(locale: Locale, items: string[]): string {
  try {
    return new Intl.ListFormat(locale === "fi" ? "fi-FI" : "en-GB", { type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** The amber line when the engine widened the group: who was too few, what was left out, what is shown instead. */
export function widenedText(locale: Locale, meta: FeedMeta, asked: PatientQuery, used: PatientQuery, widened: readonly Widening[], min: number): string {
  const specimen = midSentence(specimenName(locale, meta, asked.specimen));
  const who = whoPhrase(locale, asked) ?? t(locale, "treat.who.samples", { specimen });
  const group = whoPhrase(locale, used);
  const everyUnit = used.ward === EVERY_UNIT;
  const usedUnit = everyUnit ? "" : unitName(locale, meta, used.ward);
  const shown = group
    ? everyUnit
      ? t(locale, "treat.shown.groupAll", { group, specimen })
      : t(locale, "treat.shown.groupUnit", { group, specimen, unit: usedUnit })
    : everyUnit
      ? t(locale, "treat.shown.all", { specimen })
      : t(locale, "treat.shown.unit", { specimen, unit: usedUnit });
  return t(locale, "treat.widened", {
    who,
    unit: unitName(locale, meta, asked.ward),
    min: formatNumber(locale, min),
    dropped: list(
      locale,
      widened.map((w) => t(locale, DIM_KEY[w])),
    ),
    shown,
  });
}

/** "84 % · 110/131", "9 results — too few" or "No results". */
export function figText(locale: Locale, share: Share, min: number): string {
  if (share.n === 0) return t(locale, "treat.fig.none");
  if (share.n < min) return share.n === 1 ? t(locale, "treat.fig.tooFewOne") : t(locale, "treat.fig.tooFew", { n: formatNumber(locale, share.n) });
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

/** "Rests on 418 of 523 · not tested for E. faecalis, P. aeruginosa": what a figure leaves out. */
export function coverText(locale: Locale, gap: NonNullable<ReturnType<typeof coverGap>>): ReactNode {
  const names = gap.names.map((o, i) => (
    <Fragment key={o}>
      {i > 0 ? ", " : ""}
      <Org name={o} short />
    </Fragment>
  ));
  return tn(locale, gap.more > 0 ? "treat.cover.more" : "treat.cover.line", {
    known: formatNumber(locale, gap.known),
    total: formatNumber(locale, gap.total),
    list: <>{names}</>,
    more: formatNumber(locale, gap.more),
  });
}

/** "doesn't work" share (positives, for a screening test) inside a sentence: a percentage from `min`, else "4/9". */
function failShare(locale: Locale, share: Share | undefined, min: number): string {
  if (!share || share.n === 0) return "–";
  const r = share.n - share.works;
  if (share.n < min) return `${formatNumber(locale, r)}/${formatNumber(locale, share.n)}`;
  return formatShare(locale, r / share.n);
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
  const patients = count === 1 ? t(locale, "treat.signal.patientsOne") : t(locale, "treat.signal.patients", { count: formatNumber(locale, count) });
  const flag = s.phenotype ? s.phenotype.toUpperCase() : signalKindLabel(locale, s.kind);
  const organism = s.organism ? <Org name={s.organism} short /> : "–";
  const expected = formatNumber(locale, s.expected ?? 0, (s.expected ?? 0) >= 10 ? 0 : 1);
  const antibiotic = s.antibiotic ? drugName(locale, meta, s.antibiotic) : "";
  // A screening test (e.g. an MRSA screen) is not a treatment: more positives, not "works less often".
  const drug = antibioticByCode(meta, s.antibiotic);
  const screen = drug ? isScreen(drug) : false;
  const recent = screen ? failShare(locale, s.recent, min) : shortShare(locale, s.recent, min);
  const before = screen ? failShare(locale, s.baseline, min) : shortShare(locale, s.baseline, min);
  const key: MessageKey = screen && (s.kind === "shift" || s.kind === "trend") ? "treat.signal.screen" : `treat.signal.${s.kind}`;
  return tn(locale, key, {
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
