import { firstIsolates } from "@aei/counting";
import {
  type AgeGroup,
  ANTIBIOTICS,
  type AntibioticCode,
  type IsoDate,
  type IsolateRecord,
  inAgeGroup,
  isHospitalOnset,
  type Organism,
  type Sex,
  type Specimen,
  WARDS,
  type WardCode,
} from "@aei/domain";
import { effectiveResult, suitsSpecimen } from "@aei/eucast";
import { addDays } from "@aei/replay";

// The doctor's empirical coverage list (D-023, revised by D-033): for a unit
// and specimen, how often each antibiotic covered what grew, over the last
// year of first isolates. One level is chosen per query: the unit if its pool
// has at least `minTested` isolates, else its ward type, else the hospital;
// every share and every "untested" share is computed on that level's pool.
// experiments/0004 found the year predicts the next four weeks better than the
// last four weeks, so the four-week counts are context only. Informs; does
// not prescribe.

export type Level = "unit" | "ward type" | "hospital";

/** "hospital": sampled on day 3 of the stay or later (`isHospitalOnset`, CONTEXT.md). */
export type Onset = "hospital";

/** The patient filters a query may ask for. */
export type PatientFilter = "sex" | "ageGroup" | "onset";

/**
 * When the unit has too few isolates with every patient filter asked for, filters are dropped one at a
 * time in this order, before the unit is (D-033, D-047): age group first, then onset, then sex.
 */
export const DROP_ORDER: readonly PatientFilter[] = ["ageGroup", "onset", "sex"];

export interface CoverageQuery {
  asOf: IsoDate;
  ward: WardCode;
  specimen: Specimen;
  /** Restrict to one sex (urinary E. coli resistance differs by sex: experiments/0005). Dropped before the unit is. */
  sex?: Sex;
  /** Restrict to one age group of the fixed table (D-019, `AGE_GROUPS`). Dropped before the unit is (D-047). */
  ageGroup?: AgeGroup;
  /** Restrict to hospital-onset isolates: sampled on day 3 of the stay or later. Dropped before the unit is (D-047). */
  onset?: Onset;
  /** Days in the main window. Default 365. */
  windowDays?: number;
  /** Isolates a level needs before it is used. Default 30 (CONTEXT.md). */
  minTested?: number;
}

export interface Counts {
  covered: number;
  /** Isolates with a known result: tested, intrinsic, inferred, or no breakpoint (counts as not covered). */
  known: number;
}

/** Antibiotics not offered for a specimen although EUCAST reports them (no clinical use there). */
export const NOT_OFFERED: Partial<Record<Specimen, readonly AntibioticCode[]>> = { urine: ["VAN", "CLI"] };

export interface Share {
  /** Share covered, or null when fewer than `minTested` isolates have a known result at the level. */
  share: number | null;
  /** 95 % Wilson interval of `share`. */
  interval: [number, number] | null;
  counts: Counts;
}

export interface AntibioticCoverage extends Share {
  antibiotic: AntibioticCode;
  /**
   * Within the antibiotic's intended spectrum (D-027): organisms EUCAST gives
   * no breakpoint for are left out, resistance by nature still counts against.
   */
  spectrum: Share;
  /** The unit's last 28 days, for context only. */
  recent: Counts;
  /** Organisms in the level's pool with no result for this antibiotic, as shares of that pool. */
  untested: { organism: Organism; share: number }[];
  /** Organisms resistant by nature or with no breakpoint, as shares of the level's pool. */
  notCovering: { organism: Organism; share: number }[];
  /** Organisms outside the intended spectrum (no breakpoint), as shares of the level's pool. */
  outsideSpectrum: { organism: Organism; share: number }[];
}

export interface CombinationCoverage extends Share {
  antibiotics: [AntibioticCode, AntibioticCode];
  /** Isolates covered by each antibiotic alone, among those the pair counts. */
  alone: [number, number];
  /** Share of the level's pool where either antibiotic has no result. */
  untested: number;
}

