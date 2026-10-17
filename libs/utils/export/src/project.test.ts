import type { Alert } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import type { Project, ProjectScope } from "@aei/projects";
import { describe, expect, it } from "vitest";
import { alertInScope, type ProjectBundleLabels, packageFiles, projectBundle } from "./index.ts";

const scope: ProjectScope = {
  site: "tyks",
  from: "2025-05-01",
  to: "2025-06-01",
  units: ["ICU"],
  organisms: ["Escherichia coli"],
  phenotypes: ["cpe"],
  kinds: ["sentinel"],
  board: "unit=ICU",
};
const project: Project = {
  id: "study",
  name: "Study ä",
  description: "",
  mode: "frozen",
  asOf: "2025-05-12",
  scope,
  fingerprint: { rows: 2, sha256: "saved-cut" },
  createdAt: "2026-10-17T00:00:00Z",
  updatedAt: "2026-10-17T00:00:00Z",
};
const record: IsolateRecord = {
  isolateId: "i1",
  cultureId: "c1",
  patientId: "p1",
  sampleDate: "2025-05-01",
  admissionDate: null,
  ward: "ICU",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 40,
  homeArea: "North",
  phenotypes: ["cpe"],
  results: { AMP: "R" },
};
const alert: Alert = {
  kind: "cpe",
  id: "a1",
  date: record.sampleDate,
  ward: record.ward,
  patientId: record.patientId,
  isolateId: record.isolateId,
  organism: record.organism,
  specimen: record.specimen,
};
const labels: ProjectBundleLabels = {
  isolates: "Isolates label",
  patients: "Patients label",
  alerts: "Alerts label",
  isolateMethod: "Count rows",
  patientMethod: "Distinct patients",
  alertMethod: "Count alerts",
  frozenNote: "Saved cut",
};
const input = { project, records: [record], alerts: [alert], antibiotics: ["AMP", "MEM"], labels, clock: "2025-06-01" };

describe("saved project bundle", () => {
  it("keeps the exact saved scope and frozen cut, labels, fingerprint and reproducible recipes", () => {
    const bundle = projectBundle({
      ...input,
      appVersion: "test",
      records: [
        record,
        { ...record, isolateId: "i2" },
        { ...record, isolateId: "later", sampleDate: "2025-05-13" },
        { ...record, ward: "URO" },
        { ...record, sampleDate: "2025-04-30" },
        { ...record, phenotypes: [] },
        { ...record, organism: "Klebsiella pneumoniae" },
      ],
      alerts: [alert, { ...alert, date: "2025-05-13" }, { ...alert, ward: "URO" }],
    });
    expect(bundle).toMatchObject({
      title: project.name,
      appVersion: "test",
      scope,
      asOf: project.asOf,
      fingerprint: project.fingerprint,
      sourceNote: labels.frozenNote,
      figures: [],
    });
    expect(bundle.numbers).toEqual([
      { id: "isolates", label: labels.isolates, value: 2, method: labels.isolateMethod, recipe: { op: "count", table: "isolates" } },
      {
        id: "patients",
        label: labels.patients,
        value: 1,
        method: labels.patientMethod,
        recipe: { op: "distinct", table: "isolates", column: "patientId" },
      },
      { id: "alerts", label: labels.alerts, value: 1, method: labels.alertMethod, recipe: { op: "count", table: "alerts" } },
    ]);
    const files = Object.fromEntries(packageFiles(bundle).map((file) => [file.path, file.data]));
    expect(JSON.parse(String(files["methods.json"]))).toEqual(bundle.numbers);
    const fields = JSON.parse(String(files["datapackage.json"])).resources[0].schema.fields;
    expect(fields.filter((field: { role?: string }) => field.role === "result").map((field: { name: string }) => field.name)).toEqual([
      "AMP",
      "MEM",
    ]);
    expect(fields.find((field: { name: string }) => field.name === "patientId")).not.toHaveProperty("role");
    expect(files).not.toHaveProperty("report.docx");
  });

  it("uses the clock for continuous projects, including empty cuts, without a frozen fingerprint", () => {
    const bundle = projectBundle({ ...input, project: { ...project, mode: "continuous", asOf: undefined }, clock: "2025-04-30" });
    expect(bundle.asOf).toBe("2025-04-30");
    expect(bundle.fingerprint).toBeUndefined();
    expect(bundle.sourceNote).toBeUndefined();
    expect(bundle.tables.map((table) => table.rows)).toEqual([[], []]);
    expect(bundle.numbers.map((number) => number.value)).toEqual([0, 0, 0]);
    expect(projectBundle({ ...input, project: { ...project, mode: "continuous", asOf: undefined } }).asOf).toBe(input.clock);
  });
});

describe("alert scope shared with the board", () => {
  it("applies dates, units, organisms, phenotypes and signal kinds", () => {
    expect(alertInScope(alert, scope, "2025-05-12")).toBe(true);
    for (const patch of [
      { from: "2025-05-02" },
      { to: "2025-04-30" },
      { units: ["URO"] },
      { organisms: ["Klebsiella pneumoniae"] as ProjectScope["organisms"] },
      { phenotypes: ["esbl"] as ProjectScope["phenotypes"] },
      { kinds: ["cluster"] },
    ])
      expect(alertInScope(alert, { ...scope, ...patch }, "2025-05-12")).toBe(false);
    expect(alertInScope(alert, scope, "2025-04-30")).toBe(false);
  });

  it("maps detector kinds and hospital-wide and qualified-unit sites", () => {
    const open = { ...scope, units: [], organisms: [], phenotypes: [], kinds: [] };
    const detector: Alert = { kind: "detector", id: "d", date: alert.date, ward: null, detector: "rising-trend", observed: 1 };
    expect(alertInScope(detector, open, input.clock)).toBe(true);
    expect(alertInScope({ ...detector, site: "sata" }, open, input.clock)).toBe(false);
    expect(alertInScope({ ...alert, ward: "sata/ICU" }, open, input.clock)).toBe(false);
    expect(alertInScope({ ...alert, ward: "sata/ICU" }, { ...open, site: "sata" }, input.clock)).toBe(true);
    for (const [name, kind] of [
      ["profile-excess", "cluster"],
      ["phenotype-excess", "cluster"],
      ["rising-trend", "trend"],
      ["sampling-drop", "data"],
      ["empty-run", "data"],
    ] as const) {
      expect(alertInScope({ ...detector, detector: name }, { ...open, kinds: [kind] }, input.clock)).toBe(true);
    }
    const carrier: Alert = {
      kind: "carrier",
      id: "c",
      date: alert.date,
      ward: "ICU",
      patientId: "p1",
      cultureId: "c1",
      phenotype: "cpe",
      from: "URO",
      foundOn: alert.date,
      confirmed: true,
    };
    expect(alertInScope(carrier, open, input.clock)).toBe(true);
    expect(alertInScope(carrier, { ...open, kinds: ["sentinel"] }, input.clock)).toBe(false);
  });
});
