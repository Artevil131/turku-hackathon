import { type DetectorName, episodes, liveSignals, type Signal } from "@aei/detect";
import type { AntibioticCode, Culture, IsoDate, IsolateRecord, Organism, Phenotype, Specimen, WardCode } from "@aei/domain";
import { type CarrierArrival, carrierArrivals, type DateWindow, type PatientTrail, phenotypeTrails } from "@aei/relations";

// Infection-control alerts. Rules that fire on a single result (D-014) and
// the live statistical detectors (D-020), one alert per signal episode.

/** Any isolate with a carbapenemase-producing Enterobacterales flag. */
export interface CpeAlert {
  kind: "cpe";
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
  id: string;
  date: IsoDate;
  /** Null for hospital-wide trends. */
  ward: WardCode | null;
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

export type Alert = CpeAlert | CarrierAlert | DetectorAlert;

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

/** One alert per signal episode (signals for the same detector and key within 28 days), on the episode's first day. */
export function detectorAlerts(signals: readonly Signal[]): DetectorAlert[] {
  return episodes(signals).map(({ first: s }) => ({
    kind: "detector",
    id: `detector:${s.detector}:${s.key}:${s.date}`,
    date: s.date,
    ward: s.ward,
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
 * Every alert over a history, newest first: CPE finds, carrier arrivals and
 * live detector episodes. Each alert depends only on samples up to its date,
 * so a server computes them once and releases them as its clock moves.
 */
export function buildAlerts(records: readonly IsolateRecord[], cultures: readonly Culture[], trails?: readonly PatientTrail[]): Alert[] {
  const t = trails ?? phenotypeTrails(cultures, records);
  return sortAlerts<Alert>([
    ...cpeAlerts(records),
    ...carrierAlerts(carrierArrivals(t)),
    ...detectorAlerts(liveSignals(records, cultures)),
  ]);
}

/** Newest first; on the same day CPE, then detectors, then carriers. */
export function sortAlerts<A extends Alert>(alerts: readonly A[]): A[] {
  const rank = { cpe: 0, detector: 1, carrier: 2 } as const;
  return alerts
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id)));
}
