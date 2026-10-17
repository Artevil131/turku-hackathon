import type { AeiClient, CountiesResponse, RegionalData } from "@aei/contract";
import { regionalUpTo } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardState } from "../board.ts";
import { CountyDetail } from "./CountyDetail.tsx";
import { CountyForecasts } from "./CountyForecasts.tsx";
import { GeoMap } from "./GeoMap.tsx";

const state: BoardState = { panel: "geo", weeks: 12, unit: null, kinds: [], phenotype: null, incident: null, focus: null };
const onChange = () => {};
const home = "Varsinais-Suomen hyvinvointialue";
const data: RegionalData = {
  source: "THL",
  fetched: "2026-10-17",
  settings: { firstTarget: "2024-01", baseline: 36, alpha: 0.001, minCases: 5, familyAlpha: 0.05, testedSeriesMonths: 1 },
  months: ["2026-09"],
  groups: ["MRSA carriage"],
  regions: [home, "Other"],
  series: [home, "Other"].map((region) => ({ group: "MRSA carriage", region, cases: [10], incidencePer100k: [1] })),
  signals: [],
  forecasts: [
    { phenotype: "MRSA", region: home, month: "2026-10", mean: 10.5, low: 3, high: 22, level: 0.9 },
    { phenotype: "ESBL", region: home, month: "2026-10", mean: 25, low: 10, high: 40, level: 0.9 },
    { phenotype: "CPE", region: "Other", month: "2026-10", mean: 2, low: 0, high: 5, level: 0.9 },
  ],
};
const counties: CountiesResponse = {
  type: "FeatureCollection",
  features: [home, "Other"].map((name) => ({
    type: "Feature",
    properties: { nimi: name, name, hyvinvointialue: "1" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [22, 60],
          [23, 60],
          [23, 61],
          [22, 60],
        ],
      ],
    },
  })),
};
const loaded = vi.hoisted(() => ({ regional: {} as object, counties: {} as object, chosen: null as string | null }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === null ? loaded.chosen : initial) };
});
beforeEach(() => {
  loaded.chosen = null;
});
vi.mock("./useLoad.ts", () => ({
  useLoad: (_load: unknown, deps: unknown[]) =>
    deps.length === 3 ? { state: "ok", data: null } : { state: "ok", data: deps.length === 1 ? loaded.counties : loaded.regional },
}));

describe("phenotype-total county forecasts", () => {
  it("shows the home county and county list in the redesigned map in both languages", () => {
    loaded.regional = regionalUpTo(data, "2026-10-17");
    loaded.counties = counties;
    for (const locale of ["en", "fi"] as const) {
      const html = renderToStaticMarkup(
        <GeoMap state={state} onChange={onChange} client={{} as AeiClient} locale={locale} asOf="2026-10-17" reducedMotion />,
      );
      expect(html).toContain(locale === "en" ? "Varsinais-Suomi · forecast" : "Varsinais-Suomi · ennuste");
      expect(html).toContain(locale === "en" ? "Next month: about 11 (range 3–22)" : "Ensi kuussa: noin 11 (vaihteluväli 3–22)");
      expect(html).toContain(locale === "en" ? "ESBL total:" : "ESBL yhteensä:");
      expect(html).toContain("D-045");
      expect(html).toContain(locale === "en" ? "90% predictive range" : "90 %:n ennusteväli");
      expect(html).toContain(locale === "en" ? "Next month: about 2 (range 0–5)" : "Ensi kuussa: noin 2 (vaihteluväli 0–5)");
    }
  });

  it("renders only the chosen county's forecasts in its detail", () => {
    const html = renderToStaticMarkup(<CountyForecasts forecasts={data.forecasts} region="Other" locale="en" />);
    expect(html).toContain("CPE total:");
    expect(html).not.toContain("MRSA total:");
    expect(html).not.toContain("ESBL total:");
  });

  it("does not show latest-fit forecasts at an earlier replay cut or invent missing ones", () => {
    loaded.regional = regionalUpTo(data, "2026-09-30");
    loaded.counties = counties;
    const html = renderToStaticMarkup(
      <GeoMap state={state} onChange={onChange} client={{} as AeiClient} locale="en" asOf="2026-09-30" reducedMotion />,
    );
    expect(html).not.toContain("Next month:");
    expect(html).not.toContain("D-045");
    expect(renderToStaticMarkup(<CountyForecasts forecasts={[]} region={home} locale="fi" />)).toBe("");
  });
});

describe("visible county detail", () => {
  const signal = {
    group: "CPE carriage, E. coli",
    region: home,
    month: "2026-08",
    cases: 20,
    expected: 2.5,
    dispersion: 1,
    p: 0.0001,
    strong: true,
  };

  it("replaces the map rather than appearing beneath its fixed-height stage", () => {
    loaded.chosen = home;
    loaded.counties = counties;
    loaded.regional = regionalUpTo(
      { ...data, signals: [{ ...signal, group: "MRSA carriage", p: 0.00001, strong: false }, signal] },
      "2026-10-17",
    );
    for (const locale of ["en", "fi"] as const) {
      const html = renderToStaticMarkup(
        <GeoMap state={state} onChange={onChange} client={{} as AeiClient} locale={locale} asOf="2026-10-17" reducedMotion />,
      );
      expect(html).toContain('aria-labelledby="geo-county-title"');
      expect(html).toContain(locale === "en" ? "County · Varsinais-Suomen" : "Alue · Varsinais-Suomen");
      expect(html).toContain(locale === "en" ? "Back to map" : "Takaisin kartalle");
      expect(html).toContain(locale === "en" ? "CPE carriage, E. coli" : "CPE-kantajuus, E. coli");
      expect(html).toContain(locale === "en" ? "August 2026" : "elokuu 2026");
      expect(html).toContain(locale === "en" ? "20 vs 2.5 expected" : "20, odotettu 2,5");
      expect(html).toContain(locale === "en" ? "Filled marker:" : "Täytetty merkki:");
      expect(html).toContain(locale === "en" ? "Forecast · phenotype totals" : "Ennuste · fenotyypit yhteensä");
      expect(html).toContain(locale === "en" ? "90% predictive range" : "90 %:n ennusteväli");
      expect(html).toContain(locale === "en" ? "VRE: no forecast" : "VRE: ei ennustetta");
      expect(html).not.toContain('class="geo-stage"');
      expect(html).not.toContain('class="geo-overlay-card"');
    }
  });

  it("explains hollow signals, absent forecasts, and provides close and Escape actions", () => {
    const onClose = vi.fn();
    const detail = CountyDetail({
      region: home,
      signal: { ...signal, strong: false },
      groupLabel: "CPE carriage, E. coli",
      forecasts: [],
      locale: "en",
      onClose,
      headingRef: null,
    });
    const html = renderToStaticMarkup(detail);
    expect(html).toContain("Hollow marker: does not survive correction; may be chance.");
    expect(html).toContain("No forecast at this replay month");
    expect(html).toContain('tabindex="-1"');
    detail.props.onKeyDown({ key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    const header = detail.props.children[0];
    header.props.children[1].props.onClick();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
