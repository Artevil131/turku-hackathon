import { type DetectorName, episodes, liveSignals, type Signal } from "@aei/detect";
import {
  type AntibioticCode,
  bySite,
  type Culture,
  type IsoDate,
  type IsolateRecord,
  type Organism,
  type Phenotype,
  type SiteId,
  type Specimen,
  WARDS,
  type Ward,
  type WardCode,
} from "@aei/domain";
import type { CarrierArrival, DateWindow } from "@aei/relations";
import { addDays, daysBetween } from "@aei/replay";

export { PATIENT_FINDING_DAYS, type PatientFinding, patientFindings } from "./findings.ts";
export { patientOverlap } from "./overlap.ts";

// Infection-control alerts. Rules that fire on a single result (D-014) and
// the live statistical detectors (D-020), one alert per signal episode.

/** Any isolate with a carbapenemase-producing Enterobacterales flag. */
export interface CpeAlert {
  kind: "cpe";
  /** Alerts about one event share it: the id of the event's first alert (D-034). */
  incident?: string;
  id: string;
  date: IsoDate;
  ward: WardCode;
  patientId: string;
  isolateId: string;
  organism: Organism;
  specimen: Specimen;
}

/** A known ESBL, MRSA, VRE or CPE carrier sampled in another unit (D-012). */
export interface CarrierAlert {
  kind: "carrier";
  /** Alerts about one event share it: the id of the event's first alert (D-034). */
  incident?: string;
  id: string;
  date: IsoDate;
  ward: WardCode;
  patientId: string;
  cultureId: string;
  phenotype: Phenotype;
  from: WardCode;
  foundOn: IsoDate;
  confirmed: boolean;
}

/** The first signal of a detector episode: a cluster, a surge, a sampling drop or a rising trend (D-020). */
export interface DetectorAlert {
  kind: "detector";
  /** Alerts about one event share it: the id of the event's first alert (D-034). */
  incident?: string;
  id: string;
  date: IsoDate;
  /** Null for hospital-wide trends. */
  ward: WardCode | null;
  /** The hospital of a hospital-wide trend from a site other than the home site (D-051). */
  site?: SiteId;
  detector: DetectorName;
  organism?: Organism;
  antibiotic?: AntibioticCode;
  phenotype?: Phenotype;
  /** S/R over the 13 antibiotics in dataset order, "." where not tested. */
  profile?: string;
  /** A count, or a proportion for trends. */
  observed: number;
  expected?: number;
  p?: number;
}

/** The first MRSA or VRE in a unit after a long time without one (D-021). */
export interface NewInUnitAlert {
  kind: "new-in-unit";
  /** Alerts about one event share it: the id of the event's first alert (D-034). */
  incident?: string;
  id: string;
  date: IsoDate;
  ward: WardCode;
  phenotype: Phenotype;
  organism: Organism;
  patientId: string;
  isolateId: string;
  /** The unit's previous isolate with this phenotype, or null if none in the data. */
  previous: IsoDate | null;
}

export type Alert = CpeAlert | NewInUnitAlert | DetectorAlert | CarrierAlert;

/** Look-back for "new in a unit" (D-021). */
export const NEW_IN_UNIT_DAYS = 180;
export const SAMPLING_DROP_SUPPRESSION_DAYS = 14;
export const NEW_IN_UNIT_PHENOTYPES = ["mrsa", "vre"] as const;

/**
 * An isolate with the phenotype in a unit that had none in the `lookbackDays`
 * before it. Nothing fires during the first `lookbackDays` of the data,
 * where the look-back would reach before the data begins. "New in a unit" is
 * about transmission on a ward: inpatient units of `wards` only (D-034; default
 * the dataset's units). Each site's quiet start is its own first sample (D-051).
 */
