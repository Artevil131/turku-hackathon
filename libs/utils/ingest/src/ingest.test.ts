import { ANTIBIOTICS, ORGANISMS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CODE_MAPS,
  detectFormat,
  extendCodeMaps,
  FINNISH_SYSTEMS,
  ingest,
  interpretation,
  isoWeek,
  parseFhirBundle,
  parseHl7Message,
  parseIsolateCsv,
} from "./index.ts";

// An ORU^R01 in the shape Finnish lab systems use for microbiology: a culture OBR with
// one organism OBX per isolate (OBX-4 = isolate number), and a child OBR per isolate
// carrying its susceptibilities (OBR-26 points at the organism's sub-id, OBR-29 at the parent).
const HL7 = [
  "MSH|^~\\&|MYPLUS|TYKSLAB|AEI|VARHA|20250605101500||ORU^R01^ORU_R01|MSG0001|P|2.5.1",
  "PID|1||PSEUDO-7731^^^VARHA^PI||||19480312|F",
  "PV1|1|I|URO^^^TYKS|||||||||||||||||||||||||||||||||||||||||20250529",
  "OBR|1|PL123|C2025-0042|4851^U -BaktVi^1.2.246.537.6.3|||20250604081500|||||||||||||||20250605100000||MB|F",
  "SPM|1|||UR^Urine^HL70487||||||||||||||20250604081500",
  "OBX|1|CWE|4851^U -BaktVi^1.2.246.537.6.3|1|7640-22^Escherichia coli^1.2.246.537.6.241||||||F",
  "OBX|2|CWE|ESBL^ESBL^L|1|POS^Positive^L||||||F",
  "OBR|2|PL123|C2025-0042-1|4851^U -BaktVi^1.2.246.537.6.3|||20250604081500||||G|||||||||||20250605100000||MB|F|4851&U -BaktVi&1.2.246.537.6.3^1^Escherichia coli|||PL123&C2025-0042",
  "OBX|1|SN|2^Ampisilliini^1.2.246.537.6.249|1|>^8|mg/L||R|||F",
  "OBX|2|SN|13^Kefuroksiimi^1.2.246.537.6.249|1|>^8|mg/L||R|||F",
  "OBX|3|SN|17^Mesillinaami^1.2.246.537.6.249|1|<=^2|mg/L||S|||F",
  "OBX|4|SN|21^Nitrofurantoiini^1.2.246.537.6.249|1|<=^16|mg/L||I|||F",
].join("\r");

