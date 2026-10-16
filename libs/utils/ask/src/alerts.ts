import type { Alert, DetectorAlert } from "@aei/alerts";
import type { AntibioticCode, Organism, Phenotype, Specimen, WardCode } from "@aei/domain";
import type { ExplainInput } from "./explain.ts";

type Lang = "en" | "fi";

export interface AlertNames {
  ward(code: WardCode): string;
  phenotype(p: Phenotype): string;
  organism(o: Organism): string;
  specimen(s: Specimen): string;
  antibiotic?(code: AntibioticCode): string;
}

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);
const pick = (lang: Lang, en: string, fi: string) => (lang === "fi" ? fi : en);

/** What the detectors mean, for the prompt and the fallback (D-020). */
const DETECTORS: Record<string, { summary: string; en: string; fi: string }> = {
  "profile-excess": {
    summary:
      "More patients than expected in this unit within 28 days share one organism with the same resistance profile, judged against the profile's usual share. This can mean a cluster.",
    en: "On {date}, {observed} patients in {ward} shared one resistance profile of {organism} within 28 days, where about {expected} were expected.",
    fi: "{date}: osastolla {ward} {observed} potilaalla oli sama {organism}-resistenssiprofiili 28 päivän sisällä, kun odotettu määrä oli noin {expected}.",
  },
  "phenotype-excess": {
    summary: "More patients than expected in this unit had a resistant phenotype within 28 days.",
    en: "On {date}, {observed} patients in {ward} had {phenotype} within 28 days, where about {expected} were expected.",
    fi: "{date}: osastolla {ward} {observed} potilaalla todettiin {phenotype} 28 päivän sisällä, kun odotettu määrä oli noin {expected}.",
  },
  "sampling-drop": {
    summary:
      "Far fewer cultures than usual came from this unit in the last 7 days. That is a data gap rather than an infection, and resistance figures for the unit may be missing.",
    en: "On {date}, only {observed} cultures came from {ward} in 7 days, where about {expected} are usual.",
    fi: "{date}: osastolta {ward} tuli vain {observed} viljelyä 7 päivässä, kun tavallisesti niitä tulee noin {expected}.",
  },
  "rising-trend": {
    summary:
      "Resistance of an organism to an antibiotic has been rising across the hospital; observed is the latest 28-day resistant share.",
    en: "As of {date}, resistance of {organism} to {antibiotic} has been rising in {ward}; the latest resistant share is {observed}.",
    fi: "{date} alkaen {organism}-bakteerin resistenssi antibiootille {antibiotic} on kasvanut ({ward}); viimeisin resistenttien osuus on {observed}.",
  },
};

function detector(alert: DetectorAlert, lang: Lang, names: AlertNames): ExplainInput {
  const known = DETECTORS[alert.detector];
  const trend = alert.detector === "rising-trend";
  const facts: Record<string, string | number> = {
    date: alert.date,
    ward: alert.ward ? names.ward(alert.ward) : pick(lang, "the whole hospital", "koko sairaala"),
    // A trend's observed value is a proportion; show it as a percentage string.
    observed: trend ? `${Math.round(alert.observed * 100)} %` : alert.observed,
  };
  if (alert.expected !== undefined) facts.expected = Math.round(alert.expected * 10) / 10;
  if (alert.p !== undefined) facts.p = alert.p < 0.001 ? "< 0.001" : alert.p.toFixed(3);
  if (alert.organism) facts.organism = names.organism(alert.organism);
  if (alert.phenotype) facts.phenotype = names.phenotype(alert.phenotype);
  if (alert.antibiotic) facts.antibiotic = names.antibiotic?.(alert.antibiotic) ?? alert.antibiotic;
  return {
    lang,
    kind: `detector:${alert.detector}`,
    summary: known?.summary ?? `A statistical detector (${alert.detector}) flagged this unit.`,
    facts,
    // A template naming a fact this alert lacks would show a raw {slot}.
    fallback: known && slots(known[lang]).every((k) => k in facts) ? known[lang] : generic(lang, facts),
  };
}

const slots = (template: string) => [...template.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1] ?? "");

/** A plain fallback naming every fact, for alert kinds without their own wording. */
function generic(lang: Lang, facts: Record<string, string | number>): string {
  const list = Object.keys(facts)
    .map((k) => `${k}: {${k}}`)
    .join(", ");
  return pick(lang, `Alert. ${list}.`, `Hälytys. ${list}.`);
}

