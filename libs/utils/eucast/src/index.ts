import { ANTIBIOTICS, type AntibioticCode, type IsolateRecord, type Organism, type Phenotype, type Specimen, type SR } from "@aei/domain";

// Microbiology facts for the dataset's 9 organisms and 13 antibiotics:
// which pairs are resistant by nature, which have no clinical breakpoint,
// which results EUCAST lets the laboratory infer from another, and which
// antibiotics suit which specimen. Facts only; how a coverage estimate
// treats them is a separate, statistical choice.
//
// Sources: EUCAST Expected Resistant Phenotypes v1.2 (2023), the dataset's
// stated basis; EUCAST Expert Rules v3.2; EUCAST clinical breakpoint
// tables. Entries marked `check` rest on our reading and await review by
// the team's clinical side.

export interface Rule {
  organism: Organism;
  antibiotic: AntibioticCode;
  note: string;
  check?: true;
}

const ENTEROBACTERALES: Organism[] = [
  "Escherichia coli",
  "Klebsiella pneumoniae",
  "Klebsiella oxytoca",
  "Citrobacter freundii",
  "Proteus mirabilis",
];
const STAPHYLOCOCCI: Organism[] = ["Staphylococcus aureus", "Staphylococcus saprophyticus"];

const each = (organisms: Organism[], antibiotics: AntibioticCode[], note: string, check?: true): Rule[] =>
  organisms.flatMap((organism) => antibiotics.map((antibiotic) => ({ organism, antibiotic, note, ...(check ? { check } : {}) })));

/** Resistant by nature (expected resistant phenotype): R whether tested or not. */
export const INTRINSIC: readonly Rule[] = [
  ...each(ENTEROBACTERALES, ["VAN", "CLI"], "Gram-negative bacteria: glycopeptides and lincosamides"),
  ...each(["Klebsiella pneumoniae", "Klebsiella oxytoca"], ["AMP"], "Klebsiella spp.: ampicillin"),
  ...each(["Citrobacter freundii"], ["AMP"], "Citrobacter freundii: ampicillin"),
  ...each(["Proteus mirabilis"], ["NIT"], "Proteus mirabilis: nitrofurantoin"),
  ...each(["Pseudomonas aeruginosa"], ["AMP", "CRO", "TMP"], "Pseudomonas aeruginosa: ampicillin, ceftriaxone, trimethoprim"),
  ...each(["Pseudomonas aeruginosa"], ["CXM"], "Pseudomonas aeruginosa: cefuroxime", true),
  ...each(["Pseudomonas aeruginosa"], ["VAN", "CLI"], "Gram-negative bacteria: glycopeptides and lincosamides"),
  ...each(["Enterococcus faecalis"], ["CXM", "CRO", "CAZ"], "Enterococcus spp.: cephalosporins"),
  ...each(["Enterococcus faecalis"], ["CLI"], "Enterococcus faecalis: lincosamides"),
];

/** No clinical breakpoint: not a treatment option for this organism, so no result is ever given. */
export const NO_BREAKPOINT: readonly Rule[] = [
  ...each(["Pseudomonas aeruginosa", "Enterococcus faecalis", ...STAPHYLOCOCCI], ["MEC"], "mecillinam is for Enterobacterales only"),
  ...each(["Pseudomonas aeruginosa"], ["NIT"], "no nitrofurantoin breakpoint for Pseudomonas", true),
  ...each(STAPHYLOCOCCI, ["CAZ"], "no ceftazidime breakpoint for staphylococci"),
  ...each(["Enterococcus faecalis"], ["MEM"], "no meropenem breakpoint for enterococci"),
  ...each(["Enterococcus faecalis"], ["TMP"], "trimethoprim not reliable against enterococci in vivo", true),
];

/** Antibiotics reported only as screening tests, never as a treatment choice. */
export const SCREEN_ONLY: readonly AntibioticCode[] = ["FOX"];

const key = (o: Organism, a: AntibioticCode) => `${o}|${a}`;
const intrinsic = new Map(INTRINSIC.map((r) => [key(r.organism, r.antibiotic), r]));
const noBreakpoint = new Map(NO_BREAKPOINT.map((r) => [key(r.organism, r.antibiotic), r]));

export function isIntrinsic(organism: Organism, antibiotic: AntibioticCode): boolean {
  return intrinsic.has(key(organism, antibiotic));
}

export function hasNoBreakpoint(organism: Organism, antibiotic: AntibioticCode): boolean {
  return noBreakpoint.has(key(organism, antibiotic));
}

/** Urine-only antibiotics (mecillinam, trimethoprim, nitrofurantoin) suit urine only; screens suit nothing. */
export function suitsSpecimen(antibiotic: AntibioticCode, specimen: Specimen): boolean {
  if (SCREEN_ONLY.includes(antibiotic)) return false;
  const ab = ANTIBIOTICS.find((a) => a.code === antibiotic);
  return !!ab && (ab.reportedFor === "all" || ab.reportedFor === specimen);
}

