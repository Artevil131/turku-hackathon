import { readFileSync } from "node:fs";
import { NEW_IN_UNIT_DAYS } from "@aei/alerts";
import { LIVE_SETTINGS, SURVEILLANCE_PAIRS } from "@aei/detect";
import { describe, expect, it } from "vitest";
import { fillSnippet, METHODS, type MethodId, methodOf } from "./registry.ts";

const IDS = Object.keys(METHODS) as MethodId[];
const value = (id: MethodId, name: string) => METHODS[id].constants.find((c) => c.name === name)?.value;

describe("method registry", () => {
  it("has all seven methods, each keyed by its id", () => {
    expect(IDS.sort()).toEqual(["cpe", "empty-run", "new-in-unit", "phenotype-excess", "profile-excess", "rising-trend", "sampling-drop"]);
    for (const id of IDS) expect(METHODS[id].id).toBe(id);
  });

  it.each(IDS)("%s has a formula, plain text in both languages, constants and decisions", (id) => {
    const m = METHODS[id];
    expect(m.latex.trim().length).toBeGreaterThan(0);
    expect(m.plain.en.trim().length).toBeGreaterThan(0);
    expect(m.plain.fi.trim().length).toBeGreaterThan(0);
    expect(m.constants.length).toBeGreaterThanOrEqual(1);
    expect(m.decisions.length).toBeGreaterThanOrEqual(1);
    expect(m.code.ts.startsWith("libs/utils/")).toBe(true);
    expect(m.code.fn.length).toBeGreaterThan(0);
  });

  it("reads its constants from the live settings, not retyped", () => {
    expect(value("profile-excess", "alpha")).toBe(LIVE_SETTINGS.profileExcess.alpha);
    expect(value("profile-excess", "window days")).toBe(LIVE_SETTINGS.profileExcess.windowDays);
    expect(value("profile-excess", "min patients")).toBe(LIVE_SETTINGS.profileExcess.minObserved);
    expect(value("phenotype-excess", "alpha")).toBe(LIVE_SETTINGS.phenotypeExcess.alpha);
    expect(value("phenotype-excess", "min patients")).toBe(LIVE_SETTINGS.phenotypeExcess.minObserved);
    expect(value("sampling-drop", "alpha")).toBe(LIVE_SETTINGS.samplingDrop.alpha);
    expect(value("sampling-drop", "window days")).toBe(LIVE_SETTINGS.samplingDrop.windowDays);
    expect(value("empty-run", "alpha")).toBe(LIVE_SETTINGS.emptyRun.alpha);
    expect(value("empty-run", "baseline days")).toBe(LIVE_SETTINGS.emptyRun.baselineDays);
    expect(value("rising-trend", "alpha")).toBe(LIVE_SETTINGS.risingTrend.alpha);
    expect(value("rising-trend", "min bins")).toBe(LIVE_SETTINGS.risingTrend.minBins);
    expect(value("rising-trend", "pairs watched")).toBe(SURVEILLANCE_PAIRS.length);
    expect(value("new-in-unit", "look-back days")).toBe(NEW_IN_UNIT_DAYS);
  });

  it("names a Python function only where aei.detect has one", () => {
    const py = readFileSync(new URL("../../py/aei/detect.py", import.meta.url), "utf8");
    for (const id of IDS) {
      const name = METHODS[id].code.py;
      if (!name) continue;
      expect(name.startsWith("aei.detect.")).toBe(true);
      expect(py).toMatch(new RegExp(`^def ${name.slice("aei.detect.".length)}\\(`, "m"));
    }
    expect(METHODS.cpe.code.py).toBe("");
    expect(METHODS["new-in-unit"].code.py).toBe("");
  });

  it("maps alerts to their method, and null for kinds without one", () => {
    expect(methodOf({ kind: "detector", detector: "profile-excess" })).toBe(METHODS["profile-excess"]);
    expect(methodOf({ kind: "detector", detector: "rising-trend" })).toBe(METHODS["rising-trend"]);
    expect(methodOf({ kind: "cpe" })).toBe(METHODS.cpe);
    expect(methodOf({ kind: "new-in-unit" })).toBe(METHODS["new-in-unit"]);
    expect(methodOf({ kind: "carrier" })).toBeNull();
    expect(methodOf({ kind: "detector" })).toBeNull();
  });

  it("fills the snippet placeholders and leaves no braces behind", () => {
    const filled = fillSnippet(METHODS["profile-excess"], {
      ward: "URO",
      organism: "Escherichia coli",
      from: "2025-05-12",
      to: "2025-06-08",
    });
    expect(filled).toContain('s.ward == "URO"');
    expect(filled).toContain('"2025-05-12" <= s.date <= "2025-06-08"');
    expect(filled).not.toMatch(/\{(ward|organism|from|to)\}/);
  });

  it.each(IDS)("%s has an R snippet that reads the package and leaves no placeholder after filling", (id) => {
    const filled = fillSnippet(
      METHODS[id],
      {
        ward: "URO",
        organism: "Escherichia coli",
        from: "2025-05-12",
        to: "2025-06-08",
        phenotype: "esbl",
        profile: "SR",
        antibiotic: "CRO",
        observed: "7",
        expected: "1.2",
      },
      "r",
    );
    expect(filled).toContain("library(aei)");
    expect(filled).toContain("as_amr(pkg)");
    expect(filled).toContain('as.Date("2025-06-08")');
    expect(filled).not.toMatch(/\{[a-z]+\}/);
    expect(filled.split("\n")[0]).toMatch(/^# .*D-0\d\d/);
  });

  it("fills a missing count with NA in R, never a brace", () => {
    const filled = fillSnippet(METHODS["phenotype-excess"], { ward: "URO", organism: "", from: "a", to: "b" }, "r");
    expect(filled).toContain("ppois(y - 1, NA, lower.tail = FALSE)");
    const cut = fillSnippet(
      METHODS["phenotype-excess"],
      { ward: "URO", organism: "", from: "a", to: "b", testFrom: "2025-05-13", testTo: "2025-06-09" },
      "r",
    );
    expect(cut).toContain('as.Date("2025-05-13") & x$sampleDate <= as.Date("2025-06-09")');
    expect(filled).not.toMatch(/\{[a-z]+\}/);
  });
});
