import { firstIsolates } from "@aei/counting";
import {
  ANTIBIOTICS,
  type AntibioticCode,
  type IsoDate,
  type IsolateRecord,
  type Organism,
  type Sex,
  type Specimen,
  WARDS,
  type WardCode,
} from "@aei/domain";
import { effectiveResult, suitsSpecimen } from "@aei/eucast";
import { addDays } from "@aei/replay";

// The doctor's empirical coverage list (D-023, provisional): for a unit and
// specimen, how often each antibiotic covered what grew, over the last year
// of first isolates, falling back from the unit to its ward type to the
// hospital when fewer than `minTested` results exist. experiments/0004 found
// the year predicts the next four weeks better than the last four weeks, so
// the four-week counts are returned only as context. Informs; does not
// prescribe.

export type Level = "unit" | "ward type" | "hospital";

export interface CoverageQuery {
  asOf: IsoDate;
  ward: WardCode;
  specimen: Specimen;
  /** Restrict to one sex (urinary E. coli resistance differs by sex: experiments/0005). */
  sex?: Sex;
  /** Days in the main window. Default 365. */
  windowDays?: number;
  /** Results needed before a level is used. Default 30 (CONTEXT.md). */
  minTested?: number;
}

export interface Counts {
  covered: number;
  /** Isolates with a known result: tested, intrinsic, inferred, or no breakpoint (counts as not covered). */
  known: number;
}

export interface AntibioticCoverage {
  antibiotic: AntibioticCode;
  /** Share covered at the level used, or null when no level reaches `minTested`. */
  share: number | null;
  /** 95 % Wilson interval of `share`. */
  interval: [number, number] | null;
  level: Level | null;
  counts: Record<Level, Counts>;
  /** The unit's last 28 days, for context only. */
  recent: Counts;
  /** Organisms in the pool with no result for this antibiotic, as a share of the pool's isolates. */
  untested: { organism: Organism; share: number }[];
  /** Organisms resistant by nature or with no breakpoint, as a share of the pool's isolates. */
  notCovering: { organism: Organism; share: number }[];
  /**
   * Within the antibiotic's intended spectrum (D-027): organisms EUCAST gives
   * no breakpoint for are left out, resistance by nature still counts
   * against. Same fallback levels and interval as above.
   */
  spectrum: { share: number | null; interval: [number, number] | null; level: Level | null; counts: Record<Level, Counts> };
  /** Organisms outside the intended spectrum (no breakpoint), as a share of the pool's isolates. */
  outsideSpectrum: { organism: Organism; share: number }[];
}

export interface CoverageResult {
  query: Required<Omit<CoverageQuery, "sex">> & { sex: Sex | null };
  from: IsoDate;
  /** First isolates of the unit and specimen in the window, per organism, most common first. */
  organisms: { organism: Organism; isolates: number; share: number }[];
  antibiotics: AntibioticCoverage[];
  /**
   * Every pair of antibiotics that suit the specimen, over all organisms: a
   * pair covers an isolate if either antibiotic does (D-028). Most covering
   * first.
   */
  combinations: CombinationCoverage[];
}