export interface CoverageResult {
  query: Required<Omit<CoverageQuery, PatientFilter>> & { sex: Sex | null; ageGroup: AgeGroup | null; onset: Onset | null };
  /** The level every figure comes from, and its pool of first isolates. */
  level: Level;
  isolates: number;
  /** False when the sex filter was dropped to keep the unit's own data (or a sex was not asked for). */
  sexApplied: boolean;
  /** False when the age-group filter was dropped to keep the unit's own data (or none was asked for). */
  ageGroupApplied: boolean;
  /** False when the onset filter was dropped to keep the unit's own data (or none was asked for). */
  onsetApplied: boolean;
  from: IsoDate;
  /** First isolates of the level's pool, per organism, most common first. */
  organisms: { organism: Organism; isolates: number; share: number }[];
  antibiotics: AntibioticCoverage[];
  /** Every pair of offered antibiotics, over all organisms (D-028), most covering first. */
  combinations: CombinationCoverage[];
}

const WARD_TYPE = new Map(WARDS.map((w) => [w.code, w.type]));

/** 95 % Wilson score interval for k of n. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/**
 * Covered and known counts for one antibiotic over a list of isolates, with
 * the EUCAST rules (`effectiveResult`): untested isolates are left out;
 * resistance by nature counts as not covered; with `inSpectrumOnly`,
 * organisms the antibiotic has no breakpoint for are left out too (D-027).
 */
export function countCovered(list: readonly IsolateRecord[], antibiotic: AntibioticCode, inSpectrumOnly = false): Counts {
  let covered = 0;
  let known = 0;
  for (const r of list) {
    const e = effectiveResult(r, antibiotic);
    if (e.basis === "untested" || (inSpectrumOnly && e.basis === "no-breakpoint")) continue;
    known++;
    if (e.result === "S") covered++;
  }
  return { covered, known };
}

/** The antibiotics offered for a specimen, in the dataset's order: suited to it (EUCAST) and not in NOT_OFFERED. */
export function offeredFor(specimen: Specimen): readonly AntibioticCode[] {
  return ANTIBIOTICS.filter((a) => suitsSpecimen(a.code, specimen) && !NOT_OFFERED[specimen]?.includes(a.code)).map((a) => a.code);
}

