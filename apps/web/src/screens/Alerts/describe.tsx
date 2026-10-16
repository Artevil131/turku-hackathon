import { SCREEN_ONLY } from "@aei/eucast";
import { Fragment, type ReactNode } from "react";
import type { FeedMeta, IsoDate } from "../../feed/types.ts";
import { formatDate, formatNumber, formatShare, type Locale, type MessageKey, t } from "../../i18n/index.ts";
import { daysBetween } from "../../model/dates.ts";
import {
  CLUSTER_ALPHA,
  CLUSTER_BASELINE_DAYS,
  CLUSTER_MIN_PATIENTS,
  CLUSTER_WINDOW_DAYS,
  EMPTY_RUN_ALPHA,
  GAP_ALPHA,
  GAP_BASELINE_DAYS,
  GAP_WINDOW_DAYS,
  INCIDENT_GAP_DAYS,
  NEW_FLAG_QUIET_DAYS,
  SURGE_ALPHA,
  SURGE_BASELINE_DAYS,
  SURGE_MIN_PATIENTS,
  SURGE_WINDOW_DAYS,
  TREND_ALPHA,
  TREND_BIN_DAYS,
  TREND_MIN_BINS,
} from "../../model/rules.ts";
import type { Share, Signal } from "../../model/types.ts";
import type { IconName } from "../../ui/index.ts";
import {
  antibioticByCode,
  antibioticName,
  MIN_ISOLATES,
  Org,
  shortOrganism,
  signalKindLabel,
  specimenName,
  unitByCode,
  unitName,
} from "../../ui/index.ts";
import type { TreatPrefs } from "../Treat/index.tsx";

// Turns one server alert (see model/alerts.ts) into plain clinical words:
// what happened, where and when, how unusual it is (observed against
// expected, never a bare p-value), who should act, and how it was found.
// Every name comes from the feed; every figure from the alert itself; every
// rule setting from the gears the server runs (model/rules.ts).

/** Text that may carry markup (italic organism names) plus the same as plain text. */
export interface Rich {
  node: ReactNode;
  text: string;
}

type Var = string | number | Rich;

export type Audience = "infection" | "lab" | "stewardship";

export interface Described {
  title: Rich;
  /** A second line: the resistance profile, the organism, the patient count. */
  sub: ReactNode | null;
  where: string;
  when: string;
  /** One line for the list: observed against usual. */
  short: string | null;
  how: string;
  chance: string | null;
  audience: Audience;
  /** The antibiotic is a screening test (resistant = positive), not a treatment. */
  screen: boolean;
  method: string[];
  /** Label of "see cases"; null when the signal has no isolates (data gap, trend). */
  casesLabel: string | null;
  /** Filters for "what still works here"; null when that question does not apply (a data gap). */
  treat: Partial<TreatPrefs> | null;
}

export const KIND_ICON: Record<Signal["kind"], IconName> = {
  sentinel: "alert-triangle",
  surge: "trend-up",
  cluster: "users",
  "data-gap": "wifi-off",
  shift: "trend-down",
  trend: "timeline",
};

export const AUDIENCE_ICON: Record<Audience, IconName> = { infection: "shield", lab: "flask", stewardship: "treat" };

/** Window lengths in words, from the server's detector settings. */
export const SPAN = {
  shiftWeeks: 4,
  shiftBeforeMonths: 12,
  clusterWeeks: Math.round(CLUSTER_WINDOW_DAYS / 7),
  trendMonths: Math.round((TREND_MIN_BINS * TREND_BIN_DAYS) / 30.44),
};

/** A screening test (e.g. the MRSA screen): resistant means positive, not a treatment that failed. */
const isScreen = (code: string | undefined) => !!code && (SCREEN_ONLY as readonly string[]).includes(code);

const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** t() with React nodes allowed as values; the sentence's first letter is capitalised. */
export function compose(locale: Locale, key: MessageKey, vars: Record<string, Var>): Rich {
  const parts = t(locale, key).split(/\{(\w+)\}/);
  const nodes: ReactNode[] = [];
  const texts: string[] = [];
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part) {
        nodes.push(part);
        texts.push(part);
      }
      return;
    }
    const v = vars[part];
    if (v === undefined) {
      nodes.push(`{${part}}`);
      texts.push(`{${part}}`);
    } else if (typeof v === "object") {
      nodes.push(<Fragment key={i}>{v.node}</Fragment>);
      texts.push(v.text);
    } else {
      nodes.push(String(v));
      texts.push(String(v));
    }
  });
  if (typeof nodes[0] === "string") nodes[0] = cap(nodes[0]);
  return { node: nodes, text: cap(texts.join("")) };
}