describe("HL7 v2 ORU^R01", () => {
  it("reads a microbiology result with a child susceptibility OBR", () => {
    const r = parseHl7Message(HL7, { guideline: "EUCAST 2025" });
    expect(r.warnings).toEqual([]);
    expect(r.cultures).toEqual([
      expect.objectContaining({
        cultureId: "C2025-0042",
        patientId: "PSEUDO-7731",
        sampleDate: "2025-06-04",
        ward: "URO",
        wardType: "in",
        admissionDate: "2025-05-29",
        specimen: "urine",
        result: "positive",
        nIsolates: 1,
        ageYears: 77,
      }),
    ]);
    expect(r.isolates).toEqual([
      expect.objectContaining({ isolateId: "C2025-0042-1", organism: "Escherichia coli", phenotypes: ["esbl"] }),
    ]);
    expect(Object.fromEntries(r.susceptibility.map((s) => [s.antibiotic, s.result]))).toEqual({ AMP: "R", CXM: "R", MEC: "S", NIT: "S" });
    expect(r.patients).toEqual([{ patientId: "PSEUDO-7731", sex: "F", birthYear: 1948, homeArea: "" }]);
  });

  it("reports what it cannot map instead of guessing", () => {
    const r = parseHl7Message(HL7.replace("PV1|1|I|URO^", "PV1|1|I|KARDIO^"));
    expect(r.cultures).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/PV1-3 location "KARDIO" maps to no unit/);
  });

  it("reads THL's national codes without display text", () => {
    const bare = HL7.replace("7640-22^Escherichia coli^", "7640-22^^")
      .replace("13^Kefuroksiimi^", "12^^")
      .replace("17^Mesillinaami^", "MER^^");
    const r = parseHl7Message(bare);
    expect(r.warnings).toEqual([]);
    expect(r.isolates[0]?.organism).toBe("Escherichia coli");
    expect(r.susceptibility.map((s) => s.antibiotic)).toEqual(["AMP", "CRO", "MEM", "NIT"]);
  });

  it("maps a site's own codes through the configuration", () => {
    const maps = extendCodeMaps({ wards: { KARDIO: "MED-A" }, organisms: { [`${FINNISH_SYSTEMS.microbes}|E_COLI`]: "Escherichia coli" } });
    const r = parseHl7Message(
      HL7.replace("PV1|1|I|URO^", "PV1|1|I|KARDIO^").replace("7640-22^Escherichia coli^1.2", "E_COLI^?^urn:oid:1.2"),
      { maps },
    );
    expect(r.cultures[0]?.ward).toBe("MED-A");
    expect(r.isolates[0]?.organism).toBe("Escherichia coli");
  });

  it("reads 'no growth' as a negative culture", () => {
    const msg = HL7.split("\r").slice(0, 5).concat("OBX|1|CWE|4851^U -BaktVi^1.2.246.537.6.3|1|NEG^Ei kasvua^L||||||F").join("\r");
    const r = parseHl7Message(msg);
    expect(r.cultures[0]).toEqual(expect.objectContaining({ result: "negative", nIsolates: 0 }));
  });
});

const FHIR = {
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      fullUrl: "urn:uuid:pat",
      resource: { resourceType: "Patient", id: "pat", identifier: [{ value: "PSEUDO-9" }], gender: "male", birthDate: "1957-04-02" },
    },
    {
      fullUrl: "urn:uuid:enc",
      resource: {
        resourceType: "Encounter",
        id: "enc",
        class: { code: "IMP" },
        period: { start: "2026-03-01" },
        location: [{ location: { identifier: { value: "ICU" } } }],
      },
    },
    {
      fullUrl: "urn:uuid:spec",
      resource: {
        resourceType: "Specimen",
        id: "spec",
        type: { coding: [{ system: "http://snomed.info/sct", code: "119297000", display: "Blood specimen" }] },
        collection: { collectedDateTime: "2026-03-03T07:40:00+02:00" },
      },
    },
    {
      fullUrl: "urn:uuid:rep",
      resource: {
        resourceType: "DiagnosticReport",
        id: "rep",
        identifier: [{ value: "C2026-0777" }],
        status: "final",
        category: [{ coding: [{ code: "MB" }] }],
        subject: { reference: "urn:uuid:pat" },
        encounter: { reference: "urn:uuid:enc" },
        specimen: [{ reference: "urn:uuid:spec" }],
        result: [{ reference: "urn:uuid:org" }],
      },
    },
    {
      fullUrl: "urn:uuid:org",
      resource: {
        resourceType: "Observation",
        id: "org",
        code: { coding: [{ system: "http://loinc.org", code: "634-6" }] },
        valueCodeableConcept: { coding: [{ system: "http://snomed.info/sct", code: "3092008", display: "Staphylococcus aureus" }] },
        hasMember: [{ reference: "urn:uuid:panel" }, { reference: "urn:uuid:mrsa" }],
      },
    },
    {
      fullUrl: "urn:uuid:panel",
      resource: {
        resourceType: "Observation",
        id: "panel",
        code: { coding: [{ system: "http://loinc.org", code: "29576-6", display: "Bacterial susceptibility panel" }] },
        hasMember: [{ reference: "urn:uuid:fox" }, { reference: "urn:uuid:van" }],
      },
    },
    {
      fullUrl: "urn:uuid:fox",
      resource: {
        resourceType: "Observation",
        id: "fox",
        code: { text: "Cefoxitin screen" },
        interpretation: [{ coding: [{ code: "R" }] }],
      },
    },
    {
      fullUrl: "urn:uuid:van",
      resource: {
        resourceType: "Observation",
        id: "van",
        code: { coding: [{ code: "VAN", display: "Vancomycin" }] },
        interpretation: [{ coding: [{ code: "S" }] }],
      },
    },
    { fullUrl: "urn:uuid:mrsa", resource: { resourceType: "Observation", id: "mrsa", code: { text: "MRSA" }, valueBoolean: true } },
  ],
};