export function coverage(records: readonly IsolateRecord[], q: CoverageQuery): CoverageResult {
  const windowDays = q.windowDays ?? 365;
  const minTested = q.minTested ?? 30;
  const from = addDays(q.asOf, 1 - windowDays);
  const inWindow = (r: IsolateRecord, since: IsoDate) => r.sampleDate >= since && r.sampleDate <= q.asOf && r.specimen === q.specimen;
  const all = firstIsolates(
    records.filter((r) => inWindow(r, from)),
    { from, to: q.asOf },
  );
  const inLevel: Record<Level, (r: IsolateRecord) => boolean> = {
    unit: (r) => r.ward === q.ward,
    "ward type": (r) => WARD_TYPE.get(r.ward) === WARD_TYPE.get(q.ward),
    hospital: () => true,
  };
  // Patient filters are dropped one at a time, in DROP_ORDER, before the unit is (D-033, D-047). When the
  // unit is short even with none, all are kept and the level widens with them.
  const { sex, ageGroup, onset } = q;
  const tests: Record<PatientFilter, ((r: IsolateRecord) => boolean) | null> = {
    sex: sex ? (r) => r.sex === sex : null,
    ageGroup: ageGroup ? (r) => inAgeGroup(r.ageYears, ageGroup) : null,
    onset: onset === "hospital" ? isHospitalOnset : null,
  };
  const asked = DROP_ORDER.filter((f) => tests[f]);
  const passes = (kept: readonly PatientFilter[]) => (r: IsolateRecord) => kept.every((f) => tests[f]?.(r) ?? true);
  let kept = asked;
  if (all.filter(inLevel.unit).length >= minTested)
    for (let dropped = 0; dropped <= asked.length; dropped++) {
      kept = asked.slice(dropped);
      if (all.filter((r) => inLevel.unit(r) && passes(kept)(r)).length >= minTested) break;
    }
  const applied = passes(kept);
  const sexApplied = kept.includes("sex");
  const base = all.filter(applied);
  const level = (["unit", "ward type"] as Level[]).find((l) => base.filter(inLevel[l]).length >= minTested) ?? "hospital";
  const pool = base.filter(inLevel[level]);
  const recentFrom = addDays(q.asOf, -27);
  const recentPool = firstIsolates(
    records.filter((r) => inWindow(r, recentFrom) && r.ward === q.ward && applied(r)),
    { from: recentFrom, to: q.asOf },
  );

  const share = (c: Counts): Share =>
    c.known >= minTested
      ? { share: c.covered / c.known, interval: wilson(c.covered, c.known), counts: c }
      : { share: null, interval: null, counts: c };
  const count = countCovered;
  const organismShare = (pred: (r: IsolateRecord) => boolean) => {
    const by = new Map<Organism, number>();
    for (const r of pool) if (pred(r)) by.set(r.organism, (by.get(r.organism) ?? 0) + 1);
    return [...by.entries()].map(([organism, n]) => ({ organism, share: n / pool.length })).sort((a, b) => b.share - a.share);
  };

  const codes = offeredFor(q.specimen);
  const antibiotics = codes.map(
    (code): AntibioticCoverage => ({
      antibiotic: code,
      ...share(count(pool, code)),
      spectrum: share(count(pool, code, true)),
      recent: count(recentPool, code),
      untested: organismShare((r) => effectiveResult(r, code).basis === "untested"),
      notCovering: organismShare((r) => {
        const e = effectiveResult(r, code);
        return e.basis === "intrinsic" || e.basis === "no-breakpoint";
      }),
      outsideSpectrum: organismShare((r) => effectiveResult(r, code).basis === "no-breakpoint"),
    }),
  );

  // A pair covers an isolate if either antibiotic does, counted only on isolates with a known result for
  // both; how many isolates lack one of them is kept, since that dropout is not random by organism.
  const combinations: CombinationCoverage[] = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const pair: [AntibioticCode, AntibioticCode] = [codes[i] as AntibioticCode, codes[j] as AntibioticCode];
      let covered = 0;
      let known = 0;
      let a = 0;
      let b = 0;
      for (const r of pool) {
        const ea = effectiveResult(r, pair[0]);
        const eb = effectiveResult(r, pair[1]);
        if (ea.basis === "untested" || eb.basis === "untested") continue;
        known++;
        if (ea.result === "S") a++;
        if (eb.result === "S") b++;
        if (ea.result === "S" || eb.result === "S") covered++;
      }
      combinations.push({
        antibiotics: pair,
        ...share({ covered, known }),
        alone: [a, b],
        untested: pool.length ? 1 - known / pool.length : 0,
      });
    }
  }
  combinations.sort((x, y) => (y.share ?? -1) - (x.share ?? -1));

  const byOrganism = new Map<Organism, number>();
  for (const r of pool) byOrganism.set(r.organism, (byOrganism.get(r.organism) ?? 0) + 1);
  return {
    query: {
      asOf: q.asOf,
      ward: q.ward,
      specimen: q.specimen,
      sex: q.sex ?? null,
      ageGroup: q.ageGroup ?? null,
      onset: q.onset ?? null,
      windowDays,
      minTested,
    },
    level,
    isolates: pool.length,
    sexApplied,
    ageGroupApplied: kept.includes("ageGroup"),
    onsetApplied: kept.includes("onset"),
    from,
    organisms: [...byOrganism.entries()]
      .map(([organism, isolates]) => ({ organism, isolates, share: pool.length ? isolates / pool.length : 0 }))
      .sort((x, y) => y.isolates - x.isolates),
    antibiotics: antibiotics.sort((x, y) => (y.share ?? -1) - (x.share ?? -1)),
    combinations,
  };
}

// ---------- suggestion order (D-026, D-050) ----------

/** Expected coverage a choice should reach: 80 % for mild or moderate infections, 90 % for severe ones (Artem's notes, A3). */
export const THRESHOLDS = { mild: 0.8, severe: 0.9 } as const;
export type Severity = keyof typeof THRESHOLDS;

export type Standing = "clears" | "borderline" | "below" | "not assessable";

/** Given only by injection: left out of suggestions for mild infections (D-033). */
export const IV_ONLY: readonly AntibioticCode[] = ["TZP", "FOX", "CRO", "CAZ", "MEM", "VAN"];
/** Beta-lactams: a pair of two adds little beyond one of them, so such pairs are not suggested. */
export const BETA_LACTAMS: readonly AntibioticCode[] = ["AMP", "MEC", "TZP", "FOX", "CXM", "CRO", "CAZ", "MEM"];
/** Urine-only agents reach no useful level in blood or tissue: not for severe infections. */
export const URINE_ONLY: readonly AntibioticCode[] = ["MEC", "TMP", "NIT"];
/** A partner must cover at least this much more than the better antibiotic of a pair alone. */
export const MIN_PARTNER_GAIN = 0.02;