const organismVar = (name: string | undefined): Rich =>
  name ? { node: <Org name={name} short />, text: shortOrganism(name) } : { node: "–", text: "–" };

export function flagName(locale: Locale, s: Signal): string {
  return s.phenotype ? s.phenotype.toUpperCase() : t(locale, "alerts.flag");
}

export function whereName(locale: Locale, meta: FeedMeta, ward: string | null): string {
  return ward ? unitName(locale, meta, ward) : t(locale, "common.signal.hospital");
}

/** "on Urology" / "at Health centre South" / "hospital-wide": the preposition follows the unit's type in the feed. */
export function atPhrase(locale: Locale, meta: FeedMeta, ward: string | null): string {
  if (!ward) return t(locale, "alerts.at.hospital");
  const unit = unitByCode(meta, ward);
  return t(locale, unit?.type === "out" ? "alerts.at.out" : "alerts.at.in", { unit: unitName(locale, meta, ward) });
}

/** A short date; with the year when it is not the as-of year. */
export function dateText(locale: Locale, iso: IsoDate, asOf: IsoDate): string {
  return iso.slice(0, 4) === asOf.slice(0, 4) ? formatDate(locale, iso) : formatDate(locale, iso, "long");
}

function ago(locale: Locale, iso: IsoDate, asOf: IsoDate): string {
  const d = daysBetween(iso, asOf);
  if (d <= 0) return t(locale, "alerts.when.today");
  if (d === 1) return t(locale, "alerts.when.yesterday");
  return t(locale, "alerts.when.daysAgo", { count: formatNumber(locale, d) });
}

export function whenText(locale: Locale, s: Signal, asOf: IsoDate): string {
  if (s.firstDate === s.lastDate)
    return `${t(locale, "alerts.when.on", { date: dateText(locale, s.firstDate, asOf) })} · ${ago(locale, s.lastDate, asOf)}`;
  const since = t(locale, "alerts.when.since", { date: dateText(locale, s.firstDate, asOf) });
  if (s.lastDate >= asOf) return `${since} · ${t(locale, "alerts.when.ongoing")}`;
  return `${since} · ${t(locale, "alerts.when.last", { date: dateText(locale, s.lastDate, asOf) })} (${ago(locale, s.lastDate, asOf)})`;
}

/** "about 2" / "fewer than 1": what history predicts, in words. */
export function expectedText(locale: Locale, expected: number): string {
  if (expected < 1) return t(locale, "alerts.exp.lessThanOne");
  return t(locale, "alerts.exp.about", { n: formatNumber(locale, Math.round(expected)) });
}

/** The share as "72 % (23 of 32)", or only "4 of 9" below the organiser's 30 isolates. */
export function shareText(locale: Locale, share: Share, mode: "works" | "fails"): string {
  const k = mode === "works" ? share.works : share.n - share.works;
  const vars = { works: formatNumber(locale, k), n: formatNumber(locale, share.n) };
  if (share.n >= MIN_ISOLATES && share.n > 0) return t(locale, "alerts.share.pct", { ...vars, percent: formatShare(locale, k / share.n) });
  return t(locale, "alerts.share.count", vars);
}

/** Just the percentage, or null below 30 isolates. */
export function percentText(locale: Locale, share: Share | undefined, mode: "works" | "fails"): string | null {
  if (!share || share.n < MIN_ISOLATES || share.n === 0) return null;
  const k = mode === "works" ? share.works : share.n - share.works;
  return formatShare(locale, k / share.n);
}

/** The share's percentage when it may be shown, else the plain count. */
function shortShare(locale: Locale, share: Share, mode: "works" | "fails"): string {
  return percentText(locale, share, mode) ?? shareText(locale, share, mode);
}

function chanceText(locale: Locale, p: number | undefined): string | null {
  if (p === undefined || !Number.isFinite(p)) return null;
  if (p < 0.0001) return t(locale, "alerts.chance.very");
  if (p < 0.01) return t(locale, "alerts.chance.some");
  return null;
}

function pText(locale: Locale, p: number): string {
  return p < 0.0001 ? `< ${formatNumber(locale, 0.0001, 4)}` : `= ${formatNumber(locale, p, 4)}`;
}

const alpha = (locale: Locale, a: number) => formatNumber(locale, a, 6);

