import type { Alert } from "@aei/contract";
import { ANTIBIOTICS } from "@aei/domain";
import { antibioticName, formatDate, type Locale, phenotypeName, specimenName, t, wardName } from "@aei/i18n";
import type { SignalKind } from "../board.ts";
import { formatP, type Incident, oneDecimal } from "./model.ts";

// Names and one-line facts of alerts, from the feed templates.

const KIND_LABEL = {
  sentinel: "feedKindSentinel",
  cluster: "feedKindCluster",
  trend: "feedKindTrend",
  divergence: "feedKindDivergence",
  data: "feedKindData",
} as const;

export const kindLabel = (locale: Locale, kind: SignalKind) => t(locale, KIND_LABEL[kind]);

export function unitLabel(locale: Locale, ward: string | null): string {
  return ward ? wardName(locale, ward as never) : t(locale, "hospitalWide");
}

/** At most six words: what the alert is about, without the unit. */
export function shortTitle(locale: Locale, a: Alert): string {
  switch (a.kind) {
    case "cpe":
      return `CPE · ${a.organism}`;
    case "new-in-unit":
      return t(locale, "feedNewTitle", { phenotype: phenotypeName(a.phenotype) }).replace(/ (in the unit|yksikössä)$/, "");
    case "carrier":
      return unitLabel(locale, a.ward);
    case "detector":
      if (a.detector === "sampling-drop" || a.detector === "empty-run") return t(locale, "feedKindData");
      if (a.detector === "rising-trend")
        return [a.antibiotic ? antibioticName(locale, a.antibiotic) : "", a.organism ?? ""].filter(Boolean).join(" · ");
      if (a.phenotype) return phenotypeName(a.phenotype);
      return a.profile ? t(locale, "feedRareProfile", { organism: a.organism ?? "" }) : (a.organism ?? "");
  }
}

/** The sentence of the full title, for the explanation and the aria label. */
export function incidentTitle(locale: Locale, a: Alert): string {
  const unit = unitLabel(locale, a.ward);
  switch (a.kind) {
    case "cpe":
      return t(locale, "feedCpeTitle", { organism: a.organism });
    case "new-in-unit":
      return t(locale, "feedNewTitle", { phenotype: phenotypeName(a.phenotype) });
    case "carrier":
      return unit;
    case "detector": {
      if (a.detector === "sampling-drop" || a.detector === "empty-run")
        return t(locale, "feedDataTitle", { unit, observed: a.observed, expected: oneDecimal(locale, a.expected ?? 0) });
      if (a.detector === "rising-trend")
        return t(locale, "feedTrendTitle", {
          antibiotic: a.antibiotic ? antibioticName(locale, a.antibiotic) : "",
          organism: a.organism ?? "",
          observed: `${Math.round(a.observed * 100)} %`,
        });
      return t(locale, "feedClusterTitle", {
        what: a.phenotype ? phenotypeName(a.phenotype) : (a.organism ?? ""),
        unit,
        observed: a.observed,
        expected: oneDecimal(locale, a.expected ?? 0),
      });
    }
  }
}

/** −log10 p of a detector alert; null for rules (no p). A p of 0 reads as the cap. */
export function surpriseOf(a: Alert): number | null {
  if (a.kind !== "detector" || a.p === undefined) return null;
  return a.p <= 0 ? 6 : -Math.log10(a.p);
}

/** The incident's bar: 1 for sentinels, else the strongest member's −log10 p over 6; null if none. */
export function surpriseShare(i: Incident): number | null {
  if (i.kind === "sentinel") return 1;
  const s = i.members.map(surpriseOf).filter((x): x is number => x !== null);
  return s.length === 0 ? null : Math.min(Math.max(...s), 6) / 6;
}

/** One line of counts for an alert (observed, usual, p). */
export function baselineLine(locale: Locale, a: Alert): string {
  if (a.kind === "cpe") return t(locale, "feedCpeCounts", { organism: a.organism, specimen: specimenName(locale, a.specimen) });
  if (a.kind === "new-in-unit")
    return a.previous ? t(locale, "feedNoneSince", { date: formatDate(locale, a.previous, "long") }) : t(locale, "feedNoneBefore");
  if (a.kind !== "detector") return "";
  const parts: string[] = [];
  if (a.detector === "rising-trend") {
    parts.push(t(locale, "feedObserved", { n: `${Math.round(a.observed * 100)} %` }));
    if (a.expected !== undefined) parts.push(t(locale, "feedExpected", { n: `${Math.round(a.expected * 100)} %` }));
  } else {
    parts.push(t(locale, "feedObserved", { n: a.observed }));
    if (a.expected !== undefined) parts.push(t(locale, "feedExpected", { n: oneDecimal(locale, a.expected) }));
  }
  if (a.p !== undefined) parts.push(t(locale, "feedP", { p: formatP(locale, a.p) }));
  return parts.join(" · ");
}

/** The drugs a profile string ("RSS.RR.SRRS..", one character per antibiotic in the domain's order) marks resistant. */
export function resistantFromProfile(locale: Locale, profile: string): string[] {
  return ANTIBIOTICS.filter((_, i) => profile[i] === "R").map((a) => antibioticName(locale, a.code));
}
