import type { AwareGroup } from "./types.ts";

// Source: WHO AWaRe classification 2023 ("WHO Access, Watch, Reserve (AWaRe)
// classification of antibiotics for evaluation and monitoring of use, 2023",
// WHO/MHP/HPS/EML/2023.04). A public classification, not hospital data:
//   access   first or second choice for common infections, lower resistance potential
//   watch    higher resistance potential; use with care
//   reserve  last resort for multidrug-resistant infections
// Only antibiotics whose group is certain and does not depend on the route are
// listed (fosfomycin, minocycline and others that differ by route are left
// out). An antibiotic not found here gets no group, and the app shows no badge.

const ACCESS = [
  "amikacin",
  "amoxicillin",
  "amoxicillin/clavulanic acid",
  "amoxicillin/clavulanate",
  "co-amoxiclav",
  "ampicillin",
  "benzathine benzylpenicillin",
  "benzylpenicillin",
  "penicillin g",
  "procaine benzylpenicillin",
  "phenoxymethylpenicillin",
  "penicillin v",
  "cloxacillin",
  "dicloxacillin",
  "flucloxacillin",
  "oxacillin",
  "nafcillin",
  "mecillinam",
  "pivmecillinam",
  "cefalexin",
  "cephalexin",
  "cefadroxil",
  "cefazolin",
  "chloramphenicol",
  "clindamycin",
  "doxycycline",
  "tetracycline",
  "gentamicin",
  "metronidazole",
  "nitrofurantoin",
  "spectinomycin",
  "trimethoprim",
  "sulfamethoxazole/trimethoprim",
  "trimethoprim/sulfamethoxazole",
  "co-trimoxazole",
];

const WATCH = [
  "azithromycin",
  "clarithromycin",
  "erythromycin",
  "cefaclor",
  "cefuroxime",
  "cefoxitin",
  "cefixime",
  "cefpodoxime",
  "cefotaxime",
  "ceftriaxone",
  "ceftazidime",
  "cefepime",
  "piperacillin/tazobactam",
  "meropenem",
  "imipenem",
  "imipenem/cilastatin",
  "ertapenem",
  "ciprofloxacin",
  "levofloxacin",
  "moxifloxacin",
  "norfloxacin",
  "ofloxacin",
  "vancomycin",
  "teicoplanin",
  "fusidic acid",
];

const RESERVE = [
  "aztreonam",
  "cefiderocol",
  "ceftaroline",
  "ceftaroline fosamil",
  "ceftobiprole",
  "ceftobiprole medocaril",
  "ceftazidime/avibactam",
  "ceftolozane/tazobactam",
  "meropenem/vaborbactam",
  "imipenem/cilastatin/relebactam",
  "imipenem/relebactam",
  "colistin",
  "polymyxin b",
  "daptomycin",
  "linezolid",
  "tedizolid",
  "dalbavancin",
  "oritavancin",
  "telavancin",
  "tigecycline",
  "eravacycline",
  "omadacycline",
  "plazomicin",
  "lefamulin",
  "faropenem",
];

// WHONET antibiotic codes of the same drugs, used when the lab's name is not recognised.
const CODES: Record<string, AwareGroup> = {
  AMK: "access",
  AMX: "access",
  AMC: "access",
  AMP: "access",
  PEN: "access",
  OXA: "access",
  MEC: "access",
  CZO: "access",
  CLI: "access",
  CHL: "access",
  DOX: "access",
  TCY: "access",
  GEN: "access",
  MTR: "access",
  NIT: "access",
  TMP: "access",
  SXT: "access",
  AZM: "watch",
  CLR: "watch",
  ERY: "watch",
  CXM: "watch",
  FOX: "watch",
  CTX: "watch",
  CRO: "watch",
  CAZ: "watch",
  FEP: "watch",
  TZP: "watch",
  MEM: "watch",
  IPM: "watch",
  ETP: "watch",
  CIP: "watch",
  LVX: "watch",
  MFX: "watch",
  VAN: "watch",
  TEC: "watch",
  ATM: "reserve",
  CZA: "reserve",
  CZT: "reserve",
  COL: "reserve",
  DAP: "reserve",
  LNZ: "reserve",
  TGC: "reserve",
};

/** Lower case, parenthesised notes dropped ("cefoxitin (screen)"), combination separators unified ("a-b", "a + b" -> "a/b"). */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*(?:\/|\+|-|–|\band\b|\bwith\b)\s*/g, "/")
    .replace(/\s+/g, " ")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

const NAMES = new Map<string, AwareGroup>();
for (const [group, names] of [
  ["access", ACCESS],
  ["watch", WATCH],
  ["reserve", RESERVE],
] as const) {
  for (const name of names) NAMES.set(normalise(name), group);
}

/** WHO AWaRe group of an antibiotic, by English name, else by WHONET code; null when not classified here. */
export function awareOf(antibiotic: { code: string; en: string }): AwareGroup | null {
  return NAMES.get(normalise(antibiotic.en)) ?? CODES[antibiotic.code.trim().toUpperCase()] ?? null;
}
