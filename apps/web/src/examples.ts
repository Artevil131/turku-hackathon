import type { AntibioticCode, Organism, Specimen, WardCode } from "@aei/domain";

// EXAMPLE FIGURES ONLY. The resistance counting method (first-isolate
// rule, period, fallbacks) is not decided yet (CONTEXT.md questions 7-8),
// so the analyzer is drawn from these made-up but plausibly shaped numbers.
// The structure is real: which antibiotics are tested per organism, which
// organism/specimen pairs occur, and how many isolates a unit sees in four
// weeks (CONTEXT.md, computed). The percentages are invented. Replace this
// module with a gear in libs/utils once the team picks the method.

export interface Figure {
  /** Share resistant, 0-100. */
  r: number;
  /** Isolates behind the figure. */
  n: number;
}

export interface Cell {
  antibiotic: AntibioticCode;
  recent: Figure;
  year: Figure;
  hospital: Figure;
}

export interface Strip {
  organism: Organism;
  specimen: Specimen;
  cells: Cell[];
}

/** Fixed column order, WHONET codes as in antibiotics.csv. */
export const COLUMNS: readonly AntibioticCode[] = [
  "AMP",
  "MEC",
  "TZP",
  "FOX",
  "CXM",
  "CRO",
  "CAZ",
  "MEM",
  "CIP",
  "TMP",
  "NIT",
  "VAN",
  "CLI",
];

const URINE_ONLY: ReadonlySet<AntibioticCode> = new Set(["MEC", "TMP", "NIT"]);

// Tested antibiotics per organism (measured: susceptibility.csv), with an
// invented typical share resistant for each.
const PROFILE: Record<Organism, Partial<Record<AntibioticCode, number>>> = {
  "Escherichia coli": { AMP: 36, MEC: 6, TZP: 5, CXM: 8, CRO: 6, MEM: 0.3, CIP: 12, TMP: 24, NIT: 2 },
  "Klebsiella pneumoniae": { AMP: 98, MEC: 9, TZP: 9, CXM: 12, CRO: 9, MEM: 0.6, CIP: 10, TMP: 18, NIT: 34 },
  "Klebsiella oxytoca": { AMP: 97, MEC: 7, TZP: 7, CXM: 10, CRO: 5, MEM: 0.4, CIP: 6, TMP: 12, NIT: 14 },
  "Proteus mirabilis": { AMP: 22, MEC: 4, TZP: 2, CXM: 5, CRO: 3, MEM: 0.2, CIP: 9, TMP: 28, NIT: 99 },
  "Citrobacter freundii": { MEC: 11, TZP: 14, CXM: 31, CRO: 18, MEM: 0.8, CIP: 7, TMP: 16, NIT: 6 },
  "Pseudomonas aeruginosa": { TZP: 9, CAZ: 7, MEM: 6, CIP: 10 },
  "Enterococcus faecalis": { AMP: 1, NIT: 2, VAN: 0.5 },
  "Staphylococcus aureus": { FOX: 2, TMP: 4, NIT: 1, VAN: 0, CLI: 9 },
  "Staphylococcus saprophyticus": { TMP: 7, NIT: 1 },
};

// Isolates per specimen over the three years (measured: isolates.csv).
const PAIRS: readonly [Organism, Specimen, number][] = [
  ["Escherichia coli", "urine", 10619],
  ["Escherichia coli", "wound", 613],
  ["Escherichia coli", "blood", 302],
  ["Klebsiella pneumoniae", "urine", 2035],
  ["Klebsiella pneumoniae", "wound", 256],
  ["Klebsiella pneumoniae", "blood", 93],
  ["Staphylococcus aureus", "wound", 2127],
  ["Staphylococcus aureus", "urine", 629],
  ["Staphylococcus aureus", "blood", 261],
  ["Enterococcus faecalis", "urine", 1794],
  ["Enterococcus faecalis", "wound", 503],
  ["Enterococcus faecalis", "blood", 88],
  ["Proteus mirabilis", "urine", 1258],
  ["Proteus mirabilis", "wound", 427],
  ["Pseudomonas aeruginosa", "urine", 845],
  ["Pseudomonas aeruginosa", "wound", 751],
  ["Pseudomonas aeruginosa", "blood", 57],
  ["Citrobacter freundii", "urine", 605],
  ["Citrobacter freundii", "wound", 242],
  ["Klebsiella oxytoca", "urine", 587],
  ["Staphylococcus saprophyticus", "urine", 378],
];
const TOTAL_ISOLATES = 24571;

// Median isolates per unit in 28 days (computed, CONTEXT.md).
const UNIT_PER_4WK: Record<WardCode, number> = {
  "PHC-S": 132,
  "PHC-N": 128,
  ED: 122,
  SURG: 56,
  URO: 51,
  "MED-A": 49,
  GER: 44,
  "MED-B": 31,
  ICU: 17,
};