export interface Suggestion {
  antibiotic: AntibioticCode;
  standing: Standing;
  /** The share the standing rests on: within the intended spectrum (mild) or all organisms (severe), D-027. */
  basis: "spectrum" | "all organisms";
  share: number | null;
  interval: [number, number] | null;
  /** Over all organisms, always shown next to the standing (D-033). */
  allOrganisms: { share: number | null; interval: [number, number] | null };
  coverage: AntibioticCoverage;
}

/** Share of the level's pool with no result for an antibiotic above which it is not assessed. */
export const MAX_UNTESTED = 0.2;

const standingOf = (share: number | null, interval: [number, number] | null, untested: number, threshold: number): Standing =>
  share === null || interval === null || untested > MAX_UNTESTED
    ? "not assessable"
    : interval[0] >= threshold
      ? "clears"
      : share >= threshold
        ? "borderline"
        : "below";
const RANK: Record<Standing, number> = { clears: 0, borderline: 1, below: 2, "not assessable": 3 };

/**
 * Orders the coverage list the way an empirical choice is made: antibiotics
 * whose whole 95 % interval clears the threshold first, by coverage (no WHO
 * AWaRe tier, D-050); then those whose estimate clears it but whose
 * interval does not; then the rest. "Not assessable" when fewer than 30
 * isolates have a result or over a fifth of the level's pool is untested.
 * Mild infections are judged within each antibiotic's intended spectrum and
 * leave out drugs given only by injection; severe ones over all organisms
 * (D-027, D-033). Every row carries the all-organism share. Informs; the
 * doctor decides.
 */
export function suggest(result: CoverageResult, severity: Severity): Suggestion[] {
  const threshold = THRESHOLDS[severity];
  const basis = severity === "mild" ? "spectrum" : "all organisms";
  return result.antibiotics
    .filter((c) => severity !== "mild" || !IV_ONLY.includes(c.antibiotic))
    .map((c): Suggestion => {
      const untested = c.untested.reduce((s, u) => s + u.share, 0);
      const { share, interval } = basis === "spectrum" ? c.spectrum : c;
      return {
        antibiotic: c.antibiotic,
        standing: standingOf(share, interval, untested, threshold),
        basis,
        share,
        interval,
        allOrganisms: { share: c.share, interval: c.interval },
        coverage: c,
      };
    })
    .sort((a, b) => RANK[a.standing] - RANK[b.standing] || (b.share ?? -1) - (a.share ?? -1));
}

export interface CombinationSuggestion {
  antibiotics: [AntibioticCode, AntibioticCode];
  standing: Standing;
  /** How much more the pair covers than its better antibiotic alone, on the same isolates. */
  gain: number;
  coverage: CombinationCoverage;
}

/**
 * Pairs worth considering when no single antibiotic clears the threshold
 * (D-028, D-033), over all organisms: a pair is considered only when its
 * partner covers at least two points more than the better antibiotic alone,
 * when it is not two beta-lactams, and when neither is a urine-only agent.
 * Not assessable when over a fifth of the pool lacks a result for either.
 * Clears before borderline, then by coverage. Severe
 * infections only: a mild one is treated with one antibiotic.
 */
export function suggestCombinations(result: CoverageResult, severity: Severity, limit = 5): CombinationSuggestion[] {
  // Two antibiotics at once is for severe infections only.
  if (severity !== "severe" || suggest(result, severity).some((s) => s.standing === "clears")) return [];
  const threshold = THRESHOLDS[severity];
  return result.combinations
    .filter(
      ({ antibiotics: [a, b] }) =>
        !(BETA_LACTAMS.includes(a) && BETA_LACTAMS.includes(b)) && !URINE_ONLY.includes(a) && !URINE_ONLY.includes(b),
    )
    .map((c): CombinationSuggestion => {
      const gain = c.counts.known ? (c.counts.covered - Math.max(...c.alone)) / c.counts.known : 0;
      return {
        antibiotics: c.antibiotics,
        standing: standingOf(c.share, c.interval, c.untested, threshold),
        gain,
        coverage: c,
      };
    })
    .filter((c) => (c.standing === "clears" || c.standing === "borderline") && c.gain >= MIN_PARTNER_GAIN)
    .sort((a, b) => RANK[a.standing] - RANK[b.standing] || (b.coverage.share ?? -1) - (a.coverage.share ?? -1))
    .slice(0, limit);
}
