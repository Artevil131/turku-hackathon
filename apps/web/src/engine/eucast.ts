import type { Antibiotic } from "../feed/types.ts";

// Expected resistance ("intrinsic resistance"): organism and antibiotic pairs
// where practically every isolate is resistant, so labs usually do not test
// or report them. A public classification, not hospital data.
//
// Source: EUCAST Expected Resistant Phenotypes, version 1.2, 13 January 2023
// (https://www.eucast.org/fileadmin/eucast/pdf/expert_rules/Expected_Resistant_Phenotypes_v1.2_20230113.pdf),
// Tables 1 (Enterobacterales and Aeromonas), 2 (non-fermenters: rows 2.1
// Acinetobacter, 2.7 Pseudomonas aeruginosa, 2.8 Stenotrophomonas) and 4
// (gram-positive bacteria), with each table's "also expected to be resistant
// to" sentence. EUCAST: "Testing should normally be avoided, and laboratories
// are expected to either not report a result at all, or ... report the
// isolate as resistant".
//
// Only rows read from the table are listed; everything else answers false
// (unknown organism, unknown antibiotic, or a pair the table does not mark).
// Organisms are matched on their Latin name (genus, species), antibiotics on
// their English name and, for whole drug groups, on the class the lab gives.

type AntibioticLike = Pick<Antibiotic, "code" | "en" | "class">;

// ---------- Antibiotics: the table's columns ----------

interface Drug {
  /** English name, lower case, brackets removed, combinations joined with "-" (e.g. "piperacillin-tazobactam"). */
  name: string;
  /** Class as the lab writes it, lower case. */
  cls: string;
}

type Agent = (d: Drug) => boolean;

const named =
  (...names: string[]): Agent =>
  (d) =>
    names.includes(d.name);
const either =
  (...agents: Agent[]): Agent =>
  (d) =>
    agents.some((a) => a(d));
const classIs =
  (re: RegExp): Agent =>
  (d) =>
    re.test(d.cls);

const AMPICILLIN = named("ampicillin", "amoxicillin", "amoxycillin");
const AMOXICILLIN_CLAVULANATE = named(
  "amoxicillin-clavulanic acid",
  "amoxicillin-clavulanate",
  "amoxycillin-clavulanic acid",
  "co-amoxiclav",
);
const AMPICILLIN_SULBACTAM = named("ampicillin-sulbactam");
const BENZYLPENICILLIN = named("benzylpenicillin", "penicillin g", "penicillin");
const TICARCILLIN = named("ticarcillin");
const PIPERACILLIN = named("piperacillin");
const PIPERACILLIN_TAZOBACTAM = named("piperacillin-tazobactam");
const TEMOCILLIN = named("temocillin");
const CEPHALOSPORIN_1 = either(
  named("cefazolin", "cefalotin", "cephalothin", "cefalexin", "cephalexin", "cefadroxil", "cefradine", "cephradine"),
  (d) => /cephalosporin/.test(d.cls) && /\b(1st|first)\b/.test(d.cls),
);
const CEFOXITIN = named("cefoxitin");
const CEFUROXIME = named("cefuroxime");
const CEPHALOSPORIN_2 = either(
  named("cefuroxime", "cefoxitin", "cefaclor", "cefamandole", "cefotetan", "cefprozil"),
  (d) => /cephalosporin/.test(d.cls) && /\b(2nd|second)\b/.test(d.cls),
);
const CEFOTAXIME_CEFTRIAXONE = named("cefotaxime", "ceftriaxone");
const CEFTAZIDIME = named("ceftazidime");
const CEPHALOSPORIN = either((d) => /^ce(f|ph)/.test(d.name), classIs(/cephalosporin|cephem/));
const AZTREONAM = named("aztreonam");
const ERTAPENEM = named("ertapenem");
const IMIPENEM = named("imipenem");
const MEROPENEM = named("meropenem");
const NALIDIXIC_ACID = named("nalidixic acid");
const CHLORAMPHENICOL = named("chloramphenicol");
const AMINOGLYCOSIDE = either(
  named("gentamicin", "tobramycin", "amikacin", "netilmicin", "kanamycin", "neomycin", "streptomycin", "plazomicin"),
  classIs(/aminoglycoside/),
);
const KANAMYCIN_NEOMYCIN = named("kanamycin", "neomycin");
/** Trimethoprim alone (not with sulfamethoxazole). */
const TRIMETHOPRIM = named("trimethoprim");
/** A sulfonamide alone (not with trimethoprim). */
const SULFONAMIDE = named("sulfamethoxazole", "sulfisoxazole", "sulfadiazine", "sulfonamide", "sulfonamides");
const FOSFOMYCIN = named("fosfomycin");
const GLYCYLCYCLINE = named("tigecycline", "eravacycline", "omadacycline");
const TETRACYCLINES: Agent = (d) =>
  !GLYCYLCYCLINE(d) &&
  (named("tetracycline", "doxycycline", "minocycline", "oxytetracycline", "lymecycline")(d) || /tetracycline/.test(d.cls));
