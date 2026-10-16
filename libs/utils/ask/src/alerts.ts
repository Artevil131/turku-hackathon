import type { Alert } from "@aei/alerts";
import type { Organism, Phenotype, Specimen, WardCode } from "@aei/domain";
import type { ExplainInput } from "./explain.ts";

export function alertExplainInput(
  alert: Alert,
  lang: "en" | "fi",
  names: {
    ward(code: WardCode): string;
    phenotype(p: Phenotype): string;
    organism(o: Organism): string;
    specimen(s: Specimen): string;
  },
): ExplainInput {
  if (alert.kind === "cpe") {
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
      fallback:
        lang === "fi"
          ? "{date}: osastolla {ward} potilaan {patientId} näytteestä ({specimen}) löytyi karbapenemaasia tuottava enterobakteeri ({organism}); infektioidentorjuntahälytys."
          : "On {date}, a carbapenemase-producing Enterobacterales isolate ({organism}) was found in a {specimen} sample from patient {patientId} in {ward}; an infection-control alert.",
    };
  }
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
      daysSinceFound: Math.round((Date.parse(alert.date) - Date.parse(alert.foundOn)) / 86_400_000),
      confirmed: lang === "fi" ? (alert.confirmed ? "kyllä" : "ei") : alert.confirmed ? "yes" : "no",
    },
    fallback:
      lang === "fi"
        ? "{date}: osastolla {ward} otettiin näyte potilaalta, jonka {phenotype}-kantajuus todettiin osastolla {fromWard} päivänä {foundOn}, {daysSinceFound} päivää aiemmin. Kantajuus vahvistettu tässä näytteessä: {confirmed}."
        : "On {date}, a patient with {phenotype} found in {fromWard} on {foundOn}, {daysSinceFound} days earlier, was sampled in {ward}. Carriage confirmed in this sample: {confirmed}.",
  };
}
