import type { AeiClient, Alert } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import type { Project } from "@aei/projects";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSite } from "../../../sites.ts";
import { type BoardState, boardToParams } from "../board.ts";
import { alertInScope, workspaceBundle, workspaceScope } from "./bundle.ts";
import { openProject } from "./useProject.ts";

const board: BoardState = { panel: "grid", weeks: 12, unit: "ICU", kinds: ["sentinel"], phenotype: "cpe", incident: null, focus: null };
const record: IsolateRecord = {
  isolateId: "i1",
  cultureId: "c1",
  patientId: "p1",
  sampleDate: "2025-05-10",
  admissionDate: null,
  ward: "ICU",
  specimen: "blood",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 42,
  homeArea: "Turku",
  phenotypes: ["cpe"],
  results: { MEM: "R" },
};
const alert: Alert = {
  kind: "cpe",
  id: "a1",
  date: "2025-05-10",
  ward: "ICU",
  patientId: "p1",
  isolateId: "i1",
  organism: "Escherichia coli",
  specimen: "blood",
};
afterEach(() => vi.unstubAllGlobals());

describe("workspace export glue", () => {
  it("captures only the board's scope, without persisting the current project id", () => {
    const scope = workspaceScope(board, "2025-05-12");
    expect(scope).toMatchObject({
      site: currentSite(),
      from: "2025-02-17",
      units: ["ICU"],
      phenotypes: ["cpe"],
      kinds: ["sentinel"],
      organisms: [],
    });
    expect(scope.to).toBeUndefined();
    expect(Object.fromEntries(new URLSearchParams(scope.board))).toEqual(
      Object.fromEntries(Object.entries(boardToParams(board)).filter(([, value]) => value)),
    );
  });
  it("filters alerts by their date, unit, phenotype and board signal kind", () => {
    const scope = workspaceScope(board, "2025-05-12");
    expect(alertInScope(alert, scope, "2025-05-12")).toBe(true);
    expect(alertInScope({ ...alert, date: "2025-05-13" }, scope, "2025-05-12")).toBe(false);
    expect(alertInScope({ ...alert, ward: "URO" }, scope, "2025-05-12")).toBe(false);
    expect(alertInScope(alert, { ...scope, kinds: ["trend"] }, "2025-05-12")).toBe(false);
    expect(alertInScope(alert, { ...scope, phenotypes: ["mrsa"] }, "2025-05-12")).toBe(false);
    expect(
      alertInScope(
        { kind: "detector", id: "d", date: "2025-05-10", ward: null, detector: "rising-trend", observed: 0.5 },
        scope,
        "2025-05-12",
      ),
    ).toBe(false);
  });
  it("queries the existing client, filters locally and counts patients once", async () => {
    const isolates = vi.fn().mockResolvedValue({ records: [record, { ...record, isolateId: "i2" }, { ...record, ward: "URO" }] });
    const alerts = vi.fn().mockResolvedValue({ alerts: [alert, { ...alert, date: "2025-05-13" }] });
    const client = { isolates, alerts } as unknown as AeiClient;
    const root = { querySelectorAll: () => [] } as unknown as HTMLElement;
    const bundle = await workspaceBundle({ client, board, clock: "2025-05-12", root, png: false, locale: "en" });
    expect(isolates).toHaveBeenCalledWith({ from: "2025-02-17", to: "2025-05-12", ward: "ICU", site: currentSite() });
    expect(alerts).toHaveBeenCalledWith({ from: "2025-02-17", site: currentSite() });
    expect(bundle.tables.map((table) => table.rows.length)).toEqual([2, 1]);
    expect(bundle.numbers.map((number) => number.value)).toEqual([2, 1, 1]);
    expect(bundle.numbers.every((number) => number.method)).toBe(true);
  });
  it("retains an unchanged frozen scope's lower bound and fingerprint as the clock advances", async () => {
    const scope = workspaceScope(board, "2025-05-12");
    const project: Project = {
      id: "frozen",
      name: "Study",
      description: "",
      createdAt: "2025-05-12",
      updatedAt: "2025-05-12",
      mode: "frozen",
      asOf: "2025-05-12",
      scope: { ...scope, to: "2025-05-12" },
      fingerprint: { rows: 1, sha256: "abc" },
    };
    const isolates = vi.fn().mockResolvedValue({ records: [record] });
    const client = { isolates, alerts: vi.fn().mockResolvedValue({ alerts: [] }) } as unknown as AeiClient;
    const bundle = await workspaceBundle({
      client,
      board,
      clock: "2025-06-12",
      project,
      root: { querySelectorAll: () => [] } as unknown as HTMLElement,
      png: false,
      locale: "en",
    });
    expect(bundle.asOf).toBe("2025-05-12");
    expect(bundle.scope.from).toBe("2025-02-17");
    expect(bundle.fingerprint).toEqual(project.fingerprint);
    expect(bundle.title).toBe("Study");
  });
  it("opens a project through the existing hash helpers and notifies App of the hospital", () => {
    const location = { hash: "#research?unit=URO&hospital=other&tl=alerts" };
    vi.stubGlobal("location", location);
    vi.stubGlobal("history", {
      state: null,
      replaceState: (_state: unknown, _unused: string, hash: string) => {
        location.hash = hash;
      },
    });
    vi.stubGlobal("HashChangeEvent", Event);
    const dispatch = vi.fn();
    vi.stubGlobal("dispatchEvent", dispatch);
    const scope = workspaceScope(board, "2025-05-12");
    openProject({
      id: "study",
      name: "Study",
      description: "",
      mode: "continuous",
      scope,
      createdAt: "2025-05-12",
      updatedAt: "2025-05-12",
    });
    const params = new URLSearchParams(location.hash.split("?")[1]);
    expect(params.get("project")).toBe("study");
    expect(params.get("unit")).toBe("ICU");
    expect(params.get("tl")).toBe("alerts");
    expect(params.has("hospital")).toBe(false);
    expect(dispatch).toHaveBeenCalledOnce();
  });
});
