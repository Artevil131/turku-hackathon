import type { IsolateRecord } from "@aei/domain";
import { addDays } from "@aei/replay";
import { describe, expect, it } from "vitest";
import { LIVE_SETTINGS, liveSignals, profileExcess } from "./index.ts";

// Statistics stay within a site (D-051): a unit is compared with the rest of its own hospital.

const rec = (id: string, sampleDate: string, extra: Partial<IsolateRecord> = {}): IsolateRecord => ({
  isolateId: id,
  cultureId: id,
  patientId: `p-${id}`,
  sampleDate,
  admissionDate: addDays(sampleDate, -5),
  ward: "URO",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 70,
  homeArea: "North",
  phenotypes: [],
  results: { AMP: "R", CRO: "S", CIP: "S" },
  ...extra,
});

const NEW_PROFILE = { AMP: "R", CRO: "R", CIP: "R" } as const;

// Tyks Urology: a year of ampicillin-only resistance, then four patients with a new profile.
const home: IsolateRecord[] = [
  ...Array.from({ length: 365 }, (_, d) => rec(`h${d}`, addDays("2024-06-01", d))),
  ...Array.from({ length: 4 }, (_, i) => rec(`hc${i}`, addDays("2025-06-05", i * 2), { results: NEW_PROFILE })),
  ...Array.from({ length: 6 }, (_, i) => rec(`hn${i}`, addDays("2025-06-04", i * 2))),
];
// A second hospital where that profile is common: pooled, it would make the Tyks cluster look expected.
const sata = Array.from({ length: 365 }, (_, d) => rec(`s${d}`, addDays("2024-06-01", d), { ward: "sata/URO", results: NEW_PROFILE }));

describe("liveSignals across sites", () => {
  it("a second site's rows do not change the first site's signals", () => {
    const alone = liveSignals(home, []);
    expect(alone.some((s) => s.detector === "profile-excess" && s.ward === "URO")).toBe(true);
    const together = liveSignals([...home, ...sata], []).filter((s) => (s.ward === null ? !s.site : !s.ward.startsWith("sata/")));
    expect(together).toEqual(alone);
  });

  it("pooling the two hospitals would have hidden the cluster", () => {
    const pooled = profileExcess([...home, ...sata.map((r) => ({ ...r, ward: "URO-2" }))], LIVE_SETTINGS.profileExcess);
    expect(pooled.some((s) => s.ward === "URO")).toBe(false);
  });

  it("a connected site's hospital-wide trends carry the site", () => {
    const trends = liveSignals([...home, ...sata], []).filter((s) => s.ward === null);
    for (const s of trends) if (s.site) expect(s.key.startsWith(`${s.site}/`)).toBe(true);
  });
});