const TIGECYCLINE = named("tigecycline");
const POLYMYXIN = either(named("colistin", "polymyxin b", "colistimethate"), classIs(/polymyxin/));
const NITROFURANTOIN = named("nitrofurantoin");
const VANCOMYCIN = named("vancomycin");
const TEICOPLANIN = named("teicoplanin");
const GLYCOPEPTIDE = either(named("vancomycin", "teicoplanin"), classIs(/glycopeptide/));
const LIPOGLYCOPEPTIDE = named("dalbavancin", "oritavancin", "telavancin");
const FUSIDIC_ACID = named("fusidic acid", "sodium fusidate", "fusidate");
const MACROLIDE = either(
  named("erythromycin", "azithromycin", "clarithromycin", "roxithromycin", "spiramycin"),
  classIs(/macrolide/),
);
/** Table 1 footnote 1: azithromycin and erythromycin have uses against some Enterobacterales, so they are left out. */
const MACROLIDE_ENTEROBACTERALES: Agent = (d) => MACROLIDE(d) && !named("azithromycin", "erythromycin")(d);
const CLINDAMYCIN = named("clindamycin");
const LINCOSAMIDE = either(named("clindamycin", "lincomycin"), classIs(/lincosamide/));
const QUINUPRISTIN_DALFOPRISTIN = named("quinupristin-dalfopristin");
const STREPTOGRAMIN = either(named("quinupristin-dalfopristin", "pristinamycin"), classIs(/streptogramin/));
const RIFAMPICIN = named("rifampicin", "rifampin");
const OXAZOLIDINONE = either(named("linezolid", "tedizolid"), classIs(/oxazolidinone/));
const NOVOBIOCIN = named("novobiocin");

// ---------- Organisms: the table's rows ----------

interface Row {
  genus: string;
  /** Species names; empty = every species of the genus. */
  species: string[];
  resistant: Agent[];
}

/** Table 1 heading: every Enterobacterales and Aeromonas species. */
const ENTEROBACTERALES_ALL: Agent[] = [
  BENZYLPENICILLIN,
  GLYCOPEPTIDE,
  LIPOGLYCOPEPTIDE,
  FUSIDIC_ACID,
  MACROLIDE_ENTEROBACTERALES,
  LINCOSAMIDE,
  STREPTOGRAMIN,
  RIFAMPICIN,
  OXAZOLIDINONE,
];

/** Table 2 heading: every non-fermentative gram-negative species. */
const NON_FERMENTER_ALL: Agent[] = [
  BENZYLPENICILLIN,
  CEPHALOSPORIN_1,
  CEPHALOSPORIN_2,
  GLYCOPEPTIDE,
  LIPOGLYCOPEPTIDE,
  FUSIDIC_ACID,
  MACROLIDE,
  LINCOSAMIDE,
  STREPTOGRAMIN,
  RIFAMPICIN,
  OXAZOLIDINONE,
];

