import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Signal } from "../../engine/types.ts";
import type { FeedMeta, Result } from "../../feed/types.ts";
import { TreatScreen, type TreatPrefs } from "./index.tsx";
import { capFirst, hasDetails, humanize, midSentence, queryOf, sexesIn, signalsFor, unitGroups } from "./model.ts";
import { whoPhrase } from "./text.tsx";

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

const prefs: TreatPrefs = { ward: "W1", specimen: "sp1", sex: null, age: null, onset: null, organism: null };

function signal(over: Partial<Signal>): Signal {
  return {
    id: "x",
    kind: "cluster",
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
  it("drops onset on a unit without admissions and keeps only set filters", () => {
    expect(queryOf(meta, { ...prefs, onset: "hospital" })).toEqual({ ward: "W1", specimen: "sp1", onset: "hospital" });
    expect(queryOf(meta, { ...prefs, ward: "C1", onset: "hospital", sex: "F" })).toEqual({ ward: "C1", specimen: "sp1", sex: "F" });
    expect(hasDetails(prefs)).toBe(false);
    expect(hasDetails({ ...prefs, organism: "Genus alpha" })).toBe(true);
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
    expect(whoPhrase("en", { ward: "W1", specimen: "sp1", sex: "M", age: "65plus" })).toBe("men 65+");
    expect(whoPhrase("en", { ward: "W1", specimen: "sp1", age: "under65" })).toBe("patients under 65");
    expect(whoPhrase("en", { ward: "W1", specimen: "sp1" })).toBeNull();
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
        rank: "access-first",
        ...props,
      }),
    );

  it("answers with no input: basis, top match and the rest, never a screening test", () => {
    const html = render({});
    expect(html).toContain("Based on");
    expect(html).toContain("Best match here");
    expect(html).toContain("Alphacillin");
    expect(html).toContain("Betamycin");
    expect(html).not.toContain("Screen test");
    // Phones (and the server render): unit and site above the answer, the optional details behind "Patient".
    expect(html).toContain("treat-bar");
    expect(html).toContain("Patient");
    expect(html.indexOf("treat-bar")).toBeLessThan(html.indexOf("Best match here"));
  });

  it("says when the group was widened and never shows a percentage from too few", () => {
    const html = render({ results: [...results(10), ...results(60, "W2")] });
    expect(html).toContain("Left out the unit");
    expect(html).toContain("from all units");
  });

  it("shows a calm empty state when nothing matches", () => {
    const html = render({ prefs: { ...prefs, specimen: "sp2" } });
    expect(html).toContain("No results for these patients yet");
  });

  it("shows the unit's recent signals as plain lines, at most two, then a link to the rest", () => {
    const html = render({
      signals: [signal({ id: "a" }), signal({ id: "b" }), signal({ id: "c", kind: "data-gap", severity: "medium" })],
    });
    expect(html).toContain("Possible cluster of");
    expect(html).toContain("+1 more alert");
  });

  it("renders in Finnish", () => {
    const html = render({ locale: "fi" });
    expect(html).toContain("Perustuu");
    expect(html).toContain("Paras vaihtoehto täällä");
  });
});