export interface CombinationCoverage {
  antibiotics: [AntibioticCode, AntibioticCode];
  share: number | null;
  interval: [number, number] | null;
  level: Level | null;
  counts: Record<Level, Counts>;
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

export function coverage(records: readonly IsolateRecord[], q: CoverageQuery): CoverageResult {
  const windowDays = q.windowDays ?? 365;
  const minTested = q.minTested ?? 30;
  const from = addDays(q.asOf, 1 - windowDays);
  const pick = (r: IsolateRecord, since: IsoDate) =>
    r.sampleDate >= since && r.sampleDate <= q.asOf && r.specimen === q.specimen && (!q.sex || r.sex === q.sex);
  const pool = firstIsolates(
    records.filter((r) => pick(r, from)),
    { from, to: q.asOf },
  );
  const recentFrom = addDays(q.asOf, -27);
  const recentPool = firstIsolates(
    records.filter((r) => pick(r, recentFrom) && r.ward === q.ward),
    { from: recentFrom, to: q.asOf },
  );
  const levels: Record<Level, IsolateRecord[]> = {
    unit: pool.filter((r) => r.ward === q.ward),
    "ward type": pool.filter((r) => WARD_TYPE.get(r.ward) === WARD_TYPE.get(q.ward)),
    hospital: pool,
  };

  const count = (list: readonly IsolateRecord[], a: AntibioticCode, inSpectrumOnly = false): Counts => {
    let covered = 0;
    let known = 0;
    for (const r of list) {
      const e = effectiveResult(r, a);
      if (e.basis === "untested" || (inSpectrumOnly && e.basis === "no-breakpoint")) continue;
      known++;
      if (e.result === "S") covered++;
    }
    return { covered, known };
  };
  const unit = levels.unit;
  const organismShare = (pred: (r: IsolateRecord) => boolean) => {
    const by = new Map<Organism, number>();
    for (const r of unit) if (pred(r)) by.set(r.organism, (by.get(r.organism) ?? 0) + 1);
    return [...by.entries()]
      .map(([organism, n]) => ({ organism, share: unit.length ? n / unit.length : 0 }))
      .sort((a, b) => b.share - a.share);
  };

  const antibiotics = ANTIBIOTICS.filter((a) => suitsSpecimen(a.code, q.specimen)).map((a): AntibioticCoverage => {
    const counts = {
      unit: count(levels.unit, a.code),
      "ward type": count(levels["ward type"], a.code),
      hospital: count(levels.hospital, a.code),
    };
    const level = (["unit", "ward type", "hospital"] as Level[]).find((l) => counts[l].known >= minTested) ?? null;
    const c = level ? counts[level] : null;
    const sCounts = {
      unit: count(levels.unit, a.code, true),
      "ward type": count(levels["ward type"], a.code, true),
      hospital: count(levels.hospital, a.code, true),
    };
    const sLevel = (["unit", "ward type", "hospital"] as Level[]).find((l) => sCounts[l].known >= minTested) ?? null;
    const sc = sLevel ? sCounts[sLevel] : null;
    return {
      antibiotic: a.code,
      share: c ? c.covered / c.known : null,
      interval: c ? wilson(c.covered, c.known) : null,
      level,
      counts,
      recent: count(recentPool, a.code),
      untested: organismShare((r) => effectiveResult(r, a.code).basis === "untested"),
      notCovering: organismShare((r) => {
        const e = effectiveResult(r, a.code);
        return e.basis === "intrinsic" || e.basis === "no-breakpoint";
      }),
      spectrum: {
        share: sc ? sc.covered / sc.known : null,
        interval: sc ? wilson(sc.covered, sc.known) : null,
        level: sLevel,
        counts: sCounts,
      },
      outsideSpectrum: organismShare((r) => effectiveResult(r, a.code).basis === "no-breakpoint"),
    };
  });

  // A pair covers an isolate if either antibiotic does. Only isolates with a known result for both
  // count: keeping "covered by the tested one" while dropping "missed by the tested one" would bias up.
  const countPair = (list: readonly IsolateRecord[], a: AntibioticCode, b: AntibioticCode): Counts => {
    let covered = 0;
    let known = 0;
    for (const r of list) {
      const ea = effectiveResult(r, a);
      const eb = effectiveResult(r, b);
      if (ea.basis === "untested" || eb.basis === "untested") continue;
      known++;
      if (ea.result === "S" || eb.result === "S") covered++;
    }
    return { covered, known };
  };
  const codes = antibiotics.map((a) => a.antibiotic);
  const combinations: CombinationCoverage[] = [];
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const pair: [AntibioticCode, AntibioticCode] = [codes[i] as AntibioticCode, codes[j] as AntibioticCode];
      const counts = {
        unit: countPair(levels.unit, ...pair),
        "ward type": countPair(levels["ward type"], ...pair),
        hospital: countPair(levels.hospital, ...pair),
      };
      const level = (["unit", "ward type", "hospital"] as Level[]).find((l) => counts[l].known >= minTested) ?? null;
      const c = level ? counts[level] : null;
      combinations.push({
        antibiotics: pair,
        share: c ? c.covered / c.known : null,
        interval: c ? wilson(c.covered, c.known) : null,
        level,
        counts,
      });
    }
  }
  combinations.sort((x, y) => (y.share ?? -1) - (x.share ?? -1));

  const byOrganism = new Map<Organism, number>();
  for (const r of unit) byOrganism.set(r.organism, (byOrganism.get(r.organism) ?? 0) + 1);
  return {
    query: { asOf: q.asOf, ward: q.ward, specimen: q.specimen, sex: q.sex ?? null, windowDays, minTested },
    from,
    organisms: [...byOrganism.entries()]
      .map(([organism, isolates]) => ({ organism, isolates, share: unit.length ? isolates / unit.length : 0 }))
      .sort((a, b) => b.isolates - a.isolates),
    antibiotics: antibiotics.sort((x, y) => (y.share ?? -1) - (x.share ?? -1)),
    combinations,
  };
}

// ---------- suggestion order (D-026, provisional) ----------

