import type { IsolateRecord } from "@aei/domain";
import type { CarrierArrival } from "@aei/relations";
import { describe, expect, it } from "vitest";
import { carrierAlerts, cpeAlerts, detectorAlerts, sortAlerts } from "./index.ts";

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
