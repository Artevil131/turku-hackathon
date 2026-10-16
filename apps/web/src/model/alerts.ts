import type { Alert } from "@aei/alerts";
import { PROFILE_ANTIBIOTICS, profileOf } from "@aei/detect";
import type { AntibioticCode, Organism } from "@aei/domain";
import { isIntrinsic } from "@aei/eucast";
import type { IsoDate, Result } from "../feed/types.ts";
import { addDays } from "./dates.ts";
import { CLUSTER_WINDOW_DAYS, GAP_WINDOW_DAYS, SURGE_WINDOW_DAYS } from "./rules.ts";
import type { Severity, Signal, SignalKind, SignalSource } from "./types.ts";

// The server's alerts (GET /api/alerts, libs/utils/alerts) as the screens
// show them. Nothing here detects anything: every alert, its numbers and its
// incident come from the server. This file only names the kind, sets a
// severity, finds the released isolates behind it for "see cases", and folds
// the alerts of one incident (D-034) into one row.

/**
 * Severity by the rule that raised the alert:
 *   high    CPE (every one is reported, D-014), MRSA/VRE new on an inpatient unit (D-021),
 *           and a cluster of one resistance profile (profile excess, D-020)
 *   medium  a surge of a resistance flag (phenotype excess), a data gap (sampling drop, empty run)
 *           and a hospital-wide rising trend
 * An incident takes the highest severity of its alerts.
 */
export const SEVERITY_OF: Record<SignalSource, Severity> = {
  cpe: "high",
  "new-in-unit": "high",
  "profile-excess": "high",
  "phenotype-excess": "medium",
  "sampling-drop": "medium",
  "empty-run": "medium",
  "rising-trend": "medium",
};

const KIND_OF: Record<SignalSource, SignalKind> = {
  cpe: "sentinel",
  "new-in-unit": "sentinel",
  "profile-excess": "cluster",
  "phenotype-excess": "surge",
  "sampling-drop": "data-gap",
  "empty-run": "data-gap",
  "rising-trend": "trend",
};

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const distinct = (ids: readonly string[]) => [...new Set(ids)];

function mostCommon(values: readonly string[]): string | undefined {
  const count = new Map<string, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best: string | undefined;
  for (const [v, n] of count) if (best === undefined || n > (count.get(best) ?? 0)) best = v;
  return best;
}

/** Released isolates in `ward` sampled in the `days` up to and including `date`. */
function inWindow(results: readonly Result[], ward: string | null, date: IsoDate, days: number): Result[] {
  const from = addDays(date, 1 - days);
  return results.filter((r) => r.ward === ward && r.sampleDate >= from && r.sampleDate <= date);
}