const STAPH_BETA_LACTAMS: AntibioticCode[] = ["TZP", "CXM", "CRO", "MEM"];

/**
 * A result EUCAST Expert Rules let the laboratory infer from another
 * result of the same isolate, or undefined.
 * - Staphylococci: beta-lactams follow the cefoxitin screen. Cefoxitin R
 *   (MRSA) means R to every beta-lactam here; cefoxitin S means S to
 *   piperacillin-tazobactam, cefuroxime, ceftriaxone and meropenem.
 *   Ampicillin is not inferred from S (penicillinase is tested separately).
 * - Enterococcus faecalis: piperacillin-tazobactam follows ampicillin.
 */
export function inferredResult(record: Pick<IsolateRecord, "organism" | "results">, antibiotic: AntibioticCode): SR | undefined {
  const { organism, results } = record;
  if (STAPHYLOCOCCI.includes(organism)) {
    const fox = results.FOX;
    if (fox === "R" && [...STAPH_BETA_LACTAMS, "AMP", "MEC", "CAZ"].includes(antibiotic)) return "R";
    if (fox === "S" && STAPH_BETA_LACTAMS.includes(antibiotic)) return "S";
  }
  if (organism === "Enterococcus faecalis" && antibiotic === "TZP") return results.AMP;
  return undefined;
}

export type Basis = "tested" | "intrinsic" | "inferred" | "no-breakpoint" | "untested";

export interface Effective {
  /** S or R when known; null when no breakpoint applies or nothing was tested. */
  result: SR | null;
  basis: Basis;
}

/**
 * The result to use for one isolate and antibiotic, with where it comes
 * from: the intrinsic rules first, then the laboratory's own result, then
 * inference. Coverage code decides how `no-breakpoint` and `untested` count.
 */
export function effectiveResult(record: Pick<IsolateRecord, "organism" | "results">, antibiotic: AntibioticCode): Effective {
  // An S reported for an intrinsic pair is a laboratory error (EUCAST), so the rule wins.
  if (isIntrinsic(record.organism, antibiotic)) return { result: "R", basis: "intrinsic" };
  const tested = record.results[antibiotic];
  if (tested) return { result: tested, basis: "tested" };
  const inferred = inferredResult(record, antibiotic);
  if (inferred) return { result: inferred, basis: "inferred" };
  if (hasNoBreakpoint(record.organism, antibiotic)) return { result: null, basis: "no-breakpoint" };
  return { result: null, basis: "untested" };
}

/**
 * The isolate a resistant phenotype implies, as the inference rules read it:
 * MRSA is a Staphylococcus aureus with cefoxitin R. ESBL, VRE and CPE have no
 * rule here that infers another result, so they imply nothing.
 */
const PHENOTYPE_MARKERS: Partial<Record<Phenotype, Pick<IsolateRecord, "organism" | "results">>> = {
  mrsa: { organism: "Staphylococcus aureus", results: { FOX: "R" } },
};

/**
 * Antibiotics `effectiveResult` infers resistant (basis "inferred") from a
 * phenotype, in the dataset's order: for MRSA the beta-lactams the cefoxitin
 * screen decides; empty for phenotypes the rules infer nothing from (D-050).
 */
export function inferredResistantFrom(phenotype: Phenotype): AntibioticCode[] {
  const marker = PHENOTYPE_MARKERS[phenotype];
  if (!marker) return [];
  return ANTIBIOTICS.map((a) => a.code).filter((code) => {
    const e = effectiveResult(marker, code);
    return e.basis === "inferred" && e.result === "R";
  });
}

/**
 * Antibiotics a phenotype defeats, for annotating the doctor's list (D-050,
 * D-052): what `effectiveResult` infers, plus EUCAST's expected resistant
 * phenotypes the rules do not model. ESBL defeats aminopenicillins and the
 * cephalosporins (mecillinam keeps activity against many ESBL E. coli, which
 * is why the Varha guide names pivmecillinam for ESBL cystitis); VRE defeats
 * vancomycin; CPE defeats the beta-lactams and the carbapenem.
 */
export const PHENOTYPE_DEFEATS: Record<Phenotype, readonly AntibioticCode[]> = {
  esbl: ["AMP", "CXM", "CRO", "CAZ"],
  mrsa: [],
  vre: ["VAN"],
  cpe: ["AMP", "TZP", "CXM", "CRO", "CAZ", "MEM"],
};

/** `inferredResistantFrom` and `PHENOTYPE_DEFEATS` together, in the dataset's antibiotic order. */
export function defeatedBy(phenotype: Phenotype): AntibioticCode[] {
  const set = new Set<AntibioticCode>([...inferredResistantFrom(phenotype), ...PHENOTYPE_DEFEATS[phenotype]]);
  return ANTIBIOTICS.map((a) => a.code).filter((code) => set.has(code));
}
