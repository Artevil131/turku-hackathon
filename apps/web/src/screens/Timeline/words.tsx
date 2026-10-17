import { Fragment, type ReactNode } from "react";
import type { FeedMeta } from "../../feed/types.ts";
import { formatDate, formatNumber, formatShare, type Locale, type MessageKey, t } from "../../i18n/index.ts";
import { CLUSTER_WINDOW_DAYS, GAP_WINDOW_DAYS, NEW_FLAG_QUIET_DAYS, SURGE_WINDOW_DAYS, TREND_BIN_DAYS } from "../../model/rules.ts";
import type { Share, Signal } from "../../model/types.ts";
import { antibioticName, signalKindLabel, specimenName, unitName } from "../../ui/defaults.ts";
import { Org } from "../../ui/Org.tsx";
import { MIN_ISOLATES } from "../../ui/ShareBar.tsx";

// Plain words for one signal: its title, where, when, and a one-line summary
// built from the signal's own numbers. Organism names come back in italics.

export const flagLabel = (flag: string | undefined) => (flag ? flag.toUpperCase() : "");

export function signalTitle(locale: Locale, s: Signal): string {
  const kind = signalKindLabel(locale, s.kind);
  return s.phenotype ? `${kind} (${flagLabel(s.phenotype)})` : kind;
}

export function signalWhere(locale: Locale, meta: FeedMeta, s: Signal): string {
  return s.ward ? unitName(locale, meta, s.ward) : t(locale, "common.signal.hospital");
}

export function signalWhen(locale: Locale, s: Signal, style: "short" | "long" = "long"): string {
  if (s.firstDate === s.lastDate) return t(locale, "timeline.detail.oneDay", { date: formatDate(locale, s.firstDate, style) });
  return t(locale, "timeline.detail.range", { from: formatDate(locale, s.firstDate, "short"), to: formatDate(locale, s.lastDate, style) });
}

/** "doesn't work" share of a Share: a percentage only from MIN_ISOLATES, else a count. */
export function resistantText(locale: Locale, share: Share | undefined): string {
  if (!share || share.n === 0) return "–";
  const r = share.n - share.works;
  if (share.n < MIN_ISOLATES) return t(locale, "timeline.share.count", { r: formatNumber(locale, r), n: formatNumber(locale, share.n) });
  return t(locale, "timeline.share.pct", {
    percent: formatShare(locale, r / share.n),
    r: formatNumber(locale, r),
    n: formatNumber(locale, share.n),
  });
}

const patientsText = (locale: Locale, n: number) =>
  n === 1 ? t(locale, "timeline.patients.one") : t(locale, "timeline.patients.many", { count: formatNumber(locale, n) });

const approx = (locale: Locale, v: number | undefined) => (v === undefined ? "–" : formatNumber(locale, v, v < 10 ? 1 : 0));

interface Parts {
  key: MessageKey;
  vars: Record<string, string>;
  organism?: string;
}

function parts(locale: Locale, meta: FeedMeta, s: Signal): Parts {
  const flag = flagLabel(s.phenotype);
  const drug = s.antibiotic ? antibioticName(locale, meta, s.antibiotic) : "";
  const observed = formatNumber(locale, s.observed, 1);
  const expected = approx(locale, s.expected);
  switch (s.kind) {
    case "sentinel":
      return s.source === "cpe"
        ? { key: "timeline.sum.sentinelHigh", vars: { flag, patients: patientsText(locale, s.patients ?? s.observed) } }
        : {
            key: "timeline.sum.sentinelMedium",
            vars: { flag, days: String(NEW_FLAG_QUIET_DAYS), patients: patientsText(locale, s.patients ?? s.observed) },
          };
    case "surge":
      return { key: "timeline.sum.surge", vars: { flag, observed, expected, days: String(SURGE_WINDOW_DAYS) } };
    case "cluster":
      if (s.organism)
        return {
          key: "timeline.sum.cluster",
          vars: {
            drugs: (s.resists ?? []).map((c) => antibioticName(locale, meta, c)).join(", ") || "–",
            observed,
            expected,
            days: String(CLUSTER_WINDOW_DAYS),
          },
          organism: s.organism,
        };
      break;
    case "data-gap":
      return { key: "timeline.sum.gap", vars: { observed, expected, days: String(s.windowDays ?? GAP_WINDOW_DAYS) } };
    case "shift":
      if (s.organism)
        return {
          key: "timeline.sum.shift",
          vars: { drug, recent: resistantText(locale, s.recent), baseline: resistantText(locale, s.baseline) },
          organism: s.organism,
        };
      break;
    case "trend":
      if (s.organism && !(s.recent && s.baseline))
        return {
          key: "timeline.sum.trendBlock",
          vars: {
            drug,
            specimen: s.specimen ? specimenName(locale, meta, s.specimen) : "–",
            percent: formatShare(locale, s.observed),
            days: String(TREND_BIN_DAYS),
          },
          organism: s.organism,
        };
      if (s.organism)
        return {
          key: "timeline.sum.trend",
          vars: {
            drug,
            specimen: s.specimen ? specimenName(locale, meta, s.specimen) : "–",
            recent: resistantText(locale, s.recent),
            baseline: resistantText(locale, s.baseline),
          },
          organism: s.organism,
        };
      break;
  }
  return { key: "timeline.sum.generic", vars: { observed, expected } };
}

/** The one-line summary as plain text (aria labels, screen-reader lines). */
export function summaryText(locale: Locale, meta: FeedMeta, s: Signal): string {
  const p = parts(locale, meta, s);
  return t(locale, p.key, { ...p.vars, ...(p.organism ? { organism: p.organism } : {}) });
}

/** The one-line summary with the organism in italics. */
export function Summary({ locale, meta, signal, short = false }: { locale: Locale; meta: FeedMeta; signal: Signal; short?: boolean }) {
  const p = parts(locale, meta, signal);
  const template = t(locale, p.key);
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push(template.slice(last, at));
    const name = m[1]!;
    if (name === "organism" && p.organism) out.push(<Org key={`o${at}`} name={p.organism} short={short} />);
    else out.push(<Fragment key={`v${at}`}>{p.vars[name] ?? ""}</Fragment>);
    last = at + m[0].length;
  }
  if (last < template.length) out.push(template.slice(last));
  return <>{out}</>;
}

/** How many results a signal rests on, in words. */
export function basisText(locale: Locale, s: Signal): string {
  if ((s.kind === "shift" || s.kind === "trend") && s.recent && s.baseline)
    return t(locale, "timeline.detail.basisShare", {
      recent: formatNumber(locale, s.recent.n),
      baseline: formatNumber(locale, s.baseline.n),
    });
  if (s.kind === "data-gap") return t(locale, "timeline.detail.basisCount");
  const n = s.isolateIds.length;
  if (n === 1) return t(locale, "timeline.detail.basisOne");
  if (n > 1) return t(locale, "timeline.detail.basis", { count: formatNumber(locale, n) });
  return t(locale, "timeline.detail.basisCount");
}

/** Institution heading: a translated word when we have one, else the feed's own value made readable. */
export function institutionLabel(locale: Locale, institution: string | null): string {
  if (institution === null) return t(locale, "timeline.inst.other");
  const key = `timeline.inst.${institution}`;
  if (key === "timeline.inst.hospital" || key === "timeline.inst.primary_care") return t(locale, key);
  const words = institution.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
