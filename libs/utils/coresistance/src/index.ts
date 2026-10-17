import { firstIsolates } from "@aei/counting";
import { DROP_ORDER, type Level, type Onset, type PatientFilter, wilson } from "@aei/coverage";
import {
  type AgeGroup,
  ANTIBIOTICS,
  type AntibioticCode,
  type IsoDate,
  type IsolateRecord,
  inAgeGroup,
  isHospitalOnset,
  type Sex,
  type Specimen,
  WARDS,
  type WardCode,
} from "@aei/domain";
import { addDays } from "@aei/replay";

// "Fails together" (D-048): when antibiotic A failed on an isolate from this
// unit, how often did antibiotic B fail on the same isolate? Measured from the
// hospital's own first isolates, never from a drug-class table: any antibiotic
// codes in the data are paired with each other. Only results the laboratory
// actually reported count (no inferred or intrinsic values), and a pair is
// shown only when at least `minResisted` isolates resisted A and were tested
// for B. Informs; the doctor decides.

export type { Level, Onset, PatientFilter } from "@aei/coverage";

export interface FailsTogetherQuery {
  asOf: IsoDate;
  ward: WardCode;
  specimen: Specimen;
  sex?: Sex;
  ageGroup?: AgeGroup;
  onset?: Onset;
  /** Days in the window. Default 365, as the coverage list. */
  windowDays?: number;
  /** Isolates that resisted A and were tested for B before a pair is shown. Default 30 (the organiser's floor). */
  minResisted?: number;
  /** Linked antibiotics kept per A in `byAntibiotic`. Default 5. */
  top?: number;
}

export interface Link {
  /** The antibiotic that failed. */
  antibiotic: AntibioticCode;
  /** The antibiotic that may fail with it. */
  partner: AntibioticCode;
  /** Isolates tested for both that resisted `antibiotic`: the denominator. */
  resisted: number;
  /** Of those, isolates that also resisted `partner`. */
  resistedBoth: number;
  /** resistedBoth / resisted. */
  share: number;
  /** 95 % Wilson interval of `share`. */
  interval: [number, number];
  /** Where the counts come from: the unit, its ward type or the whole hospital. */
  level: Level;
  /** Patient filters still applied at that level (some are dropped before the unit is, as in the coverage list). */
  filters: PatientFilter[];
}

export interface FailsTogetherResult {
  query: {
    asOf: IsoDate;
    ward: WardCode;
    specimen: Specimen;
    sex: Sex | null;
    ageGroup: AgeGroup | null;
    onset: Onset | null;
    windowDays: number;
    minResisted: number;
    top: number;
  };
  from: IsoDate;
  /** First isolates in the window for the specimen, hospital-wide, before any unit or patient filter. */
  isolates: number;
  /** Every pair that reached the floor at some level, most linked first. */
  pairs: Link[];
  /** Per antibiotic that failed: its most linked partners, highest share first, at most `top`. */
  byAntibiotic: { antibiotic: AntibioticCode; linked: Link[] }[];
}

const WARD_TYPE = new Map(WARDS.map((w) => [w.code, w.type]));
const ORDER = new Map(ANTIBIOTICS.map((a, i) => [a.code as string, i]));
const byCodeOrder = (a: string, b: string) => (ORDER.get(a) ?? 1e9) - (ORDER.get(b) ?? 1e9) || a.localeCompare(b);

interface Step {
  level: Level;
  filters: PatientFilter[];
  test: (r: IsolateRecord) => boolean;
}

/** resisted[A][B]: tested for both and resisted A; both[A][B]: and resisted B too. */
type Matrix = Map<string, Map<string, { resisted: number; both: number }>>;

function countPairs(list: readonly IsolateRecord[]): Matrix {
  const m: Matrix = new Map();
  for (const r of list) {
    // Only what the laboratory reported: the dataset omits intrinsic pairs, and inferred values are left out.
    const tested = Object.entries(r.results).filter((e): e is [string, "S" | "R"] => e[1] === "S" || e[1] === "R");
    for (const [a, ra] of tested) {
      if (ra !== "R") continue;
      const row = m.get(a) ?? new Map<string, { resisted: number; both: number }>();
      m.set(a, row);
      for (const [b, rb] of tested) {
        if (b === a) continue;
        const cell = row.get(b) ?? { resisted: 0, both: 0 };
        row.set(b, cell);
        cell.resisted++;
        if (rb === "R") cell.both++;
      }
    }
  }
  return m;
}

/**
 * For each antibiotic A and every other antibiotic B: among first isolates
 * in the window tested for both that resisted A, the share that resisted B
 * too, with a 95 % Wilson interval. Each pair uses the narrowest level that
 * reaches the floor, widening the way the coverage list does: patient
 * filters are dropped at the unit first (DROP_ORDER), then the unit widens
 * to its ward type, then the hospital, with the filters asked for.
 */
