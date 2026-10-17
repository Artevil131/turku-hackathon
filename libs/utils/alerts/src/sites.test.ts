import { type IsolateRecord, WARDS } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { newInUnitAlerts } from "./index.ts";

// "New in a unit" looks back within the unit's own site (D-051).

const record = (isolateId: string, sampleDate: string, ward: string, phenotypes: IsolateRecord["phenotypes"]): IsolateRecord => ({
  isolateId,
  cultureId: isolateId,
  patientId: `p-${isolateId}`,
  sampleDate,
  admissionDate: null,
  ward,
  specimen: "wound",
  organism: "Staphylococcus aureus",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes,
  results: {},
});

const wards = [...WARDS, { code: "sata/ICU", site: "sata", fi: "Teho", en: "ICU", type: "in" as const, institution: "hospital" as const }];

describe("newInUnitAlerts across sites", () => {
  const home = [record("h1", "2024-01-01", "ICU", []), record("h2", "2025-03-01", "ICU", ["mrsa"])];

  it("a connected site's first weeks are quiet, like the dataset's", () => {
    // Satasairaala starts sending on 2025-01-01; its first MRSA a week later is not "new after a long time".
    const sata = [record("s1", "2025-01-01", "sata/ICU", []), record("s2", "2025-01-08", "sata/ICU", ["mrsa"])];
    const alerts = newInUnitAlerts([...home, ...sata], ["mrsa"], 180, wards);
    expect(alerts.map((a) => a.isolateId)).toEqual(["h2"]);
  });

  it("a second site's rows do not change the first site's alerts", () => {
    const sata = [record("s3", "2024-06-01", "sata/ICU", ["mrsa"])];
    expect(newInUnitAlerts([...home, ...sata], ["mrsa"], 180, wards).filter((a) => a.ward === "ICU")).toEqual(
      newInUnitAlerts(home, ["mrsa"], 180, wards),
    );
  });
});