describe("FHIR R4 Bundle", () => {
  it("reads a report with a nested susceptibility panel and a phenotype", () => {
    const r = parseFhirBundle(FHIR);
    expect(r.warnings).toEqual([]);
    expect(r.cultures[0]).toEqual(
      expect.objectContaining({
        cultureId: "C2026-0777",
        ward: "ICU",
        specimen: "blood",
        sampleDate: "2026-03-03",
        admissionDate: "2026-03-01",
      }),
    );
    expect(r.isolates[0]).toEqual(expect.objectContaining({ organism: "Staphylococcus aureus", phenotypes: ["mrsa"] }));
    expect(Object.fromEntries(r.susceptibility.map((s) => [s.antibiotic, s.result]))).toEqual({ FOX: "R", VAN: "S" });
  });
});

describe("flat isolate export", () => {
  it("groups rows into cultures and reads antibiotic columns by WHONET code", () => {
    const csv = [
      "patient_id,sex,birth_year,specimen_number,spec_date,ward,spec_type,organism,esbl,AMP_ND10,CIP,NIT",
      "P1,F,1950,C9,2026-01-10,GER,urine,Escherichia coli,0,R,S,S",
      "P1,F,1950,C9,2026-01-10,GER,urine,Enterococcus faecalis,0,S,,S",
      "P2,M,1980,C10,2026-01-11,PHC-N,virtsa,,,,,",
    ].join("\n");
    const r = parseIsolateCsv(csv);
    expect(r.warnings).toEqual([]);
    expect(r.cultures.map((c) => [c.cultureId, c.result, c.nIsolates])).toEqual([
      ["C9", "positive", 2],
      ["C10", "negative", 0],
    ]);
    expect(r.susceptibility.filter((s) => s.isolateId === "C9-1").map((s) => `${s.antibiotic}:${s.result}`)).toEqual([
      "AMP:R",
      "CIP:S",
      "NIT:S",
    ]);
  });
});

describe("helpers", () => {
  it("detects formats and counts EUCAST I as susceptible", () => {
    expect(detectFormat(HL7)).toBe("hl7v2");
    expect(detectFormat(JSON.stringify(FHIR))).toBe("fhir");
    expect(detectFormat("a,b\n1,2", "text/csv")).toBe("csv");
    expect(interpretation("I")).toBe("S");
    expect(interpretation("R")).toBe("R");
    expect(ingest(HL7, "hl7v2").cultures).toHaveLength(1);
  });

  it("has a THL code for every organism and antibiotic in the dataset", () => {
    const m = DEFAULT_CODE_MAPS;
    const organisms = new Set(
      Object.entries(m.organisms)
        .filter(([k]) => k.startsWith(`${FINNISH_SYSTEMS.microbes}|`))
        .map(([, v]) => v),
    );
    const antibiotics = new Set(
      Object.entries(m.antibiotics)
        .filter(([k]) => k.startsWith(`${FINNISH_SYSTEMS.antimicrobials}|`))
        .map(([, v]) => v),
    );
    expect([...organisms].sort()).toEqual([...ORGANISMS].sort());
    expect([...antibiotics].sort()).toEqual(ANTIBIOTICS.map((a) => a.code).sort());
  });

  it("computes ISO weeks like the dataset", () => {
    expect(isoWeek("2023-10-02")).toEqual({ year: 2023, week: 40 });
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    expect(isoWeek("2024-12-30")).toEqual({ year: 2025, week: 1 });
  });
});
