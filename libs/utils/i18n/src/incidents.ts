import type { WardCode } from "@aei/domain";
import { formatDateNumeric, type Locale, t, wardInfo, wardName } from "./index.ts";

/** The existing alert fields needed for presentation; no detector is run here. */
interface AlertFacts {
  kind: string;
  ward: WardCode | null;
  date: string;
  detector?: string;
  observed?: number;
  expected?: number;
  severity?: "high" | "medium";
}

/** D-039's labels for APIs without an explicit severity field. */
export function alertPriority(a: AlertFacts): "high" | "medium" {
  if (a.severity) return a.severity;
  if (a.kind === "cpe" || a.detector === "profile-excess") return "high";
  const inpatient = a.ward !== null && wardInfo(a.ward)?.type === "in";
  return inpatient && a.kind === "new-in-unit" ? "high" : "medium";
}

export function incidentPriority(members: readonly AlertFacts[]): "high" | "medium" {
  return members.some((a) => alertPriority(a) === "high") ? "high" : "medium";
}

/** Presentation backlog: latest alert in 28 days, highest existing priority first, then newest. */
export function openIncidents<T extends { key: string; date: string; members: readonly AlertFacts[] }>(
  incidents: readonly T[],
  asOf: string,
): T[] {
  const from = new Date(Date.parse(`${asOf}T00:00:00Z`) - 27 * 86_400_000).toISOString().slice(0, 10);
  return incidents
    .filter((i) => i.date >= from && i.date <= asOf)
    .sort(
      (a, b) =>
        Number(incidentPriority(b.members) === "high") - Number(incidentPriority(a.members) === "high") ||
        b.date.localeCompare(a.date) ||
        a.key.localeCompare(b.key),
    );
}

/** Informational ownership, not a clinical procedure or evidence that notification was sent. */
export function incidentResponsibility(locale: Locale, members: readonly AlertFacts[]): string {
  if (members.length > 0 && members.every((a) => a.detector === "sampling-drop" || a.detector === "empty-run"))
    return t(locale, "feedNotifyData");
  if (incidentPriority(members) === "medium") return t(locale, "feedNotifyMedium");
  const ward = members.find((a) => alertPriority(a) === "high")?.ward;
  return ward ? t(locale, "feedNotifyHigh", { unit: wardName(locale, ward) }) : t(locale, "feedNotifyHospital");
}

/** Counts retain their original units: patients, cultures, days, or resistant share. Never sum member alerts. */
export function alertEvidence(locale: Locale, a: AlertFacts): string {
  const date = formatDateNumeric(a.date);
  if (a.kind !== "detector") return t(locale, "feedSinglePatient", { date });
  const number = (n: number) => new Intl.NumberFormat(locale === "fi" ? "fi-FI" : "en-GB", { maximumFractionDigits: 1 }).format(n);
  const expected = a.expected === undefined ? t(locale, "feedExpectedUnknown") : number(a.expected);
  const observed = a.observed === undefined ? t(locale, "feedExpectedUnknown") : number(a.observed);
  if (a.detector === "rising-trend")
    return t(locale, "feedTrendCounts", {
      observed: a.observed === undefined ? observed : `${number(a.observed * 100)} %`,
      expected: a.expected === undefined ? expected : `${number(a.expected * 100)} %`,
    });
  const key = a.detector === "empty-run" ? "feedEmptyCounts" : a.detector === "sampling-drop" ? "feedSamplingCounts" : "feedPatientCounts";
  return t(locale, key, { observed, expected, date });
}
