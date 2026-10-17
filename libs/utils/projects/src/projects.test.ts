import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IsolateRecord } from "@aei/domain";
import { describe, expect, it } from "vitest";
import { isProjectId, matchesScope, type Project, type ProjectInput, type ProjectScope, parseProjectInput } from "./index.ts";
import { createProjectStore, fingerprintRows, newProjectId } from "./node.ts";

const scope: ProjectScope = { units: [], organisms: [], phenotypes: [], kinds: [] };
const input: ProjectInput = { name: "ESBL study", mode: "continuous", scope };
const row: IsolateRecord = {
  isolateId: "i1",
  cultureId: "c1",
  patientId: "p1",
  sampleDate: "2025-03-01",
  admissionDate: null,
  ward: "URO",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 50,
  homeArea: "West",
  phenotypes: ["esbl"],
  results: { AMP: "R", MEM: "S" },
};
const project: Project = {
  ...input,
  id: "study-1",
  description: "",
  createdAt: "2025-03-01T00:00:00.000Z",
  updatedAt: "2025-03-01T00:00:00.000Z",
};

describe("project validation", () => {
  it("accepts continuous and frozen scopes and drops server-owned fields", () => {
    expect(parseProjectInput({ ...input, id: "client-id" })).toEqual({
      ...input,
      description: undefined,
      asOf: undefined,
      scope: { ...scope, site: undefined, from: undefined, to: undefined, board: undefined },
    });
    expect(
      parseProjectInput({
        ...input,
        name: "x".repeat(200),
        mode: "frozen",
        asOf: "2024-02-29",
        scope: { ...scope, from: "2024-02-29", to: "2024-02-29", board: "unit=URO&ph=ESBL" },
      }).asOf,
    ).toBe("2024-02-29");
  });
  it.each([
    [null, "project"],
    [[], "project"],
    [{ ...input, name: " " }, "name"],
    [{ ...input, name: "x".repeat(201) }, "name"],
    [{ ...input, mode: "other" }, "mode"],
    [{ ...input, mode: "frozen" }, "asOf"],
    [{ ...input, asOf: "2025-03-01" }, "asOf"],
    [{ ...input, mode: "frozen", asOf: "2025-02-29" }, "asOf"],
    [{ ...input, description: 1 }, "description"],
    [{ ...input, scope: null }, "scope"],
    [{ ...input, scope: { ...scope, from: "2025-13-01" } }, "scope.from"],
    [{ ...input, scope: { ...scope, to: "2025-2-01" } }, "scope.to"],
    [{ ...input, scope: { ...scope, from: "2025-03-02", to: "2025-03-01" } }, "scope.from"],
    [{ ...input, scope: { ...scope, units: [4] } }, "scope.units"],
    [{ ...input, scope: { ...scope, organisms: "E. coli" } }, "scope.organisms"],
    [{ ...input, scope: { ...scope, phenotypes: null } }, "scope.phenotypes"],
    [{ ...input, scope: { ...scope, kinds: undefined } }, "scope.kinds"],
    [{ ...input, scope: { ...scope, site: 2 } }, "scope.site"],
    [{ ...input, scope: { ...scope, board: false } }, "scope.board"],
  ])("rejects bad shape %j", (value, message) => expect(() => parseProjectInput(value)).toThrow(message));
  it("makes unique path-safe bounded ids", () => {
    for (const name of ["ESBL study!", "Åäö", "x".repeat(200)]) {
      const id = newProjectId(name);
      expect(isProjectId(id)).toBe(true);
      expect(newProjectId(name)).not.toBe(id);
    }
    for (const id of ["", "../study", "Study", "a/b", "a".repeat(65), null]) expect(isProjectId(id)).toBe(false);
  });
});

