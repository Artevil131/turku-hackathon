import type { IsoDate, IsolateRecord, Organism, Phenotype, Specimen, WardCode } from "@aei/domain";
import type { CarrierArrival, DateWindow } from "@aei/relations";

// Infection-control alerts that need no statistics: rules that fire on a
// single result (D-014). Statistical deviations (clusters, ward against
// hospital, trends) are separate and wait for their own decisions.

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

export type Alert = CpeAlert | CarrierAlert;

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

/** Newest first; on the same day CPE before carriers. */
export function sortAlerts<A extends Alert>(alerts: readonly A[]): A[] {
  const rank = { cpe: 0, carrier: 1 } as const;
  return alerts
    .slice()
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id)));
}
