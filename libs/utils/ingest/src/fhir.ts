import type { Phenotype, Sex, Specimen, WardCode } from "@aei/domain";
import {
  type CodeMaps,
  type Coding,
  DEFAULT_CODE_MAPS,
  interpretation,
  isNoGrowth,
  isPositive,
  mapAntibiotic,
  mapOrganism,
  mapPhenotype,
  mapSpecimen,
  mapWard,
} from "./codes.ts";
import { addCulture, emptyResult, type IngestResult, type IsolateInput } from "./record.ts";

// HL7 FHIR R4 microbiology results (D-035), as a Bundle (collection,
// transaction or message) holding, per culture:
//   DiagnosticReport: identifier (culture id), subject, specimen, encounter, result[]
//   Patient: identifier, gender, birthDate
//   Specimen: type, collection.collectedDateTime
//   Encounter: location[].location (the ward), class, period.start (admission)
//   Observation, organism: valueCodeableConcept naming the organism;
//     hasMember: one Observation per antibiotic, directly or inside a susceptibility
//     panel (HL7 Europe Laboratory Report 2.1.0), code = the antibiotic (LOINC, THL
//     Mikrobilääkkeet 1.2.246.537.6.249, WHONET or a name), interpretation = S / I / R
//     (HL7 v3 ObservationInterpretation or THL Mikrobin herkkyys 1.2.246.537.6.253);
//     phenotype tests (ESBL, MRSA, VRE, CPE) as members or results with a positive value.
// References resolve by "Type/id" or by the entry's fullUrl.

type Json = Record<string, unknown>;
type CodeableConcept = { coding?: Coding[]; text?: string };

const codings = (cc: unknown): Coding[] => {
  const c = (cc ?? {}) as CodeableConcept;
  return [...(c.coding ?? []), ...(c.text ? [{ display: c.text }] : [])];
};
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const day = (v: unknown) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);

export interface FhirOptions {
  maps?: CodeMaps;
  guideline?: string;
}

