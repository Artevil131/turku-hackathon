import { type IsoDate, type IsolateRecord, type Organism, PHENOTYPES, type Phenotype, type WardCode } from "@aei/domain";
import { addDays } from "@aei/replay";

// A patient's earlier resistant findings (D-050, B6): the ESBL, MRSA, VRE and
// CPE isolates of one patient within the year before the replay date, the
// hospital guides' "within the previous year" rule. The same flags the carrier
// trails follow (D-022); this lists them for one patient.

export interface PatientFinding {
  phenotype: Phenotype;
  /** Sample date of the isolate. */
  date: IsoDate;
  /** The unit that sampled it, as the record gives it. */
  ward: WardCode;
  organism: Organism;
  isolateId: string;
}

/** Days back a finding still counts: the previous year (D-050). */
export const PATIENT_FINDING_DAYS = 365;

/**
 * The patient's ESBL, MRSA, VRE and CPE findings sampled in the `days` days up
 * to and including `asOf` (from `asOf − days + 1`), one per isolate and
 * phenotype, newest first; ties keep record order, phenotypes in PHENOTYPES
 * order. Records dated after `asOf` are ignored, so passing more than the
 * released records leaks nothing.
 */
export function patientFindings(
  records: readonly IsolateRecord[],
  patientId: string,
  asOf: IsoDate,
  days = PATIENT_FINDING_DAYS,
): PatientFinding[] {
  const from = addDays(asOf, 1 - days);
  const out: PatientFinding[] = [];
  for (const r of records) {
    if (r.patientId !== patientId || r.sampleDate < from || r.sampleDate > asOf) continue;
    for (const phenotype of PHENOTYPES)
      if (r.phenotypes.includes(phenotype))
        out.push({ phenotype, date: r.sampleDate, ward: r.ward, organism: r.organism, isolateId: r.isolateId });
  }
  // Array.prototype.sort is stable, so equal dates keep record order.
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