/** Table 4 heading: every gram-positive species. */
const GRAM_POSITIVE_ALL: Agent[] = [AZTREONAM, TEMOCILLIN, POLYMYXIN, NALIDIXIC_ACID];

const ENTEROBACTERALES_GENERA = [
  "escherichia",
  "klebsiella",
  "enterobacter",
  "citrobacter",
  "proteus",
  "morganella",
  "providencia",
  "serratia",
  "salmonella",
  "shigella",
  "hafnia",
  "raoultella",
  "yersinia",
  "pantoea",
  "cronobacter",
  "leclercia",
  "plesiomonas",
  "kluyvera",
  "edwardsiella",
  "aeromonas",
];

const AMPC_GROUP = [AMPICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN_SULBACTAM, CEPHALOSPORIN_1, CEFOXITIN];
const PROTEEAE = [AMPICILLIN, CEPHALOSPORIN_1, CEFUROXIME, TETRACYCLINES, POLYMYXIN, NITROFURANTOIN];
const PROVIDENCIA = [AMPICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN_SULBACTAM, CEPHALOSPORIN_1, TETRACYCLINES, POLYMYXIN, NITROFURANTOIN];

const ENTEROBACTERALES_ROWS: Row[] = [
  // 1.1 (with footnote 3)
  { genus: "citrobacter", species: ["koseri", "amalonaticus", "sedlakii", "farmeri", "rodentium"], resistant: [AMPICILLIN, TICARCILLIN] },
  // 1.2 (with footnote 4)
  { genus: "citrobacter", species: ["freundii", "braakii", "murliniae", "werkmanii", "youngae"], resistant: AMPC_GROUP },
  // 1.3 Enterobacter cloacae complex
  { genus: "enterobacter", species: ["cloacae", "hormaechei", "asburiae", "kobei", "ludwigii"], resistant: AMPC_GROUP },
  // 1.4
  { genus: "escherichia", species: ["hermannii"], resistant: [AMPICILLIN, TICARCILLIN] },
  // 1.5
  { genus: "hafnia", species: ["alvei"], resistant: [AMPICILLIN, AMOXICILLIN_CLAVULANATE, POLYMYXIN] },
  // 1.6 (formerly Enterobacter aerogenes)
  { genus: "klebsiella", species: ["aerogenes"], resistant: AMPC_GROUP },
  { genus: "enterobacter", species: ["aerogenes"], resistant: AMPC_GROUP },
  // 1.7 Klebsiella pneumoniae complex, 1.8
  { genus: "klebsiella", species: ["pneumoniae", "variicola", "quasipneumoniae", "oxytoca"], resistant: [AMPICILLIN, TICARCILLIN] },
  // 1.9
  { genus: "leclercia", species: ["adecarboxylata"], resistant: [FOSFOMYCIN] },
  // 1.10
  { genus: "morganella", species: ["morganii"], resistant: PROVIDENCIA },
  // 1.11
  { genus: "plesiomonas", species: ["shigelloides"], resistant: [AMPICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN_SULBACTAM] },
  // 1.12
  { genus: "proteus", species: ["mirabilis"], resistant: [TETRACYCLINES, POLYMYXIN, NITROFURANTOIN] },
  // 1.13, 1.14
  { genus: "proteus", species: ["penneri", "vulgaris"], resistant: PROTEEAE },
  // 1.15, 1.16
  { genus: "providencia", species: ["rettgeri", "stuartii"], resistant: PROVIDENCIA },
  // 1.17
  { genus: "raoultella", species: [], resistant: [AMPICILLIN, TICARCILLIN] },
  // 1.18
  {
    genus: "serratia",
    species: ["marcescens"],
    resistant: [AMPICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN_SULBACTAM, CEPHALOSPORIN_1, CEFOXITIN, CEFUROXIME, POLYMYXIN, NITROFURANTOIN],
  },
  // 1.19, 1.20
  {
    genus: "yersinia",
    species: ["enterocolitica"],
    resistant: [AMPICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN_SULBACTAM, TICARCILLIN, CEPHALOSPORIN_1, CEFOXITIN],
  },
  { genus: "yersinia", species: ["pseudotuberculosis"], resistant: [POLYMYXIN] },
  // 1.21 - 1.25
  { genus: "aeromonas", species: ["hydrophila", "caviae"], resistant: [AMPICILLIN, AMPICILLIN_SULBACTAM] },
  { genus: "aeromonas", species: ["veronii", "jandaei"], resistant: [AMPICILLIN, AMPICILLIN_SULBACTAM, TICARCILLIN] },
  { genus: "aeromonas", species: ["dhakensis"], resistant: [AMPICILLIN, AMPICILLIN_SULBACTAM, CEFOXITIN] },
];