/** WHO AWaRe classification (2023) of the dataset's antibiotics: Access first, Watch kept for when Access falls short. */
export const AWARE: Record<AntibioticCode, "Access" | "Watch"> = {
  AMP: "Access",
  MEC: "Access",
  TMP: "Access",
  NIT: "Access",
  CLI: "Access",
  TZP: "Watch",
  FOX: "Watch",
  CXM: "Watch",
  CRO: "Watch",
  CAZ: "Watch",
  MEM: "Watch",
  CIP: "Watch",
  VAN: "Watch",
};

/** Expected coverage a choice should reach: 80 % for mild or moderate infections, 90 % for severe ones (Artem's notes, A3). */
export const THRESHOLDS = { mild: 0.8, severe: 0.9 } as const;
export type Severity = keyof typeof THRESHOLDS;

export type Standing = "clears" | "borderline" | "below" | "not assessable";

export interface Suggestion {
  antibiotic: AntibioticCode;
  aware: "Access" | "Watch";
  standing: Standing;
  /** The share and interval the standing rests on: within the intended spectrum (mild) or all organisms (severe), D-027. */
  basis: "spectrum" | "all organisms";
  share: number | null;
  interval: [number, number] | null;
  coverage: AntibioticCoverage;
}

/** Share of the unit's pool with no result for an antibiotic above which it is not assessed. */
export const MAX_UNTESTED = 0.2;

/**
 * Orders the coverage list the way an empirical choice is made: antibiotics
 * whose whole 95 % interval clears the threshold first, Access before
 * Watch, then by coverage; then those whose estimate clears it but whose
 * interval does not; then the rest. Antibiotics with no level of 30 results,
 * or untested on more than a fifth of the pool, are "not assessable" and
 * come last. Mild infections are judged within each antibiotic's intended
 * spectrum, severe ones over all organisms, since a severe infection must be
 * covered whatever grows (D-027). Informs; the doctor decides.
 */
export function suggest(result: CoverageResult, severity: Severity): Suggestion[] {
  const threshold = THRESHOLDS[severity];
  const rank: Record<Standing, number> = { clears: 0, borderline: 1, below: 2, "not assessable": 3 };
  const basis = severity === "mild" ? "spectrum" : "all organisms";
  return result.antibiotics
    .map((c): Suggestion => {
      const untested = c.untested.reduce((s, u) => s + u.share, 0);
      const { share, interval } = basis === "spectrum" ? c.spectrum : c;
      const standing: Standing =
        share === null || interval === null || untested > MAX_UNTESTED
          ? "not assessable"
          : interval[0] >= threshold
            ? "clears"
            : share >= threshold
              ? "borderline"
              : "below";
      return { antibiotic: c.antibiotic, aware: AWARE[c.antibiotic], standing, basis, share, interval, coverage: c };
    })
    .sort(
      (a, b) =>
        rank[a.standing] - rank[b.standing] ||
        (a.standing === "clears" ? (a.aware === b.aware ? 0 : a.aware === "Access" ? -1 : 1) : 0) ||
        (b.share ?? -1) - (a.share ?? -1),
    );
}

export interface CombinationSuggestion {
  antibiotics: [AntibioticCode, AntibioticCode];
  /** Access antibiotics in the pair (0 to 2). */
  access: number;
  standing: Standing;
  coverage: CombinationCoverage;
}

/**
 * Pairs worth considering when no single antibiotic clears the threshold
 * (D-028): pairs whose 95 % interval clears it, then those whose estimate
 * does, each with more Access antibiotics first, then by coverage. Empty
 * when a single antibiotic already clears. Over all organisms, whatever the
 * severity.
 */
export function suggestCombinations(result: CoverageResult, severity: Severity, limit = 5): CombinationSuggestion[] {
  if (suggest(result, severity).some((s) => s.standing === "clears")) return [];
  const threshold = THRESHOLDS[severity];
  const rank: Record<Standing, number> = { clears: 0, borderline: 1, below: 2, "not assessable": 3 };
  const untested = new Map(result.antibiotics.map((a) => [a.antibiotic, a.untested.reduce((s, u) => s + u.share, 0)]));
  return result.combinations
    .map((c): CombinationSuggestion => {
      const standing: Standing =
        c.share === null || c.interval === null || c.antibiotics.some((a) => (untested.get(a) ?? 0) > MAX_UNTESTED)
          ? "not assessable"
          : c.interval[0] >= threshold
            ? "clears"
            : c.share >= threshold
              ? "borderline"
              : "below";
      const access = c.antibiotics.filter((a) => AWARE[a] === "Access").length;
      return { antibiotics: c.antibiotics, access, standing, coverage: c };
    })
    .filter((c) => c.standing === "clears" || c.standing === "borderline")
    .sort((a, b) => rank[a.standing] - rank[b.standing] || b.access - a.access || (b.coverage.share ?? -1) - (a.coverage.share ?? -1))
    .slice(0, limit);
}
