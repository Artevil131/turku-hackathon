import type { AntibioticCode, IsoDate, Phenotype, Sex, Specimen } from "@aei/domain";

/** Bilingual text: the guide's Finnish wording and a plain English translation. */
export interface Text {
  fi: string;
  en: string;
}

export type Severity = "mild" | "severe";
export type Onset = "hospital" | "community" | "any";
export type Route = "po" | "iv" | "po/iv";

export type SyndromeId =
  | "cystitis-woman"
  | "cystitis-man"
  | "pyelonephritis"
  | "pyelonephritis-man"
  | "urinary-sepsis"
  | "sepsis-unknown-focus"
  | "sepsis-healthcare"
  | "wound-mild"
  | "wound-moderate"
  | "wound-severe";

/**
 * One drug the guide names. `drug` is the dataset's code when the drug is one
 * of its thirteen (so it can be matched to a coverage row), else null and the
 * text alone carries it. Doses live in the text only, never as numbers.
 */
export interface Choice {
  drug: AntibioticCode | null;
  text: Text;
  route: Route;
}

/** What the guide says to do for a known carrier of a resistant phenotype. */
export interface CarrierRule {
  action: "replace" | "add" | "consult";
  choices: Choice[];
  text: Text;
}

export interface Syndrome {
  id: SyndromeId;
  name: Text;
  specimen: Specimen;
  severity: Severity;
  onset: Onset;
  sex?: Sex;
  firstChoices: Choice[];
  allergyAlternative?: Choice[];
  carrierRules: Partial<Record<Phenotype, CarrierRule>>;
  duration?: Text;
  /** Section as the guide numbers it, and its page (the printed page number, which equals the PDF page). */
  source: { section: string; page: number };
}

export interface Guide {
  site: string;
  title: string;
  date: IsoDate;
  url: string;
  syndromes: Syndrome[];
}