const NON_FERMENTER_ROWS: Row[] = [
  // 2.1 (footnote 2: tetracycline and doxycycline, not minocycline or tigecycline)
  {
    genus: "acinetobacter",
    species: ["baumannii", "pittii", "nosocomialis"],
    resistant: [
      AMPICILLIN,
      AMOXICILLIN_CLAVULANATE,
      CEFOTAXIME_CEFTRIAXONE,
      AZTREONAM,
      ERTAPENEM,
      TRIMETHOPRIM,
      FOSFOMYCIN,
      named("tetracycline", "doxycycline"),
    ],
  },
  // 2.7 (footnote 5: kanamycin and neomycin only among aminoglycosides)
  {
    genus: "pseudomonas",
    species: ["aeruginosa"],
    resistant: [
      AMPICILLIN,
      AMOXICILLIN_CLAVULANATE,
      AMPICILLIN_SULBACTAM,
      CEFOTAXIME_CEFTRIAXONE,
      ERTAPENEM,
      CHLORAMPHENICOL,
      KANAMYCIN_NEOMYCIN,
      TRIMETHOPRIM,
      TETRACYCLINES,
      TIGECYCLINE,
    ],
  },
  // 2.8 (footnote 6: trimethoprim alone; footnote 7: tetracycline, not doxycycline/minocycline/tigecycline)
  {
    genus: "stenotrophomonas",
    species: ["maltophilia"],
    resistant: [
      AMPICILLIN,
      AMOXICILLIN_CLAVULANATE,
      AMPICILLIN_SULBACTAM,
      TICARCILLIN,
      PIPERACILLIN,
      PIPERACILLIN_TAZOBACTAM,
      CEFOTAXIME_CEFTRIAXONE,
      AZTREONAM,
      ERTAPENEM,
      IMIPENEM,
      MEROPENEM,
      AMINOGLYCOSIDE,
      TRIMETHOPRIM,
      FOSFOMYCIN,
      named("tetracycline"),
    ],
  },
];

const ENTEROCOCCUS = [FUSIDIC_ACID, CEFTAZIDIME, CEPHALOSPORIN, AMINOGLYCOSIDE, MACROLIDE, SULFONAMIDE];