/**
 * Turns an alert into the input of `explainAlert`: its facts (every number,
 * date and identifier the text may mention, filled in by code) and a
 * template used when the model's text fails the check (D-019). Alert kinds
 * this function does not know yet get their scalar fields as facts and a
 * generic template, so a new kind never breaks the Explain action.
 */
export function alertExplainInput(alert: Alert, lang: Lang, names: AlertNames): ExplainInput {
  switch (alert.kind) {
    case "cpe":
      return {
        lang,
        kind: alert.kind,
        summary: "A carbapenemase-producing Enterobacterales isolate triggers an infection-control alert.",
        facts: {
          date: alert.date,
          ward: names.ward(alert.ward),
          organism: names.organism(alert.organism),
          specimen: names.specimen(alert.specimen),
          patientId: alert.patientId,
        },
        fallback: pick(
          lang,
          "On {date}, a carbapenemase-producing Enterobacterales isolate ({organism}) was found in a {specimen} sample from patient {patientId} in {ward}; an infection-control alert.",
          "{date}: osastolla {ward} potilaan {patientId} näytteestä ({specimen}) löytyi karbapenemaasia tuottava enterobakteeri ({organism}); infektioidentorjuntahälytys.",
        ),
      };
    case "new-in-unit": {
      const facts: Record<string, string | number> = {
        date: alert.date,
        ward: names.ward(alert.ward),
        phenotype: names.phenotype(alert.phenotype),
        organism: names.organism(alert.organism),
        patientId: alert.patientId,
      };
      if (alert.previous) {
        facts.previous = alert.previous;
        facts.daysSincePrevious = days(alert.previous, alert.date);
      }
      return {
        lang,
        kind: alert.kind,
        summary:
          "The first MRSA or VRE isolate in this unit after a long time without one (180 days or more, D-021). A sentinel finding for infection control.",
        facts,
        fallback: alert.previous
          ? pick(
              lang,
              "On {date}, {phenotype} ({organism}) was found in patient {patientId} in {ward}, the unit's first since {previous}, {daysSincePrevious} days earlier.",
              "{date}: osastolla {ward} potilaalta {patientId} löytyi {phenotype} ({organism}), osaston ensimmäinen sitten {previous}, {daysSincePrevious} päivää aiemmin.",
            )
          : pick(
              lang,
              "On {date}, {phenotype} ({organism}) was found in patient {patientId} in {ward}, the first in this unit in the data.",
              "{date}: osastolla {ward} potilaalta {patientId} löytyi {phenotype} ({organism}), osaston ensimmäinen aineistossa.",
            ),
      };
    }
    case "detector":
      return detector(alert, lang, names);
    case "carrier":
      return {
        lang,
        kind: alert.kind,
        summary: "A patient known to carry the phenotype in another unit within 90 days has been sampled here (D-012).",
        facts: {
          date: alert.date,
          ward: names.ward(alert.ward),
          fromWard: names.ward(alert.from),
          phenotype: names.phenotype(alert.phenotype),
          foundOn: alert.foundOn,
          daysSinceFound: days(alert.foundOn, alert.date),
          confirmed: alert.confirmed ? pick(lang, "yes", "kyllä") : pick(lang, "no", "ei"),
        },
        fallback: pick(
          lang,
          "On {date}, a patient with {phenotype} found in {fromWard} on {foundOn}, {daysSinceFound} days earlier, was sampled in {ward}. Carriage confirmed in this sample: {confirmed}.",
          "{date}: osastolla {ward} otettiin näyte potilaalta, jonka {phenotype}-kantajuus todettiin osastolla {fromWard} päivänä {foundOn}, {daysSinceFound} päivää aiemmin. Kantajuus vahvistettu tässä näytteessä: {confirmed}.",
        ),
      };
    default: {
      const unknown = alert as unknown as Record<string, unknown> & { kind: string };
      const facts = Object.fromEntries(
        Object.entries(unknown).filter(
          (e): e is [string, string | number] => e[0] !== "kind" && e[0] !== "id" && (typeof e[1] === "string" || typeof e[1] === "number"),
        ),
      );
      return {
        lang,
        kind: unknown.kind,
        summary: `An infection-control alert of kind ${unknown.kind}.`,
        facts,
        fallback: generic(lang, facts),
      };
    }
  }
}
