import { ANTIBIOTICS, ORGANISMS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CODE_MAPS,
  detectFormat,
  extendCodeMaps,
  FINNISH_SYSTEMS,
  ingest,
  interpretation,
  isIsoDate,
  isoWeek,
  mapWard,
  parseFhirBundle,
  parseHl7Batch,
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

  it("refuses a collection or admission day that does not exist instead of storing it", () => {
    const badSample = parseHl7Message(HL7.replaceAll("20250604081500", "20251399081500"));
    expect(badSample.cultures).toEqual([]);
    expect(badSample.warnings.join(" ")).toMatch(/no real collection date .*"20251399081500"/);
    const badAdmission = parseHl7Message(HL7.replace("|20250529", "|20250230"));
    expect(badAdmission.cultures).toEqual([]);
    expect(badAdmission.warnings.join(" ")).toMatch(/PV1-44 admission date "20250230" is not a real date/);
  });

  it("reads a birth date given to the year or month only", () => {
    for (const birth of ["1948", "194803"]) {
      const r = parseHl7Message(HL7.replace("19480312", birth));
      expect(r.patients).toEqual([expect.objectContaining({ birthYear: 1948 })]);
    }
  });

  it("puts a child OBR's results on the isolate OBR-26 names, whatever its OBX-4 says", () => {
    const two = HL7.replace(
      "OBX|2|CWE|ESBL^ESBL^L|1|POS^Positive^L||||||F",
      "OBX|2|CWE|4851^U -BaktVi^1.2.246.537.6.3|2|56415008^Klebsiella pneumoniae^http://snomed.info/sct||||||F",
    ).replace("^1^Escherichia coli|||", "^2^Klebsiella pneumoniae|||");
    const r = parseHl7Message(two);
    expect(r.isolates.map((i) => i.organism)).toEqual(["Escherichia coli", "Klebsiella pneumoniae"]);
    expect(r.susceptibility.every((s) => s.isolateId === "C2025-0042-2")).toBe(true);
  });

  it("numbers organisms that leave OBX-4 empty instead of overwriting one with the next", () => {
    const msg = HL7.split("\r")
      .slice(0, 5)
      .concat(
        "OBX|1|CWE|4851^U -BaktVi^1.2.246.537.6.3||7640-22^Escherichia coli^1.2.246.537.6.241||||||F",
        "OBX|2|CWE|4851^U -BaktVi^1.2.246.537.6.3||56415008^Klebsiella pneumoniae^http://snomed.info/sct||||||F",
      )
      .join("\r");
    expect(parseHl7Message(msg).isolates.map((i) => i.organism)).toEqual(["Escherichia coli", "Klebsiella pneumoniae"]);
  });

  it("gives each PATIENT_RESULT group its own patient and keeps the last of a repeated culture", () => {
    const lines = HL7.split("\r");
    const second = lines
      .slice(1, 5)
      .map((l) =>
        l.replace("PSEUDO-7731", "PSEUDO-8000").replace("|M|", "|F|").replace("URO^", "ICU^").replaceAll("C2025-0042", "C2025-0043"),
      );
    const r = parseHl7Message([...lines.slice(0, 7), ...second, lines[5], lines[6]?.replace("POS^", "NEG^")].join("\r"));
    expect(r.cultures.map((c) => [c.cultureId, c.patientId, c.ward])).toEqual([
      ["C2025-0042", "PSEUDO-7731", "URO"],
      ["C2025-0043", "PSEUDO-8000", "ICU"],
    ]);
    const twice = parseHl7Message([...lines.slice(0, 7), lines[3], lines[4], lines[5]].join("\r"));
    expect(twice.cultures).toHaveLength(1);
    expect(twice.isolates[0]?.phenotypes).toEqual([]);
    expect(twice.warnings.join(" ")).toMatch(/appears twice/);
  });

  it("skips blank lines between segments in a batch", () => {
    const batch = `${HL7.split("\r").slice(0, 4).join("\n")}\n\n${HL7.split("\r").slice(4).join("\n")}\n\n${HL7.replaceAll("C2025-0042", "C2025-0099")}`;
    expect(parseHl7Batch(batch).flatMap((r) => r.cultures.map((c) => c.cultureId))).toEqual(["C2025-0042", "C2025-0099"]);
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

  it("refuses a collection day that does not exist", () => {
    const r = parseFhirBundle(JSON.parse(JSON.stringify(FHIR).replace("2026-03-03T07:40", "2026-02-30T07:40")));
    expect(r.cultures).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/no real collection date/);
  });

  it("reports null entries and results instead of throwing", () => {
    expect(parseFhirBundle({ resourceType: "Bundle", entry: { resource: {} } }).warnings.join(" ")).toMatch(/not an array/);
    const withNulls = JSON.parse(JSON.stringify(FHIR));
    withNulls.entry.push(null);
    withNulls.entry[3].resource.result.push(null);
    const r = parseFhirBundle(withNulls);
    expect(r.cultures).toHaveLength(1);
    expect(r.warnings.join(" ")).toMatch(/entry null is not an object.*result null not in the bundle/);
  });

  it("keeps the last of a culture reported twice in one bundle", () => {
    const twice = JSON.parse(JSON.stringify(FHIR));
    const report = twice.entry[3];
    twice.entry.push({ fullUrl: "urn:uuid:rep2", resource: { ...report.resource, id: "rep2", result: [] } });
    const r = parseFhirBundle(twice);
    expect(r.cultures).toEqual([expect.objectContaining({ cultureId: "C2026-0777", result: "negative" })]);
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

  it("skips rows with no patient id or a date that does not exist, and does not guess a year", () => {
    const csv = [
      "patient_id,sex,birth_date,culture_id,sample_date,ward,specimen,admission_date",
      ",F,1950-01-01,C1,2026-01-10,GER,urine,",
      "P2,F,1950-01-01,C2,2025-13-01,GER,urine,",
      "P3,F,1950-01-01,C3,2025-02-30,GER,urine,",
      "P4,F,01.03.1948,C4,2026-01-10,GER,urine,",
      "P5,F,1950-01-01,C5,2026-01-10,GER,urine,2026-01-32",
      "P6,F,1950-01-01,C6,2026-01-10,GER,urine,2026-01-08",
    ].join("\n");
    const r = parseIsolateCsv(csv);
    expect(r.cultures.map((c) => [c.cultureId, c.admissionDate])).toEqual([["C6", "2026-01-08"]]);
    expect(r.warnings).toEqual([
      "row 2: skipped, no usable patient id",
      'row 3: skipped, no usable date "2025-13-01" (YYYY-MM-DD)',
      'row 4: skipped, no usable date "2025-02-30" (YYYY-MM-DD)',
      'row 5: skipped, no usable birth year "01.03.1948" (YYYY or YYYY-MM-DD)',
      'row 6: skipped, no usable admission date "2026-01-32" (YYYY-MM-DD)',
    ]);
  });

  it("reads a semicolon-separated export", () => {
    const r = parseIsolateCsv(
      ["patient_id;sex;birth_year;culture_id;sample_date;ward;specimen", "P1;F;1950;C1;2026-01-10;GER;urine"].join("\n"),
    );
    expect(r.warnings).toEqual([]);
    expect(r.cultures.map((c) => c.cultureId)).toEqual(["C1"]);
    expect(detectFormat("patient_id;sex\nP1;F")).toBe("csv");
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

  it("accepts only real calendar days and looks codes up without the prototype", () => {
    expect(["2025-02-28", "2024-02-29"].every(isIsoDate)).toBe(true);
    expect(["2025-02-30", "2025-13-01", "2025-1-01", "20250101", 20250101, null].some(isIsoDate)).toBe(false);
    expect(mapWard(DEFAULT_CODE_MAPS, [{ code: "constructor" }, { code: "toString" }])).toBeUndefined();
  });

  it("computes ISO weeks like the dataset", () => {
    expect(isoWeek("2023-10-02")).toEqual({ year: 2023, week: 40 });
    expect(isoWeek("2026-01-01")).toEqual({ year: 2026, week: 1 });
    expect(isoWeek("2024-12-30")).toEqual({ year: 2025, week: 1 });
  });
});