const GRAM_POSITIVE_ROWS: Row[] = [
  // 4.1 - 4.4
  { genus: "staphylococcus", species: ["saprophyticus"], resistant: [FUSIDIC_ACID, CEFTAZIDIME, FOSFOMYCIN, NOVOBIOCIN] },
  { genus: "staphylococcus", species: ["cohnii", "xylosus"], resistant: [CEFTAZIDIME, NOVOBIOCIN] },
  { genus: "staphylococcus", species: ["capitis"], resistant: [CEFTAZIDIME, FOSFOMYCIN] },
  // 4.5 Other coagulase-negative staphylococci and S. aureus (every staphylococcus)
  { genus: "staphylococcus", species: [], resistant: [CEFTAZIDIME] },
  // 4.6 (aminoglycosides: low-level resistance, footnote 1)
  { genus: "streptococcus", species: [], resistant: [FUSIDIC_ACID, CEFTAZIDIME, AMINOGLYCOSIDE] },
  // 4.7, 4.8, 4.9 (aminoglycosides: low-level resistance, footnotes 1 and 2)
  { genus: "enterococcus", species: ["faecalis"], resistant: [...ENTEROCOCCUS, CLINDAMYCIN, QUINUPRISTIN_DALFOPRISTIN] },
  {
    genus: "enterococcus",
    species: ["gallinarum", "casseliflavus"],
    resistant: [...ENTEROCOCCUS, CLINDAMYCIN, QUINUPRISTIN_DALFOPRISTIN, VANCOMYCIN],
  },
  { genus: "enterococcus", species: ["faecium"], resistant: ENTEROCOCCUS },
  // 4.10 - 4.13
  { genus: "corynebacterium", species: [], resistant: [FOSFOMYCIN] },
  { genus: "listeria", species: ["monocytogenes"], resistant: [CEFTAZIDIME, CEPHALOSPORIN] },
  { genus: "leuconostoc", species: [], resistant: [VANCOMYCIN, TEICOPLANIN] },
  { genus: "pediococcus", species: [], resistant: [VANCOMYCIN, TEICOPLANIN] },
  { genus: "lactobacillus", species: ["casei", "rhamnosus"], resistant: [VANCOMYCIN, TEICOPLANIN] },
  { genus: "lacticaseibacillus", species: ["casei", "rhamnosus"], resistant: [VANCOMYCIN, TEICOPLANIN] },
];

const GRAM_POSITIVE_GENERA = new Set(GRAM_POSITIVE_ROWS.map((r) => r.genus));
const NON_FERMENTER_GENERA = new Set(NON_FERMENTER_ROWS.map((r) => r.genus));

/** Genus and species from a Latin organism name ("Escherichia coli ESBL" -> escherichia, coli). */
function parseOrganism(organism: string): { genus: string; species: string } {
  const words = organism
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let genus = words[0] ?? "";
  // "Coagulase-negative staphylococci", "beta-haemolytic streptococcus" and similar.
  for (const g of ["staphylococc", "streptococc", "enterococc"]) {
    if (!genus.startsWith(g) && words.some((w) => w.startsWith(g))) genus = `${g}us`;
  }
  return { genus, species: words[1] ?? "" };
}

const agentCache = new Map<string, Agent[]>();

/** Every agent the table marks expected resistant for this organism (empty when the organism is not in the table). */
function resistantAgents(organism: string): Agent[] {
  const cached = agentCache.get(organism);
  if (cached) return cached;
  const { genus, species } = parseOrganism(organism);
  const matches = (rows: Row[]) =>
    rows.filter((r) => r.genus === genus && (r.species.length === 0 || r.species.includes(species))).flatMap((r) => r.resistant);
  let agents: Agent[] = [];
  if (ENTEROBACTERALES_GENERA.includes(genus)) agents = [...ENTEROBACTERALES_ALL, ...matches(ENTEROBACTERALES_ROWS)];
  else if (NON_FERMENTER_GENERA.has(genus)) {
    const rows = matches(NON_FERMENTER_ROWS);
    // The heading applies to the non-fermenters of Table 2; only species with a row are known to be one.
    if (rows.length > 0) agents = [...NON_FERMENTER_ALL, ...rows];
  } else if (GRAM_POSITIVE_GENERA.has(genus)) agents = [...GRAM_POSITIVE_ALL, ...matches(GRAM_POSITIVE_ROWS)];
  agentCache.set(organism, agents);
  return agents;
}

function drugOf(a: AntibioticLike): Drug {
  const name = a.en
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\s*(\/|\+|\band\b|\bwith\b)\s*/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return { name, cls: a.class.toLowerCase() };
}

/**
 * True when EUCAST lists this organism as expected resistant to this
 * antibiotic (see the source above). False for any pair the table does not
 * mark, and for screening tests (they are not treatments).
 */
export function isIntrinsicallyResistant(organism: string, antibiotic: AntibioticLike): boolean {
  if (/screen/i.test(antibiotic.class) || /screen/i.test(antibiotic.en)) return false;
  const agents = resistantAgents(organism);
  if (agents.length === 0) return false;
  const drug = drugOf(antibiotic);
  return agents.some((agent) => agent(drug));
}
