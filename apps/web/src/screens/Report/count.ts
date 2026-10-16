import { firstIsolates } from "@aei/counting";
import { AWARE, countCovered, MAX_UNTESTED, offeredFor } from "@aei/coverage";
import type { AntibioticCode, IsolateRecord, Specimen } from "@aei/domain";
import type { Antibiotic, IsoDate, Result } from "../../feed/types.ts";
import { addDays, addMonths, minDate, monthEnd, monthStart } from "../../model/dates.ts";
import type { AwareGroup, Catalog, LikelyOrganism, MonthPoint, PatientQuery, Share } from "../../model/types.ts";

/*
  The report's counts, built from the team's gears so the report and the
  doctor's list count the same way: first isolates per patient, organism and
  specimen in the window (@aei/counting), EUCAST rules for untested and
  intrinsic results (@aei/coverage countCovered), the antibiotics offered for
  a specimen (offeredFor: no vancomycin or clindamycin for urine), and the
  "over a fifth untested" rule (MAX_UNTESTED). Unlike the doctor's list, a
  report keeps exactly the filters chosen: no level is widened.
*/

/** The report's "every unit" (the empty ward code). */
export const EVERY_UNIT = "";

export interface DrugFigure {
  antibiotic: string;
  aware: AwareGroup | null;
  main: Share;
}

export interface WindowCounts {
  /** First isolates matching the query in the window. */
  basis: { n: number };
  /** Offered antibiotics with a result for at most MAX_UNTESTED of the isolates untested, in the lab's order. */
  drugs: DrugFigure[];
  /** Organisms behind the query (without its organism filter), most common first. */
  organisms: LikelyOrganism[];
}

const asRecords = (rs: readonly Result[]) => rs as unknown as readonly IsolateRecord[];

/** The AWaRe group of an antibiotic, as the badges name it. */
export function awareOf(code: string): AwareGroup | null {
  const g = AWARE[code as AntibioticCode];
  return g === "Access" ? "access" : g === "Watch" ? "watch" : null;
}

/** The antibiotics a report lists for a specimen, as the feed names them ("" = every specimen). */
export function treatmentsFor(catalog: Catalog, specimen: string): Antibiotic[] {
  const offered = new Set<string>(
    specimen ? offeredFor(specimen as Specimen) : (["urine", "blood", "wound"] as Specimen[]).flatMap((s) => offeredFor(s)),
  );
  return catalog.antibiotics.filter((a) => offered.has(a.code));
}

/** Works / n as 0-1, or null when n = 0. */
export function shareValue(share: Share): number | null {
  return share.n > 0 ? share.works / share.n : null;
}

/** First isolates of the specimen in [from, to] (hospital-wide, as the gear counts them), then the query's filters. */
function pool(results: readonly Result[], from: IsoDate, to: IsoDate, q: PatientQuery, withOrganism = true): Result[] {
  const inWindow = results.filter((r) => r.sampleDate >= from && r.sampleDate <= to && (!q.specimen || r.specimen === q.specimen));
  const first = firstIsolates(asRecords(inWindow), { from, to }) as unknown as Result[];
  return first.filter(
    (r) =>
      (q.ward === EVERY_UNIT || r.ward === q.ward) &&
      (!q.sex || r.sex === q.sex) &&
      (!q.age || (q.age === "65plus") === r.ageYears >= 65) &&
      (!withOrganism || !q.organism || r.organism === q.organism),
  );
}

function organismsOf(list: readonly Result[]): LikelyOrganism[] {
  const by = new Map<string, number>();
  for (const r of list) by.set(r.organism, (by.get(r.organism) ?? 0) + 1);
  return [...by.entries()]
    .map(([organism, n]) => ({ organism, n, share: list.length ? n / list.length : 0 }))
    .sort((a, b) => b.n - a.n || a.organism.localeCompare(b.organism));
}

/** Counts for exactly this query over the `days` up to and including `asOf`. */
export function windowCoverage(results: readonly Result[], asOf: IsoDate, query: PatientQuery, catalog: Catalog, days: number): WindowCounts {
  const from = addDays(asOf, 1 - days);
  const isolates = pool(results, from, asOf, query);
  const drugs: DrugFigure[] = [];
  for (const a of treatmentsFor(catalog, query.specimen)) {
    const c = countCovered(asRecords(isolates), a.code as AntibioticCode);
    if (c.known === 0 || 1 - c.known / isolates.length > MAX_UNTESTED) continue;
    drugs.push({ antibiotic: a.code, aware: awareOf(a.code), main: { works: c.covered, n: c.known } });
  }
  return { basis: { n: isolates.length }, drugs, organisms: organismsOf(pool(results, from, asOf, query, false)) };
}

/** One point per calendar month, the last `months` up to asOf's month; an antibiotic over a fifth untested that month counts as no result. */
export function monthly(results: readonly Result[], asOf: IsoDate, query: PatientQuery, antibiotic: string, months: number): MonthPoint[] {
  const last = monthStart(asOf);
  const points: MonthPoint[] = [];
  for (let i = Math.max(0, Math.floor(months)) - 1; i >= 0; i--) {
    const month = addMonths(last, -i);
    const isolates = pool(results, month, minDate(monthEnd(month), asOf), query);
    const c = countCovered(asRecords(isolates), antibiotic as AntibioticCode);
    const enough = c.known > 0 && 1 - c.known / isolates.length <= MAX_UNTESTED;
    points.push({ month, share: enough ? { works: c.covered, n: c.known } : { works: 0, n: 0 } });
  }
  return points;
}