export function newInUnitAlerts(
  records: readonly IsolateRecord[],
  phenotypes: readonly Phenotype[] = NEW_IN_UNIT_PHENOTYPES,
  lookbackDays = NEW_IN_UNIT_DAYS,
  wards: readonly Ward[] = WARDS,
): NewInUnitAlert[] {
  const inpatient = new Set<WardCode>(wards.filter((w) => w.type === "in").map((w) => w.code));
  return [...bySite(records).values()].flatMap((rows) => newInUnitOfSite(rows, phenotypes, lookbackDays, inpatient));
}

function newInUnitOfSite(
  records: readonly IsolateRecord[],
  phenotypes: readonly Phenotype[],
  lookbackDays: number,
  INPATIENT: ReadonlySet<WardCode>,
): NewInUnitAlert[] {
  const start = records.reduce<string | null>((min, r) => (min === null || r.sampleDate < min ? r.sampleDate : min), null);
  if (!start) return [];
  const quietUntil = addDays(start, lookbackDays);
  const sorted = [...records].sort((a, b) => a.sampleDate.localeCompare(b.sampleDate) || a.isolateId.localeCompare(b.isolateId));
  const out: NewInUnitAlert[] = [];
  for (const phenotype of phenotypes) {
    const last = new Map<WardCode, IsoDate>();
    for (const r of sorted) {
      if (!r.phenotypes.includes(phenotype) || !INPATIENT.has(r.ward)) continue;
      const previous = last.get(r.ward) ?? null;
      if (r.sampleDate >= quietUntil && (previous === null || daysBetween(previous, r.sampleDate) > lookbackDays)) {
        out.push({
          kind: "new-in-unit",
          id: `new:${phenotype}:${r.isolateId}`,
          date: r.sampleDate,
          ward: r.ward,
          phenotype,
          organism: r.organism,
          patientId: r.patientId,
          isolateId: r.isolateId,
          previous,
        });
      }
      last.set(r.ward, r.sampleDate);
    }
  }
  return out;
}

const inWindow = (date: IsoDate, window?: DateWindow) => !window || (date >= window.from && date <= window.to);

export function cpeAlerts(records: readonly IsolateRecord[], window?: DateWindow): CpeAlert[] {
  return records
    .filter((r) => r.phenotypes.includes("cpe") && inWindow(r.sampleDate, window))
    .map((r) => ({
      kind: "cpe",
      id: `cpe:${r.isolateId}`,
      date: r.sampleDate,
      ward: r.ward,
      patientId: r.patientId,
      isolateId: r.isolateId,
      organism: r.organism,
      specimen: r.specimen,
    }));
}

export function carrierAlerts(arrivals: readonly CarrierArrival[], window?: DateWindow): CarrierAlert[] {
  return arrivals
    .filter((a) => inWindow(a.date, window))
    .map((a) => ({ kind: "carrier", id: `carrier:${a.cultureId}:${a.phenotype}`, ...a }));
}

/**
 * One alert per signal episode (signals for the same detector and key within
 * 28 days), on the episode's first day. A 7-day sampling-drop episode that
 * starts within 14 days after an empty-run alert for the same unit is the
 * same gap seen later and raises no second alert (D-031).
 */
export function detectorAlerts(signals: readonly Signal[]): DetectorAlert[] {
  const eps = episodes(signals);
  const runs = eps.filter((e) => e.detector === "empty-run");
  const sameGap = (e: (typeof eps)[number]) =>
    e.detector === "sampling-drop" &&
    runs.some(
      (r) =>
        r.first.ward === e.first.ward &&
        r.first.date <= e.first.date &&
        daysBetween(r.first.date, e.first.date) <= SAMPLING_DROP_SUPPRESSION_DAYS,
    );
  return eps
    .filter((e) => !sameGap(e))
    .map(({ first: s }) => ({
      kind: "detector",
      id: `detector:${s.detector}:${s.key}:${s.date}`,
      date: s.date,
      ward: s.ward,
      ...(s.site ? { site: s.site } : {}),
      detector: s.detector,
      ...(s.organism ? { organism: s.organism } : {}),
      ...(s.antibiotic ? { antibiotic: s.antibiotic } : {}),
      ...(s.phenotype ? { phenotype: s.phenotype } : {}),
      ...(s.profile ? { profile: s.profile } : {}),
      observed: s.observed,
      ...(s.expected !== undefined ? { expected: s.expected } : {}),
      ...(s.p !== undefined ? { p: s.p } : {}),
    }));
}

