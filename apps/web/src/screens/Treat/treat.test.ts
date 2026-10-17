import type { CoverageResponse } from "@aei/contract";
import { coverage, suggest, suggestCombinations } from "@aei/coverage";
import { ANTIBIOTICS, type IsolateRecord } from "@aei/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FeedMeta, Result } from "../../feed/types.ts";
import type { Signal } from "../../model/types.ts";
import { type TreatPrefs, TreatScreen } from "./index.tsx";
import { capFirst, coverageUrl, humanize, midSentence, sexesIn, signalsFor, unitGroups } from "./model.ts";
import { ResultView } from "./Result.tsx";

// A small synthetic feed, for tests only: codes are arbitrary on purpose so
// nothing in the screen can depend on a particular hospital.
const meta: FeedMeta = {
  start: "2024-01-01",
  end: "2024-12-31",
  units: [
    { code: "W1", en: "Ward one", fi: "Osasto yksi", type: "in", institution: "hospital" },
    { code: "C1", en: "Clinic one", fi: "Klinikka yksi", type: "out", institution: "primary_care" },
    { code: "W2", en: "Ward two", fi: "Osasto kaksi", type: "in", institution: "hospital" },
  ],
  antibiotics: [
    { code: "A1", en: "alphacillin", fi: "alfasilliini", class: "penicillins", reportedFor: "all" },
    { code: "B1", en: "betamycin", fi: "betamysiini", class: "other", reportedFor: "all" },
    { code: "S1", en: "screen test (screen)", fi: "seula", class: "screen", reportedFor: "all" },
  ],
  organisms: ["Genus alpha", "Genus beta"],
  specimens: [
    { code: "sp1", en: "fluid", fi: "neste" },
    { code: "sp2", en: "swab", fi: "sively" },
  ],
  ai: false,
};

function results(count: number, ward = "W1"): Result[] {
  const out: Result[] = [];
  for (let i = 0; i < count; i++) {
    const day = String(1 + (i % 28)).padStart(2, "0");
    out.push({
      isolateId: `i${ward}${i}`,
      cultureId: `c${ward}${i}`,
      patientId: `p${ward}${i}`,
      sampleDate: `2024-11-${day}`,
      admissionDate: null,
      ward,
      specimen: "sp1",
      organism: i % 3 === 0 ? "Genus beta" : "Genus alpha",
      sex: i % 2 ? "F" : "M",
      ageYears: 40 + (i % 50),
      phenotypes: [],
      results: { A1: i % 10 === 0 ? "R" : "S", B1: i % 4 === 0 ? "R" : "S" },
    });
  }
  return out;
}

const prefs: TreatPrefs = { ward: "W1", specimen: "sp1", sex: null, severity: "mild" };

function signal(over: Partial<Signal>): Signal {
  return {
    id: "x",
    kind: "cluster",
    source: "profile-excess",
    related: [],
    severity: "high",
    firstDate: "2024-11-20",
    lastDate: "2024-11-28",
    ward: "W1",
    observed: 4,
    expected: 0.5,
    isolateIds: [],
    ...over,
  };
}

describe("treat model", () => {
  it("asks the server for the unit, site, severity and, when set, sex", () => {
    expect(coverageUrl("", prefs)).toBe("/api/coverage?ward=W1&specimen=sp1&severity=mild");
    expect(coverageUrl("http://x", { ...prefs, sex: "F", severity: "severe" })).toBe(
      "http://x/api/coverage?ward=W1&specimen=sp1&severity=severe&sex=F",
    );
  });

  it("shows recent signals for the unit and whole-hospital ones that matter, most severe first", () => {
    const list = [
      signal({ id: "old", lastDate: "2024-10-01" }),
      signal({ id: "other-unit", ward: "W2" }),
      signal({ id: "mine-medium", severity: "medium", kind: "shift" }),
      signal({ id: "mine-high" }),
      signal({ id: "hospital-site", ward: null, severity: "medium", kind: "trend", specimen: "sp1" }),
      signal({ id: "hospital-other-site", ward: null, severity: "medium", kind: "trend", specimen: "sp2" }),
      signal({ id: "future", lastDate: "2024-12-30" }),
    ];
    expect(signalsFor(list, "W1", "sp1", "2024-11-30").map((s) => s.id)).toEqual(["mine-high", "mine-medium", "hospital-site"]);
  });

  it("groups units by institution in feed order and humanizes unknown codes", () => {
    expect(unitGroups(meta.units).map((g) => [g.institution, g.units.map((u) => u.code)])).toEqual([
      ["hospital", ["W1", "W2"]],
      ["primary_care", ["C1"]],
    ]);
    expect(humanize("long_term-care")).toBe("Long term care");
  });

  it("formats names for labels and sentences", () => {
    expect(capFirst("urine")).toBe("Urine");
    expect(midSentence("Urine")).toBe("urine");
    expect(midSentence("CSF")).toBe("CSF");
    expect(sexesIn(results(4))).toEqual(["F", "M"]);
  });
});

