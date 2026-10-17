import type { AeiClient, CountiesResponse, RegionalData } from "@aei/contract";
import { regionalUpTo } from "@aei/contract";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BoardState } from "../board.ts";
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
const loaded = vi.hoisted(() => ({ regional: {} as object, counties: {} as object }));
vi.mock("./useLoad.ts", () => ({
  useLoad: (_load: unknown, deps: unknown[]) => ({ state: "ok", data: deps.length === 1 ? loaded.counties : loaded.regional }),
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