/**
 * Every pushed alert over a history, newest first: CPE finds, MRSA or VRE
 * new in a unit, and live detector episodes. Carrier arrivals are not pushed
 * (D-022): in this data almost none is confirmed in the new unit; they stay
 * available per patient through `carrierAlerts`. Each alert depends only on samples up to its date,
 * so a server computes them once and releases them as its clock moves.
 * Each site is assessed on its own rows (D-051); `wards` gives each unit's type (default: the dataset's units).
 */
export function buildAlerts(records: readonly IsolateRecord[], cultures: readonly Culture[], wards: readonly Ward[] = WARDS): Alert[] {
  return sortAlerts<Alert>(
    groupIncidents([
      ...cpeAlerts(records),
      ...newInUnitAlerts(records, undefined, undefined, wards),
      ...detectorAlerts(liveSignals(records, cultures)),
    ]),
  );
}

/** Organisms a phenotype flag is reported on in this data, so a phenotype alert joins an organism alert. */
const CARRIERS_OF: Record<Phenotype, readonly Organism[]> = {
  esbl: ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Proteus mirabilis", "Citrobacter freundii"],
  mrsa: ["Staphylococcus aureus"],
  vre: ["Enterococcus faecalis"],
  cpe: ["Escherichia coli", "Klebsiella pneumoniae", "Klebsiella oxytoca", "Proteus mirabilis", "Citrobacter freundii"],
};

/** Days within which alerts about the same unit and organism or phenotype belong to one incident. */
export const INCIDENT_DAYS = 28;

/**
 * Groups alerts into incidents (D-034): an alert joins an earlier one's
 * incident when it is about the same unit and shares its organism or
 * phenotype (or both are about sampling), and came within `INCIDENT_DAYS` of
 * the incident's latest alert. Every alert keeps its own row; `incident` is
 * the id of the incident's first alert, so a screen can show one event once.
 */
export function groupIncidents<A extends Alert>(alerts: readonly A[]): A[] {
  const tags = (a: Alert): string[] => {
    if (a.kind === "detector" && (a.detector === "sampling-drop" || a.detector === "empty-run")) return ["sampling"];
    const out: string[] = [];
    if ("organism" in a && a.organism) out.push(`org:${a.organism}`);
    if ("phenotype" in a && a.phenotype) {
      out.push(`ph:${a.phenotype}`);
      for (const o of CARRIERS_OF[a.phenotype]) out.push(`org:${o}`);
    }
    if (a.kind === "cpe") out.push("ph:cpe");
    return out;
  };
  const open: { id: string; ward: WardCode | null; tags: Set<string>; last: IsoDate }[] = [];
  const ordered = alerts.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  return ordered.map((a) => {
    const t = tags(a);
    const hit = open.find(
      (i) => a.ward !== null && i.ward === a.ward && daysBetween(i.last, a.date) <= INCIDENT_DAYS && t.some((x) => i.tags.has(x)),
    );
    if (hit) {
      hit.last = a.date;
      for (const x of t) hit.tags.add(x);
      return { ...a, incident: hit.id };
    }
    open.push({ id: a.id, ward: a.ward, tags: new Set(t), last: a.date });
    return { ...a, incident: a.id };
  });
}

/** Newest first; on the same day CPE, then new in a unit, then detectors, then carriers. */
export function sortAlerts<A extends Alert>(alerts: readonly A[]): A[] {
  const rank = { cpe: 0, "new-in-unit": 1, detector: 2, carrier: 3 } as const;
  return alerts
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id)));
}