// Units lean towards different specimens; invented weights.
const SPECIMEN_LEAN: Record<WardCode, Record<Specimen, number>> = {
  ED: { urine: 1, blood: 1.6, wound: 1.1 },
  "MED-A": { urine: 1, blood: 1.5, wound: 0.7 },
  "MED-B": { urine: 1, blood: 1.5, wound: 0.7 },
  SURG: { urine: 0.5, blood: 1.2, wound: 3.2 },
  URO: { urine: 1.25, blood: 0.7, wound: 0.3 },
  ICU: { urine: 0.7, blood: 3.5, wound: 1.6 },
  GER: { urine: 1.15, blood: 0.6, wound: 0.8 },
  "PHC-N": { urine: 1.2, blood: 0.05, wound: 0.6 },
  "PHC-S": { urine: 1.2, blood: 0.05, wound: 0.6 },
};

// One planted example deviation per demo, so the readout has something to
// point at: ciprofloxacin in urinary E. coli on Urology.
export const EXAMPLE_DEVIATION = {
  ward: "URO" as WardCode,
  organism: "Escherichia coli" as Organism,
  specimen: "urine" as Specimen,
  antibiotic: "CIP" as AntibioticCode,
  lift: 17,
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const round = (v: number) => Math.round(v * 10) / 10;

function figure(base: number, n: number, key: string, spread: number): Figure {
  const noise = (hash(key) - 0.5) * 2 * spread * Math.sqrt(Math.max(base, 2));
  return { r: round(clamp(base + noise)), n };
}

export function stripsFor(ward: WardCode, specimen: Specimen | "all"): Strip[] {
  const perFourWeeks = UNIT_PER_4WK[ward];
  return PAIRS.filter(([, s]) => specimen === "all" || s === specimen)
    .map(([organism, s, total]) => {
      const lean = SPECIMEN_LEAN[ward][s];
      const recentN = Math.round((total / TOTAL_ISOLATES) * perFourWeeks * lean * (0.85 + hash(ward + organism + s) * 0.3));
      const yearN = Math.round(recentN * 13 * (0.9 + hash(s + ward + organism) * 0.2));
      const hospitalN = Math.round((total / 3) * 1.0);
      const profile = PROFILE[organism];
      const cells: Cell[] = [];
      for (const antibiotic of COLUMNS) {
        const base = profile[antibiotic];
        if (base === undefined) continue;
        if (URINE_ONLY.has(antibiotic) && s !== "urine") continue;
        const key = `${ward}|${organism}|${s}|${antibiotic}`;
        const wardBase = clamp(base + (hash(`${key}#ward`) - 0.5) * Math.sqrt(Math.max(base, 1)) * 2.4);
        const isDeviation =
          ward === EXAMPLE_DEVIATION.ward &&
          organism === EXAMPLE_DEVIATION.organism &&
          s === EXAMPLE_DEVIATION.specimen &&
          antibiotic === EXAMPLE_DEVIATION.antibiotic;
        const recentBase = isDeviation ? wardBase + EXAMPLE_DEVIATION.lift : wardBase;
        cells.push({
          antibiotic,
          recent: figure(recentBase, recentN, `${key}#recent`, 0.9),
          year: figure(wardBase, yearN, `${key}#year`, 0.3),
          hospital: figure(base, hospitalN, `${organism}|${s}|${antibiotic}#hospital`, 0.15),
        });
      }
      return { organism, specimen: s, cells, weight: recentN };
    })
    .filter((strip) => strip.weight > 0 || specimen !== "all")
    .sort((a, b) => b.weight - a.weight)
    .map(({ weight: _weight, ...strip }) => strip);
}

/** Organisms on a unit for one specimen, most common first (example shares). */
export function organismsFor(ward: WardCode, specimen: Specimen): { organism: Organism; n: number; share: number }[] {
  const strips = stripsFor(ward, specimen);
  const counts = strips.map((s) => ({ organism: s.organism, n: s.cells[0]?.recent.n ?? 0 }));
  const total = counts.reduce((sum, c) => sum + c.n, 0);
  return counts.map((c) => ({ ...c, share: total ? c.n / total : 0 }));
}

export interface MonthPoint {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  unit: Figure;
  hospital: Figure;
}

/** Twelve months of example history ending with the month of `asOf`. */
export function historyFor(ward: WardCode, organism: Organism, specimen: Specimen, antibiotic: AntibioticCode, asOf: string): MonthPoint[] {
  const cell = stripsFor(ward, specimen)
    .find((s) => s.organism === organism)
    ?.cells.find((c) => c.antibiotic === antibiotic);
  if (!cell) return [];
  const [y, m] = asOf.split("-").map(Number) as [number, number];
  const points: MonthPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    const month = date.toISOString().slice(0, 10);
    const key = `${ward}|${organism}|${specimen}|${antibiotic}|${month}`;
    const unitBase = i === 0 ? cell.recent.r : cell.year.r;
    const monthlyN = Math.max(1, Math.round(cell.year.n / 12));
    points.push({
      month,
      unit: figure(unitBase, i === 0 ? cell.recent.n : monthlyN, `${key}#u`, i === 0 ? 0 : 0.8),
      hospital: figure(cell.hospital.r, Math.round(cell.hospital.n / 12), `${key}#h`, 0.25),
    });
  }
  return points;
}
