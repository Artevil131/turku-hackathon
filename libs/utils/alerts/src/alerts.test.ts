import type { IsolateRecord } from "@aei/domain";
import type { CarrierArrival } from "@aei/relations";
import { describe, expect, it } from "vitest";
import { type Alert, carrierAlerts, cpeAlerts, detectorAlerts, groupIncidents, newInUnitAlerts, sortAlerts } from "./index.ts";

const record = (isolateId: string, sampleDate: string, phenotypes: IsolateRecord["phenotypes"]): IsolateRecord => ({
  isolateId,
  cultureId: isolateId.split("-")[0] ?? isolateId,
  patientId: "P1",
  sampleDate,
  admissionDate: null,
  ward: "ICU",
  specimen: "urine",
  organism: "Klebsiella pneumoniae",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes,
  results: {},
});

const arrival: CarrierArrival = {
  patientId: "P2",
  phenotype: "esbl",
  cultureId: "C2",
  date: "2026-03-02",
  ward: "GER",
  from: "ICU",
  foundOn: "2026-02-20",
  confirmed: false,
};

describe("alerts", () => {
  it("fires on every CPE isolate in the window and nothing else", () => {
    const records = [
      record("C1-1", "2026-03-01", ["cpe", "esbl"]),
      record("C3-1", "2026-03-01", ["esbl"]),
      record("C4-1", "2025-01-01", ["cpe"]),
    ];
    expect(cpeAlerts(records, { from: "2026-02-01", to: "2026-03-31" }).map((a) => a.id)).toEqual(["cpe:C1-1"]);
  });

  it("turns carrier arrivals into alerts and sorts newest first", () => {
    const alerts = sortAlerts([...cpeAlerts([record("C1-1", "2026-03-01", ["cpe"])]), ...carrierAlerts([arrival])]);
    expect(alerts.map((a) => [a.kind, a.date])).toEqual([
      ["carrier", "2026-03-02"],
      ["cpe", "2026-03-01"],
    ]);
    expect(alerts[0]).toMatchObject({ from: "ICU", foundOn: "2026-02-20", phenotype: "esbl" });
  });
});

describe("detectorAlerts", () => {
  it("raises one alert per signal episode, on its first day", () => {
    const signal = (date: string) => ({
      detector: "phenotype-excess" as const,
      key: "URO|esbl",
      date,
      ward: "URO" as const,
      phenotype: "esbl" as const,
      observed: 6,
      expected: 1.2,
      p: 0.0004,
    });
    const alerts = detectorAlerts([signal("2025-06-10"), signal("2025-06-12"), signal("2025-09-01")]);
    expect(alerts.map((a) => a.date)).toEqual(["2025-06-10", "2025-09-01"]);
    expect(alerts[0]).toMatchObject({ kind: "detector", ward: "URO", detector: "phenotype-excess", phenotype: "esbl", observed: 6 });
  });
});

describe("newInUnitAlerts", () => {
  it("fires on the first MRSA in a unit after the look-back, not during the first look-back of the data", () => {
    const mrsa = (id: string, date: string, ward: IsolateRecord["ward"] = "ICU") => ({
      ...record(id, date, ["mrsa"]),
      ward,
      organism: "Staphylococcus aureus" as const,
    });
    const records = [
      record("C0-1", "2025-01-01", []), // data start
      mrsa("C1-1", "2025-02-01"), // inside the first 180 days: quiet
      mrsa("C2-1", "2025-03-01"),
      mrsa("C3-1", "2025-10-01"), // 214 days after the last: new
      mrsa("C4-1", "2025-10-05"), // 4 days later: not new
      mrsa("C5-1", "2025-10-06", "GER"), // first ever in GER, after the quiet start: new
    ];
    expect(newInUnitAlerts(records, ["mrsa"], 180).map((a) => [a.ward, a.date, a.previous])).toEqual([
      ["ICU", "2025-10-01", "2025-03-01"],
      ["GER", "2025-10-06", null],
    ]);
  });
});

describe("gap alerts", () => {
  it("raises one alert for a gap seen first by the empty-run rule and later by the 7-day rule", () => {
    const sig = (detector: "empty-run" | "sampling-drop", date: string, ward: "ICU" | "GER" = "ICU") => ({
      detector,
      key: ward,
      date,
      ward,
      observed: 3,
    });
    const alerts = detectorAlerts([
      sig("empty-run", "2025-05-14"),
      sig("sampling-drop", "2025-05-17"),
      sig("sampling-drop", "2025-05-17", "GER"),
    ]);
    expect(alerts.map((a) => [a.detector, a.ward])).toEqual([
      ["empty-run", "ICU"],
      ["sampling-drop", "GER"],
    ]);
  });
});

describe("incidents", () => {
  it("groups one event's alerts and keeps other units and organisms apart", () => {
    const base = { patientId: "P1", isolateId: "C1-1", previous: null };
    const input: Alert[] = [
      {
        kind: "new-in-unit" as const,
        id: "new:mrsa:C1-1",
        date: "2026-03-03",
        ward: "ICU" as const,
        phenotype: "mrsa" as const,
        organism: "Staphylococcus aureus" as const,
        ...base,
      },
      {
        kind: "detector" as const,
        id: "d1",
        date: "2026-03-07",
        ward: "ICU" as const,
        detector: "phenotype-excess" as const,
        phenotype: "mrsa" as const,
        observed: 3,
      },
      {
        kind: "detector" as const,
        id: "d2",
        date: "2026-03-09",
        ward: "ICU" as const,
        detector: "profile-excess" as const,
        organism: "Staphylococcus aureus" as const,
        observed: 3,
      },
      {
        kind: "detector" as const,
        id: "d3",
        date: "2026-03-09",
        ward: "GER" as const,
        detector: "phenotype-excess" as const,
        phenotype: "mrsa" as const,
        observed: 3,
      },
      {
        kind: "detector" as const,
        id: "d4",
        date: "2026-06-01",
        ward: "ICU" as const,
        detector: "phenotype-excess" as const,
        phenotype: "mrsa" as const,
        observed: 3,
      },
    ];
    const alerts = groupIncidents(input);
    expect(alerts.map((a) => [a.id, a.incident])).toEqual([
      ["new:mrsa:C1-1", "new:mrsa:C1-1"],
      ["d1", "new:mrsa:C1-1"],
      ["d2", "new:mrsa:C1-1"],
      ["d3", "d3"],
      ["d4", "d4"],
    ]);
  });

  it("raises 'new in a unit' for inpatient units only", () => {
    const mrsa = (id: string, date: string, ward: IsolateRecord["ward"]) => ({ ...record(id, date, ["mrsa"]), ward });
    const records = [record("C0-1", "2025-01-01", []), mrsa("C1-1", "2025-10-01", "ED"), mrsa("C2-1", "2025-10-02", "SURG")];
    expect(newInUnitAlerts(records, ["mrsa"], 180).map((a) => a.ward)).toEqual(["SURG"]);
  });
});