/** One server alert as a signal (before incidents are folded). */
export function toSignal(a: Exclude<Alert, { kind: "carrier" }>, results: readonly Result[]): Signal {
  const base = { id: a.id, firstDate: a.date, lastDate: a.date, related: [] as Signal[] };
  if (a.kind === "cpe") {
    const r = results.find((x) => x.isolateId === a.isolateId);
    return {
      ...base,
      kind: "sentinel",
      source: "cpe",
      severity: SEVERITY_OF.cpe,
      ward: a.ward,
      organism: a.organism,
      phenotype: "cpe",
      specimen: a.specimen ?? r?.specimen,
      observed: 1,
      patients: 1,
      isolateIds: [a.isolateId],
    };
  }
  if (a.kind === "new-in-unit") {
    const r = results.find((x) => x.isolateId === a.isolateId);
    return {
      ...base,
      kind: "sentinel",
      source: "new-in-unit",
      severity: SEVERITY_OF["new-in-unit"],
      ward: a.ward,
      organism: a.organism,
      phenotype: a.phenotype,
      ...(r ? { specimen: r.specimen } : {}),
      observed: 1,
      patients: 1,
      isolateIds: [a.isolateId],
    };
  }
  const source = a.detector as SignalSource;
  const common = {
    ...base,
    kind: KIND_OF[source],
    source,
    severity: SEVERITY_OF[source],
    ward: a.ward,
    observed: a.observed,
    ...(a.expected !== undefined ? { expected: a.expected } : {}),
    ...(a.p !== undefined ? { p: a.p } : {}),
  };
  switch (source) {
    case "profile-excess": {
      const profile = a.profile ?? "";
      const cases = inWindow(results, a.ward, a.date, CLUSTER_WINDOW_DAYS).filter(
        (r) => r.organism === a.organism && profileOf(r as Parameters<typeof profileOf>[0]) === profile,
      );
      const resists = PROFILE_ANTIBIOTICS.filter(
        (code, i) => profile[i] === "R" && !(a.organism && isIntrinsic(a.organism, code as AntibioticCode)),
      );
      const specimen = mostCommon(cases.map((r) => r.specimen));
      return {
        ...common,
        ...(a.organism ? { organism: a.organism } : {}),
        ...(specimen ? { specimen } : {}),
        resists,
        patients: a.observed,
        windowDays: CLUSTER_WINDOW_DAYS,
        isolateIds: cases.map((r) => r.isolateId),
      };
    }
    case "phenotype-excess": {
      const cases = inWindow(results, a.ward, a.date, SURGE_WINDOW_DAYS).filter((r) => !!a.phenotype && r.phenotypes.includes(a.phenotype));
      const organism = mostCommon(cases.map((r) => r.organism));
      return {
        ...common,
        ...(a.phenotype ? { phenotype: a.phenotype } : {}),
        ...(organism ? { organism } : {}),
        patients: a.observed,
        windowDays: SURGE_WINDOW_DAYS,
        isolateIds: cases.map((r) => r.isolateId),
      };
    }
    case "sampling-drop":
      return { ...common, windowDays: GAP_WINDOW_DAYS, isolateIds: [] };
    case "empty-run":
      // The server counts the run in days (observed) against the unit's usual cultures per day (expected).
      return {
        ...common,
        observed: 0,
        expected: (a.expected ?? 0) * a.observed,
        windowDays: a.observed,
        isolateIds: [],
      };
    case "rising-trend": {
      // The detector's key is "organism|antibiotic|specimen" (or "all").
      const specimen = a.id.split("|")[2]?.split(":")[0];
      return {
        ...common,
        ...(a.organism ? { organism: a.organism as Organism } : {}),
        ...(a.antibiotic ? { antibiotic: a.antibiotic } : {}),
        ...(specimen && specimen !== "all" ? { specimen } : {}),
        isolateIds: [],
      };
    }
    default:
      return { ...common, isolateIds: [] };
  }
}

/**
 * The server's alerts as one signal per incident (D-034), newest incident
 * first: the incident's first alert leads, later alerts are listed under it,
 * the incident lasts until its latest alert and takes its highest severity.
 * Carrier arrivals are not alerts (D-022) and are left out.
 */
export function toSignals(alerts: readonly Alert[], results: readonly Result[]): Signal[] {
  const members = new Map<string, Signal[]>();
  const ordered = alerts
    .filter((a): a is Exclude<Alert, { kind: "carrier" }> => a.kind !== "carrier")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  for (const a of ordered) {
    const key = a.incident ?? a.id;
    const list = members.get(key) ?? [];
    list.push(toSignal(a, results));
    members.set(key, list);
  }
  const out: Signal[] = [];
  for (const [id, list] of members) {
    const lead = list.find((s) => s.id === id) ?? (list[0] as Signal);
    const related = list.filter((s) => s !== lead);
    const severity = list.reduce<Severity>((best, s) => (RANK[s.severity] < RANK[best] ? s.severity : best), lead.severity);
    out.push({
      ...lead,
      id,
      severity,
      lastDate: list.reduce((d, s) => (s.lastDate > d ? s.lastDate : d), lead.lastDate),
      isolateIds: distinct(list.flatMap((s) => s.isolateIds)),
      related,
    });
  }
  return out.sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : a.id.localeCompare(b.id)));
}