export function parseFhirBundle(bundle: unknown, options: FhirOptions = {}): IngestResult {
  const maps = options.maps ?? DEFAULT_CODE_MAPS;
  const out = emptyResult();
  const b = bundle as Json;
  if (b?.resourceType !== "Bundle") throw new Error("not a FHIR Bundle");
  const byRef = new Map<string, Json>();
  for (const e of (b.entry as Json[] | undefined) ?? []) {
    const r = e.resource as Json | undefined;
    if (!r) continue;
    if (typeof e.fullUrl === "string") byRef.set(e.fullUrl, r);
    if (typeof r.id === "string") byRef.set(`${r.resourceType}/${r.id}`, r);
  }
  const resolve = (ref: unknown) => {
    const r = str((ref as Json | undefined)?.reference);
    return r ? byRef.get(r) : undefined;
  };
  // Members of an organism Observation, with susceptibility panels (LOINC 29576-6, as in HL7 Europe
  // Laboratory Report 2.1.0) opened up: an Observation with members of its own and no value is a panel.
  const members = (obs: Json, depth = 0): Json[] =>
    ((obs.hasMember as unknown[] | undefined) ?? [])
      .map(resolve)
      .filter((m): m is Json => !!m)
      .flatMap((m) =>
        depth < 3 && Array.isArray(m.hasMember) && !m.valueCodeableConcept && !m.valueQuantity && !m.interpretation
          ? members(m, depth + 1)
          : [m],
      );
  const reports = [...new Set(byRef.values())].filter((r) => r.resourceType === "DiagnosticReport");
  if (!reports.length) out.warnings.push("no DiagnosticReport in the bundle: no culture to read");

  for (const report of reports) {
    const identifier = ((report.identifier as Json[] | undefined) ?? [])[0];
    const specimenRes = resolve(((report.specimen as unknown[] | undefined) ?? [])[0]);
    const cultureId = str(identifier?.value) ?? str((specimenRes?.accessionIdentifier as Json | undefined)?.value) ?? str(report.id) ?? "";
    const patient = resolve(report.subject);
    const encounter = resolve(report.encounter);
    const patientId = str(((patient?.identifier as Json[] | undefined) ?? [])[0]?.value) ?? str(patient?.id) ?? "";
    const gender = str(patient?.gender);
    const sex: Sex | undefined = gender === "female" ? "F" : gender === "male" ? "M" : undefined;
    // FHIR allows a year alone ("1948"); only the year is used.
    const birth = /^\d{4}/.test(str(patient?.birthDate) ?? "") ? (str(patient?.birthDate) as string).slice(0, 4) : null;
    const specimen: Specimen | undefined = specimenRes ? mapSpecimen(maps, codings(specimenRes.type)) : undefined;
    const sampleDate = day((specimenRes?.collection as Json | undefined)?.collectedDateTime) ?? day(report.effectiveDateTime);
    const loc = ((encounter?.location as Json[] | undefined) ?? [])[0]?.location as Json | undefined;
    const locRes = resolve(loc);
    const wardCodings: Coding[] = [
      { code: str((loc?.identifier as Json | undefined)?.value), display: str(loc?.display) },
      { code: str(((locRes?.identifier as Json[] | undefined) ?? [])[0]?.value), display: str(locRes?.name) },
    ];
    const ward: WardCode | undefined = mapWard(maps, wardCodings);
    const admission = day((encounter?.period as Json | undefined)?.start);
    const label = cultureId || "(no id)";
    for (const [ok, what] of [
      [cultureId, "identifier"],
      [patientId, "patient identifier"],
      [sex, "patient gender female/male"],
      [birth, "patient birthDate"],
      [specimen, "specimen type that maps"],
      [sampleDate, "collection date"],
      [ward, "encounter location that maps to a unit"],
    ] as const) {
      if (!ok) out.warnings.push(`report ${label}: no ${what}`);
    }

    const isolates: (IsolateInput & { phenotypesSeen: Set<Phenotype> })[] = [];
    let noGrowth = false;
    let mixed = false;
    const reportPhenotypes = new Set<Phenotype>();
    for (const ref of (report.result as unknown[] | undefined) ?? []) {
      const obs = resolve(ref);
      if (!obs) {
        out.warnings.push(`report ${label}: result ${str((ref as Json).reference)} not in the bundle`);
        continue;
      }
      const organism = mapOrganism(maps, codings(obs.valueCodeableConcept));
      if (organism) {
        const iso = {
          organism,
          phenotypes: [] as Phenotype[],
          results: {} as IsolateInput["results"],
          phenotypesSeen: new Set<Phenotype>(),
        };
        for (const m of members(obs)) {
          const phenotype = mapPhenotype(maps, codings(m.code));
          if (phenotype) {
            if (
              isPositive(m.valueBoolean as boolean | undefined) ||
              isPositive(codings(m.valueCodeableConcept)[0]?.code) ||
              isPositive(codings(m.valueCodeableConcept)[0]?.display)
            )
              iso.phenotypesSeen.add(phenotype);
            continue;
          }
          const cc = codings(m.code);
          const antibiotic = mapAntibiotic(maps, [
            ...cc,
            ...cc.map((c) => ({ display: c.display?.split("[")[0]?.split(" by ")[0]?.trim() })),
          ]);
          const sr = interpretation(codings(((m.interpretation as unknown[] | undefined) ?? [])[0])[0]?.code);
          if (antibiotic && sr) iso.results[antibiotic] = sr;
          else out.warnings.push(`report ${label}: member "${cc[0]?.code ?? cc[0]?.display ?? "?"}" not understood`);
        }
        isolates.push(iso);
        continue;
      }
      const phenotype = mapPhenotype(maps, codings(obs.code));
      if (phenotype) {
        if (isPositive(obs.valueBoolean as boolean | undefined) || isPositive(codings(obs.valueCodeableConcept)[0]?.code))
          reportPhenotypes.add(phenotype);
        continue;
      }
      const value = codings(obs.valueCodeableConcept)[0];
      const text = `${value?.display ?? ""} ${value?.code ?? ""} ${str(obs.valueString) ?? ""}`;
      if (isNoGrowth(value?.display) || isNoGrowth(value?.code) || isNoGrowth(str(obs.valueString))) noGrowth = true;
      else if (/mixed|seka/i.test(text)) mixed = true;
      else out.warnings.push(`report ${label}: result "${codings(obs.code)[0]?.display ?? "?"}" not understood`);
    }
    // A phenotype reported on the report rather than on an isolate goes to the isolate it can belong to.
    for (const ph of reportPhenotypes) {
      const target = isolates.find((i) =>
        ph === "mrsa" ? i.organism === "Staphylococcus aureus" : ph === "vre" ? i.organism === "Enterococcus faecalis" : true,
      );
      target?.phenotypesSeen.add(ph);
    }
    if (!cultureId || !patientId || !sex || !birth || !specimen || !sampleDate || !ward) continue;
    addCulture(out, {
      cultureId,
      patientId,
      sex,
      birthYear: Number(birth.slice(0, 4)),
      sampleDate,
      ward,
      admissionDate: admission,
      specimen,
      mixedGrowth: mixed && !isolates.length,
      isolates:
        noGrowth && !isolates.length
          ? []
          : isolates.map((i) => ({ organism: i.organism, phenotypes: [...i.phenotypesSeen], results: i.results })),
      ...(options.guideline ? { guideline: options.guideline } : {}),
    });
  }
  return out;
}