/** Antibiotic names in the feed's own order (it groups them by class). */
function resistsList(locale: Locale, meta: FeedMeta, codes: readonly string[]): string {
  const order = new Map(meta.antibiotics.map((a, i) => [a.code, i]));
  return [...codes]
    .sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9) || (a < b ? -1 : 1))
    .map((c) => antibioticName(locale, meta, c))
    .join(", ");
}

export function describe(locale: Locale, meta: FeedMeta, s: Signal, asOf: IsoDate): Described {
  const n = (x: number) => formatNumber(locale, x);
  const unit = whereName(locale, meta, s.ward);
  const at = atPhrase(locale, meta, s.ward);
  const screen = isScreen(antibioticByCode(meta, s.antibiotic)?.code);
  const flag = flagName(locale, s);
  const specimen = s.specimen ? specimenName(locale, meta, s.specimen) : "";
  const antibiotic = s.antibiotic ? antibioticName(locale, meta, s.antibiotic) : "";
  const organism = organismVar(s.organism);
  const where = specimen ? `${unit} · ${specimen}` : unit;
  const when = whenText(locale, s, asOf);
  const chance = chanceText(locale, s.p);
  const exp = s.expected !== undefined ? expectedText(locale, s.expected) : null;
  const ids = new Set(s.isolateIds).size;
  const patientsLine = (count: number) =>
    count === 1 ? t(locale, "alerts.sub.patient") : t(locale, "alerts.sub.patients", { count: n(count) });

  let title: Rich;
  let sub: ReactNode | null = null;
  let short: string | null = null;
  let how: string;
  let audience: Audience;
  const method: string[] = [];

  switch (s.kind) {
    case "sentinel": {
      // Every CPE is reported (D-014); MRSA or VRE when new on an inpatient unit (D-021).
      const always = s.source === "cpe";
      audience = "infection";
      if (always) {
        title = compose(locale, s.organism ? "alerts.t.sentinel" : "alerts.t.sentinelAny", { flag, organism, where: at });
        how = t(locale, "alerts.how.sentinel", { flag });
        short = patientsLine(s.patients ?? s.observed);
        method.push(t(locale, "alerts.m.sentinel", { flag, gap: n(INCIDENT_GAP_DAYS) }));
      } else {
        title = compose(locale, s.organism ? "alerts.t.back" : "alerts.t.backAny", { flag, organism, where: at });
        how = t(locale, "alerts.how.back", { flag, days: n(NEW_FLAG_QUIET_DAYS) });
        short = t(locale, "alerts.short.back", { days: n(NEW_FLAG_QUIET_DAYS) });
        method.push(t(locale, "alerts.m.back", { flag, quiet: n(NEW_FLAG_QUIET_DAYS), gap: n(INCIDENT_GAP_DAYS) }));
        if ((s.patients ?? s.observed) > 1) sub = patientsLine(s.patients ?? s.observed);
      }
      break;
    }
    case "surge": {
      audience = "infection";
      title = compose(locale, "alerts.t.surge", { flag, where: at, count: n(s.observed), days: n(SURGE_WINDOW_DAYS) });
      if (s.organism) sub = <Org name={s.organism} />;
      how = exp
        ? t(locale, "alerts.how.surge", { observed: n(s.observed), flag, days: n(SURGE_WINDOW_DAYS), expected: exp })
        : patientsLine(s.observed);
      short = exp ? t(locale, "alerts.short.patients", { count: n(s.observed), expected: exp }) : patientsLine(s.observed);
      method.push(
        t(locale, "alerts.m.surge", {
          flag,
          days: n(SURGE_WINDOW_DAYS),
          base: n(SURGE_BASELINE_DAYS),
          min: n(SURGE_MIN_PATIENTS),
          alpha: alpha(locale, SURGE_ALPHA),
        }),
      );
      break;
    }
    case "cluster": {
      audience = "infection";
      title = compose(locale, "alerts.t.cluster", { organism, specimen, count: n(s.observed), where: at, weeks: n(SPAN.clusterWeeks) });
      if (s.resists?.length) sub = t(locale, "alerts.sub.resists", { list: resistsList(locale, meta, s.resists) });
      how = exp
        ? t(locale, "alerts.how.cluster", { observed: n(s.observed), weeks: n(SPAN.clusterWeeks), expected: exp })
        : patientsLine(s.observed);
      short = exp ? t(locale, "alerts.short.patients", { count: n(s.observed), expected: exp }) : patientsLine(s.observed);
      method.push(
        t(locale, "alerts.m.cluster", {
          days: n(CLUSTER_WINDOW_DAYS),
          base: n(CLUSTER_BASELINE_DAYS),
          min: n(CLUSTER_MIN_PATIENTS),
          alpha: alpha(locale, CLUSTER_ALPHA),
        }),
      );
      break;
    }
    case "data-gap": {
      audience = "lab";
      title = compose(locale, s.observed === 0 ? "alerts.t.gapNone" : "alerts.t.gapFew", { unit });
      const days = s.windowDays ?? GAP_WINDOW_DAYS;
      how = t(locale, "alerts.how.gap", { observed: n(s.observed), days: n(days), expected: exp ?? "–" });
      short = exp ? t(locale, "alerts.short.results", { count: n(s.observed), days: n(days), expected: exp }) : null;
      method.push(
        t(locale, "alerts.m.gap", {
          days: n(GAP_WINDOW_DAYS),
          base: n(GAP_BASELINE_DAYS),
          alpha: alpha(locale, GAP_ALPHA),
          runAlpha: alpha(locale, EMPTY_RUN_ALPHA),
        }),
      );
      break;
    }
    case "shift": {
      // A screening test (e.g. an MRSA screen) is not a treatment: more positives means more of the resistant type.
      audience = screen ? "infection" : "stewardship";
      title = compose(locale, screen ? "alerts.t.shiftScreen" : "alerts.t.shift", { antibiotic, organism, specimen, where: at });
      if (s.recent && s.baseline) {
        const mode = screen ? "fails" : "works";
        how = t(locale, screen ? "alerts.how.screen" : "alerts.how.shift", {
          recent: shareText(locale, s.recent, mode),
          weeks: n(SPAN.shiftWeeks),
          base: shareText(locale, s.baseline, mode),
          months: n(SPAN.shiftBeforeMonths),
        });
        short = t(locale, screen ? "alerts.short.screen" : "alerts.short.shift", {
          recent: shortShare(locale, s.recent, mode),
          base: shortShare(locale, s.baseline, mode),
        });
      } else {
        how = "";
      }
      // No server detector raises a shift (D-032); the case stays so older links still read.
      break;
    }
    case "trend": {
      audience = screen ? "infection" : "stewardship";
      const from = percentText(locale, s.baseline, "fails");
      const to = percentText(locale, s.recent, "fails");
      const figures = from !== null && to !== null;
      const key: MessageKey = screen
        ? figures
          ? "alerts.t.trendScreen"
          : "alerts.t.trendScreenPlain"
        : figures
          ? "alerts.t.trend"
          : "alerts.t.trendPlain";
      title = compose(locale, key, { antibiotic, organism, specimen, where: at, from: from ?? "", to: to ?? "" });
      how =
        s.recent && s.baseline
          ? t(locale, screen ? "alerts.how.trendScreen" : "alerts.how.trend", {
              recent: shareText(locale, s.recent, "fails"),
              months: n(SPAN.trendMonths),
              base: shareText(locale, s.baseline, "fails"),
            })
          : t(locale, "alerts.how.trendBlock", { percent: formatShare(locale, s.observed), bin: n(TREND_BIN_DAYS) });
      short = figures ? t(locale, screen ? "alerts.short.trendScreen" : "alerts.short.trend", { from, to }) : null;
      method.push(
        t(locale, "alerts.m.trend", {
          bin: n(TREND_BIN_DAYS),
          alpha: alpha(locale, TREND_ALPHA),
          bins: n(TREND_MIN_BINS),
        }),
      );
      break;
    }
    default: {
      audience = "infection";
      title = compose(locale, "alerts.t.other", { kind: signalKindLabel(locale, s.kind), where: at });
      how = "";
    }
  }

  if (s.p !== undefined && Number.isFinite(s.p)) method.push(t(locale, "alerts.m.p", { p: pText(locale, s.p) }));
  if (s.kind !== "data-gap") method.push(t(locale, "alerts.m.counting"));

  let casesLabel: string | null = null;
  if (ids > 0) {
    if (s.kind === "shift") casesLabel = t(locale, screen ? "alerts.act.casesScreen" : "alerts.act.casesShift", { count: n(ids) });
    else casesLabel = ids === 1 ? t(locale, "alerts.act.case") : t(locale, "alerts.act.cases", { count: n(ids) });
  }

  let treat: Partial<TreatPrefs> | null = null;
  if (s.kind !== "data-gap") {
    const patch: Partial<TreatPrefs> = {};
    if (s.ward) patch.ward = s.ward;
    if (s.specimen) patch.specimen = s.specimen;
    treat = patch;
  }

  return { title, sub, where, when, short, how, chance, audience, screen, method, casesLabel, treat };
}
