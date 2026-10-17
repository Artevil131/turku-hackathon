// The hospital's empirical-treatment guide as data, per site (D-047).
// Configuration, not analysis: it marks the guide's first choice on the
// coverage list and never adds a drug to it or changes its order (D-026, D-027).

import type { AntibioticCode, Phenotype, Sex, Specimen } from "@aei/domain";
import type { CarrierRule, Guide, Onset, Severity, Syndrome } from "./types.ts";
import { VARHA } from "./varha.ts";

export type { CarrierRule, Choice, Guide, Onset, Route, Severity, Syndrome, SyndromeId, Text } from "./types.ts";

const GUIDES: Readonly<Record<string, Guide>> = { varha: VARHA };

/** The sites that have a guide encoded. */
export const SITES: readonly string[] = Object.keys(GUIDES);

/** The empirical-treatment guide of a site. Throws for a site without one. */
export function guide(site = "varha"): Guide {
  const g = GUIDES[site];
  if (!g) throw new Error(`No guideline encoded for site "${site}"`);
  return g;
}

/** How many of the syndrome's optional constraints are set: onset other than "any", and sex. */
function specificity(s: Syndrome): number {
  return (s.onset === "any" ? 0 : 1) + (s.sex ? 1 : 0);
}

/**
 * The syndromes for a specimen whose fields match the given ones, most
 * specific first (onset and sex set before those left open), the guide's
 * order otherwise. An omitted argument, or onset "any", matches every
 * syndrome; a syndrome with onset "any" or no sex matches every query.
 */
export function syndromesFor(specimen: Specimen, severity?: Severity, onset?: Onset, sex?: Sex, g: Guide = guide()): Syndrome[] {
  return g.syndromes
    .filter(
      (s) =>
        s.specimen === specimen &&
        (severity === undefined || s.severity === severity) &&
        (onset === undefined || onset === "any" || s.onset === "any" || s.onset === onset) &&
        (sex === undefined || s.sex === undefined || s.sex === sex),
    )
    .map((s, i) => ({ s, i }))
    .sort((a, b) => specificity(b.s) - specificity(a.s) || a.i - b.i)
    .map(({ s }) => s);
}

/** The first-choice drugs that are among the dataset's antibiotics, in the guide's order, each once. */
export function firstChoiceCodes(syndrome: Syndrome): AntibioticCode[] {
  const codes: AntibioticCode[] = [];
  for (const choice of syndrome.firstChoices) {
    if (choice.drug && !codes.includes(choice.drug)) codes.push(choice.drug);
  }
  return codes;
}

/** The guide's rule for a known carrier of the phenotype in this syndrome, if it gives one. */
export function carrierRule(syndrome: Syndrome, phenotype: Phenotype): CarrierRule | undefined {
  return syndrome.carrierRules[phenotype];
}

/** What choosing the syndrome sets on the record strip. */
export function syndromeDefaults(syndrome: Syndrome): { specimen: Specimen; severity: Severity; onset: Onset; sex: Sex | null } {
  return { specimen: syndrome.specimen, severity: syndrome.severity, onset: syndrome.onset, sex: syndrome.sex ?? null };
}
