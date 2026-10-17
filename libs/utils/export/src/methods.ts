import { detectorMethodIds, fillSentence, type Locale, type MethodId, methods } from "@aei/methods";
import type { ExportBundle, ExportNumber } from "./bundle.ts";

/** Registry provenance is authoritative; a bundle cannot silently override decision ids. */
export function methodNumber(number: ExportNumber, methodId: MethodId): ExportNumber {
  return { ...number, methodId, decisions: [...methods[methodId].decisions] };
}

export function methodsNumbers(bundle: ExportBundle): ExportNumber[] {
  return bundle.numbers.map((number) =>
    number.methodId
      ? {
          ...methodNumber(number, number.methodId),
          definition: methods[number.methodId],
        }
      : number,
  );
}

export function toMethodsParagraph(bundle: ExportBundle, locale: Locale = bundle.locale ?? "en"): string {
  const fi = locale === "fi";
  const source = bundle.sourceNote ?? (fi ? "Lähdettä ei ilmoitettu" : "Data source not specified");
  const date = bundle.asOf ?? (fi ? "ei ilmoitettu" : "not specified");
  const parts = [
    fi ? `Aineisto: ${source}. Katkaisupäivä: ${date}.` : `Data source: ${source}. Data cut: ${date}.`,
    fi
      ? "Kattavuus käyttää ensimmäistä isolaattia potilasta, bakteerilajia ja näytetyyppiä kohti kyselyn aikavälillä; tunnistimet laskevat potilaita tai viljelyitä omien sääntöjensä mukaan (D-023, D-044; 0004). Vientirivien määrää ei deduplikoida ensiisolaateiksi."
      : "Coverage uses the first isolate per patient, species and specimen type within the query window; detectors count patients or cultures under their own rules (D-023, D-044; 0004). Export row counts are not first-isolate deduplicated.",
  ];
  const uses = bundle.numbers.flatMap((n) => (n.methodId ? [{ id: n.methodId, parameters: n.parameters ?? {} }] : []));
  for (const id of bundle.methodIds ?? []) if (!uses.some((u) => u.id === id)) uses.push({ id, parameters: {} });
  const dependencies: Partial<Record<MethodId, readonly MethodId[]>> = {
    liveSignals: Object.values(detectorMethodIds),
    suggest: ["coverage"],
    suggestCombinations: ["coverage", "suggest"],
  };
  for (const use of uses)
    for (const id of dependencies[use.id] ?? []) {
      if (!uses.some((u) => u.id === id)) uses.push({ id, parameters: {} });
    }
  const seen = new Set<string>();
  for (const use of uses) {
    const key = JSON.stringify(use);
    if (seen.has(key)) continue;
    seen.add(key);
    const method = methods[use.id];
    const values = Object.fromEntries(method.parameters.map((p) => [p.name, p.default]));
    Object.assign(values, use.parameters);
    const parameters = Object.entries(values)
      .map(([name, value]) => {
        const p = method.parameters.find((p) => p.name === name);
        return `${name}=${typeof value === "object" ? JSON.stringify(value) : value}${p?.unit ? ` ${p.unit}` : ""}${p ? ` (${p.decision})` : ""}`;
      })
      .join("; ");
    parts.push(
      `${method.name[locale]}: ${fillSentence(method, values, locale)}${parameters ? ` ${fi ? "Parametrit" : "Parameters"}: ${parameters}.` : ""} [${[...method.decisions, ...method.experiments].join(", ")}].`,
    );
  }
  for (const number of bundle.numbers.filter((n) => !n.methodId && n.method)) {
    parts.push(`${number.label}: ${number.method} (${fi ? "ei rekisteröityä menetelmätunnusta" : "no registered method id"}).`);
  }
  return parts.join(" ");
}