describe("isolate scope", () => {
  it("uses inclusive dates, AND across filters and any phenotype overlap; site is caller-owned", () => {
    expect(matchesScope(row, scope)).toBe(true);
    expect(matchesScope(row, { ...scope, site: "other", kinds: ["cluster"], board: "unit=ICU" })).toBe(true);
    expect(
      matchesScope(
        row,
        { ...scope, from: row.sampleDate, to: row.sampleDate, units: ["URO"], organisms: [row.organism], phenotypes: ["mrsa", "esbl"] },
        row.sampleDate,
      ),
    ).toBe(true);
    expect(matchesScope(row, scope, "2025-02-28")).toBe(false);
    expect(matchesScope(row, { ...scope, from: "2025-03-02" })).toBe(false);
    expect(matchesScope(row, { ...scope, to: "2025-02-28" })).toBe(false);
    expect(matchesScope(row, { ...scope, units: ["ICU"] })).toBe(false);
    expect(matchesScope(row, { ...scope, organisms: ["Klebsiella pneumoniae"] })).toBe(false);
    expect(matchesScope(row, { ...scope, phenotypes: ["mrsa"] })).toBe(false);
  });
});

describe("row fingerprint", () => {
  it("is stable across row/result order and changes with every pinned field", () => {
    const second = { ...row, isolateId: "i2" };
    const fingerprint = fingerprintRows([row, second]);
    expect(fingerprint).toEqual(fingerprintRows([{ ...second, results: { MEM: "S", AMP: "R" } }, row]));
    expect(fingerprint).toMatchObject({ rows: 2, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(fingerprintRows([]).sha256).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    for (const change of [
      { isolateId: "i9" },
      { sampleDate: "2025-03-02" },
      { ward: "ICU" },
      { organism: "Klebsiella pneumoniae" as const },
      { results: { AMP: "S" as const } },
    ]) {
      expect(fingerprintRows([{ ...row, ...change }, second])).not.toEqual(fingerprint);
    }
    expect(fingerprintRows([{ ...row, patientId: "different" }, second])).toEqual(fingerprint);
  });
});

describe.each(["memory", "files"])("project store: %s", (kind) => {
  it("roundtrips, replaces, sorts and deletes; file stores reopen and ignore bad files", () => {
    const dir = mkdtempSync(join(tmpdir(), "aei-projects-"));
    try {
      const store = createProjectStore(kind === "files" ? dir : undefined);
      expect(store.list()).toEqual([]);
      expect(readdirSync(dir)).toEqual([]);
      store.put(project);
      store.put({ ...project, id: "newer", updatedAt: "2025-04-01T00:00:00.000Z" });
      expect(store.list().map((p) => p.id)).toEqual(["newer", project.id]);
      expect(store.get(project.id)).toMatchObject(project);
      const got = store.get(project.id);
      if (got) got.scope.units.push("ICU");
      expect(store.get(project.id)?.scope.units).toEqual([]);
      store.put({ ...project, name: "Renamed" });
      expect(store.get(project.id)?.name).toBe("Renamed");
      const frozen: Project = { ...project, mode: "frozen", asOf: "2025-03-01", fingerprint: fingerprintRows([row]) };
      store.put(frozen);
      expect(store.get(project.id)).toMatchObject(frozen);
      store.put({ ...frozen, fingerprint: undefined });
      expect(store.get(project.id)?.fingerprint).toBeUndefined();
      if (kind === "files") {
        mkdirSync(join(dir, "projects"), { recursive: true });
        mkdirSync(join(dir, "projects", "not-a-file.json"));
        writeFileSync(join(dir, "projects", "broken.json"), "{");
        writeFileSync(join(dir, "projects", "shape.json"), "{}");
        writeFileSync(join(dir, "projects", "foreign.json"), JSON.stringify(project));
        expect(createProjectStore(dir).list()).toHaveLength(2);
        expect(readdirSync(join(dir, "projects")).some((name) => name.endsWith(".tmp"))).toBe(false);
      } else expect(createProjectStore().list()).toEqual([]);
      for (const id of ["../outside", "UPPER", ""]) {
        expect(() => store.get(id)).toThrow("invalid project id");
        expect(() => store.delete(id)).toThrow("invalid project id");
        expect(() => store.put({ ...project, id })).toThrow("invalid project id");
      }
      expect(store.delete(project.id)).toBe(true);
      expect(store.delete(project.id)).toBe(false);
      expect(store.get(project.id)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
