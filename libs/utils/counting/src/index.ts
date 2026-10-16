import { ANTIBIOTICS, type AntibioticCode, type IsoDate, type IsolateRecord, type Organism, type Specimen } from "@aei/domain";

// Counting rules from surveillance practice that the organiser points to
// (CONTEXT.md): only the first isolate per patient, per species, per
// specimen type, per period. What "period" means is the caller's (CONTEXT.md
// question 8): pass the period as the window.

/** Inclusive date range, ISO dates. */
export interface Period {
  from: IsoDate;
  to: IsoDate;
}

type Counted = Pick<IsolateRecord, "isolateId" | "patientId" | "organism" | "specimen" | "sampleDate">;

/**
 * The first isolate of each patient, organism and specimen type within
 * `period`, in date order (ties by isolate id). Isolates before or after the
 * period are ignored, so a patient counts again in the next period. Later
 * isolates are dropped whatever their results (no deduplication by
 * phenotype).
 */
export function firstIsolates<R extends Counted>(records: readonly R[], period?: Period): R[] {
  const inPeriod = records.filter((r) => !period || (r.sampleDate >= period.from && r.sampleDate <= period.to));
  inPeriod.sort((a, b) =>
    a.sampleDate !== b.sampleDate ? (a.sampleDate < b.sampleDate ? -1 : 1) : a.isolateId.localeCompare(b.isolateId),
  );
  const seen = new Set<string>();
  const out: R[] = [];
  for (const r of inPeriod) {
    const key = `${r.patientId}|${r.organism}|${r.specimen}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Counts only: the caller owns reporting floors and presentation. */
export function susceptibilityCounts(records: readonly IsolateRecord[]): {
  organism: Organism;
  specimen: Specimen;
  antibiotic: AntibioticCode;
  susceptible: number;
  resistant: number;
  n: number;
}[] {
  const first = firstIsolates(records);
  const groups = new Map<string, IsolateRecord[]>();
  for (const record of first) {
    const key = `${record.organism}|${record.specimen}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) => {
    const record = group[0];
    if (!record) return [];
    return ANTIBIOTICS.flatMap(({ code }) => {
      const susceptible = group.filter((r) => r.results[code] === "S").length;
      const resistant = group.filter((r) => r.results[code] === "R").length;
      const n = susceptible + resistant;
      return n ? [{ organism: record.organism, specimen: record.specimen, antibiotic: code, susceptible, resistant, n }] : [];
    });
  });
}