// The server's answer for a small urine pool at a real unit code, built with the same gear the server runs.
const realMeta: FeedMeta = {
  ...meta,
  units: [
    { code: "URO", en: "Urology", fi: "Urologia", type: "in", institution: "hospital" },
    { code: "MED-A", en: "Internal medicine A", fi: "Sisätaudit A", type: "in", institution: "hospital" },
  ],
  antibiotics: ANTIBIOTICS.map((a) => ({ code: a.code, en: a.en, fi: a.fi, class: a.class, reportedFor: a.reportedFor })),
  specimens: [{ code: "urine", en: "urine", fi: "virtsa" }],
};

function pool(n: number, ward = "URO"): IsolateRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    isolateId: `${ward}-${i}`,
    cultureId: `c-${ward}-${i}`,
    patientId: `p-${ward}-${i}`,
    sampleDate: `2025-05-${String(1 + (i % 28)).padStart(2, "0")}`,
    admissionDate: null,
    ward: ward as IsolateRecord["ward"],
    specimen: "urine",
    organism: i % 5 === 0 ? "Enterococcus faecalis" : "Escherichia coli",
    sex: i % 2 ? "F" : "M",
    ageYears: 70,
    homeArea: "North",
    phenotypes: [],
    results: i % 5 === 0 ? { AMP: "S", NIT: "R" } : { AMP: i % 2 ? "R" : "S", MEC: "S", NIT: "S", CIP: i % 7 ? "S" : "R", TMP: "S" },
  }));
}

function response(records: IsolateRecord[], ward: "URO" | "MED-A", severity: "mild" | "severe"): CoverageResponse {
  const c = coverage(records, { asOf: "2025-06-01", ward, specimen: "urine" });
  return {
    asOf: "2025-06-01",
    severity,
    coverage: c,
    suggestions: suggest(c, severity),
    combinationSuggestions: suggestCombinations(c, severity),
  };
}

describe("ResultView (the server's coverage list)", () => {
  const view = (data: CoverageResponse | null, p: Partial<TreatPrefs> = {}, locale: "en" | "fi" = "en", failed = false) =>
    renderToStaticMarkup(
      createElement(ResultView, {
        locale,
        meta: realMeta,
        prefs: { ward: "URO", specimen: "urine", sex: null, severity: "mild", ...p },
        data,
        failed,
        min: 30,
      }),
    );

  it("leads with the top suggestion and says how much of everything that grows it covers", () => {
    const html = view(response(pool(100), "URO", "mild"));
    expect(html).toContain("Based on 100 first isolates");
    expect(html).toContain("Mecillinam");
    expect(html).toContain("Covers 80% of everything that grows here");
    expect(html).toContain("Of the bacteria it is meant for");
    expect(html).toContain("Last 4 weeks on this unit");
    expect(html).toContain("Demo: the organisers&#x27; synthetic Tyks dataset");
    expect(html).toContain("Does not cover");
    expect(html).not.toContain("Vancomycin"); // not offered for urine
  });

  it("says when the figures come from units like this one", () => {
    const html = view(response(pool(100), "MED-A", "mild"), { ward: "MED-A" });
    expect(html).toContain("so the figures are from all inpatient units");
  });

  it("shows an error, and a calm empty state, instead of numbers it does not have", () => {
    expect(view(null, {}, "en", true)).toContain("could not be loaded");
    expect(view(response([], "URO", "mild"))).toContain("No results for these patients yet");
  });

  it("renders in Finnish", () => {
    const html = view(response(pool(100), "URO", "mild"), {}, "fi");
    expect(html).toContain("Perustuu");
    expect(html).toContain("kaikista täällä kasvaneista bakteereista");
    expect(html).toContain("Niistä bakteereista, joihin se on tarkoitettu");
    expect(html).toContain("Viimeiset 4 viikkoa tässä yksikössä");
    expect(html).toContain("Demo: järjestäjien synteettinen Tyks-aineisto");
  });
});

describe("TreatScreen", () => {
  const render = (props: Partial<Parameters<typeof TreatScreen>[0]>) =>
    renderToStaticMarkup(
      createElement(TreatScreen, {
        locale: "en",
        meta,
        results: results(80),
        asOf: "2024-11-30",
        signals: [],
        prefs,
        onPrefs: () => {},
        onOpenSignal: () => {},
        ...props,
      }),
    );

  it("shows the unit's recent signals as plain lines, at most two, then a link to the rest", () => {
    const html = render({
      signals: [signal({ id: "a" }), signal({ id: "b" }), signal({ id: "c", kind: "data-gap", severity: "medium" })],
    });
    expect(html).toContain("Possible cluster of");
    expect(html).toContain("+1 more alert");
  });

  it("offers severity and sex, not age, onset or a bacterium filter", () => {
    const html = render({});
    expect(html).toContain("Mild or moderate");
    expect(html).toContain("Severe");
    expect(html).not.toContain("Under 65");
    expect(html).not.toContain("Not known yet");
  });
});