export function failsTogether(records: readonly IsolateRecord[], q: FailsTogetherQuery): FailsTogetherResult {
  const windowDays = q.windowDays ?? 365;
  const minResisted = q.minResisted ?? 30;
  const top = q.top ?? 5;
  const from = addDays(q.asOf, 1 - windowDays);
  const all = firstIsolates(
    records.filter((r) => r.specimen === q.specimen && r.sampleDate >= from && r.sampleDate <= q.asOf),
    { from, to: q.asOf },
  );

  const tests: Record<PatientFilter, ((r: IsolateRecord) => boolean) | null> = {
    sex: q.sex ? (r) => r.sex === q.sex : null,
    ageGroup: q.ageGroup ? (r) => inAgeGroup(r.ageYears, q.ageGroup as AgeGroup) : null,
    onset: q.onset === "hospital" ? isHospitalOnset : null,
  };
  const asked = DROP_ORDER.filter((f) => tests[f]);
  const passes = (kept: readonly PatientFilter[]) => (r: IsolateRecord) => kept.every((f) => tests[f]?.(r) ?? true);
  const inLevel: Record<Level, (r: IsolateRecord) => boolean> = {
    unit: (r) => r.ward === q.ward,
    "ward type": (r) => WARD_TYPE.get(r.ward) === WARD_TYPE.get(q.ward),
    hospital: () => true,
  };
  const steps: Step[] = [];
  for (let dropped = 0; dropped <= asked.length; dropped++) {
    const kept = asked.slice(dropped);
    steps.push({ level: "unit", filters: kept, test: (r) => inLevel.unit(r) && passes(kept)(r) });
  }
  for (const level of ["ward type", "hospital"] as const)
    steps.push({ level, filters: asked, test: (r) => inLevel[level](r) && passes(asked)(r) });

  const matrices = steps.map((s) => countPairs(all.filter(s.test)));
  const codes = new Set<string>();
  for (const m of matrices) for (const [a, row] of m) for (const b of row.keys()) codes.add(a).add(b);

  const pairs: Link[] = [];
  for (const a of codes)
    for (const b of codes) {
      if (a === b) continue;
      const i = matrices.findIndex((m) => (m.get(a)?.get(b)?.resisted ?? 0) >= minResisted);
      if (i < 0) continue;
      const cell = matrices[i]?.get(a)?.get(b);
      const step = steps[i];
      if (!cell || !step) continue;
      pairs.push({
        antibiotic: a as AntibioticCode,
        partner: b as AntibioticCode,
        resisted: cell.resisted,
        resistedBoth: cell.both,
        share: cell.both / cell.resisted,
        interval: wilson(cell.both, cell.resisted),
        level: step.level,
        filters: [...step.filters],
      });
    }
  pairs.sort((x, y) => y.share - x.share || y.resisted - x.resisted || byCodeOrder(x.antibiotic, y.antibiotic));

  const byAntibiotic = [...new Set(pairs.map((p) => p.antibiotic))]
    .sort(byCodeOrder)
    .map((antibiotic) => ({ antibiotic, linked: pairs.filter((p) => p.antibiotic === antibiotic).slice(0, top) }));

  return {
    query: {
      asOf: q.asOf,
      ward: q.ward,
      specimen: q.specimen,
      sex: q.sex ?? null,
      ageGroup: q.ageGroup ?? null,
      onset: q.onset ?? null,
      windowDays,
      minResisted,
      top,
    },
    from,
    isolates: all.length,
    pairs,
    byAntibiotic,
  };
}

export interface Family<C extends string = string> {
  /** The laboratory's own class name from the code list. */
  class: string;
  antibiotics: C[];
}

/**
 * Groups antibiotics by the class field of the laboratory's code list
 * (domain ANTIBIOTICS or meta antibiotics[]), in the list's order, so the UI
 * can show related drugs together. Nothing is hard-coded: a new code list
 * gives new families.
 */
export function families<C extends string>(antibiotics: readonly { code: C; class: string }[]): Family<C>[] {
  const out = new Map<string, C[]>();
  for (const a of antibiotics) {
    const list = out.get(a.class);
    if (list) list.push(a.code);
    else out.set(a.class, [a.code]);
  }
  return [...out.entries()].map(([cls, codes]) => ({ class: cls, antibiotics: codes }));
}

/** True when two codes share a class in the code list. */
export function sameFamily(antibiotics: readonly { code: string; class: string }[], a: string, b: string): boolean {
  const ca = antibiotics.find((x) => x.code === a)?.class;
  return ca !== undefined && ca === antibiotics.find((x) => x.code === b)?.class;
}
