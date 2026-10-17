import type { CountiesResponse, RegionalResponse } from "@aei/contract";
import type { Locale } from "@aei/i18n";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelProps } from "../board.ts";
import { GeoMap } from "./GeoMap.tsx";
import { UnitGraph } from "./UnitGraph.tsx";
import { useLoad } from "./useLoad.ts";

vi.mock("./useLoad.ts", () => ({ useLoad: vi.fn() }));
const county = "Varsinais-Suomen hyvinvointialue";
const counties: CountiesResponse = {
  type: "FeatureCollection",
  features: [county, "Pirkanmaan hyvinvointialue"].map((name) => ({
    type: "Feature",
    properties: { hyvinvointialue: "01", nimi: name, name },
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
const regional = {
  asOf: "2026-10-17",
  months: ["2026-09"],
  groups: ["MRSA carriage"],
  series: [{ group: "MRSA carriage", region: county, cases: [12], incidencePer100k: [2] }],
  signals: [],
} as unknown as RegionalResponse;
const props = (locale: Locale): PanelProps => ({
  client: {} as PanelProps["client"],
  locale,
  asOf: regional.asOf,
  reducedMotion: true,
  state: { panel: "geo", weeks: 12, unit: null, kinds: [], phenotype: null, incident: null, focus: null },
  onChange: vi.fn(),
});

beforeEach(() => vi.mocked(useLoad).mockReset());

describe("map source labels and initial county", () => {
  it.each(["fi", "en"] as const)("opens on the map and identifies the three sources (%s)", (locale) => {
    vi.mocked(useLoad)
      .mockReturnValue({ state: "loading", fetching: true })
      .mockReturnValueOnce({ state: "ok", data: counties, fetching: false })
      .mockReturnValueOnce({ state: "ok", data: regional, fetching: false });
    const html = renderToStaticMarkup(<GeoMap {...props(locale)} />);
    expect(html).toContain(locale === "fi" ? "Alueellinen tilanne · THL, avoin data" : "Regional picture · THL open data");
    expect(html).toContain(locale === "fi" ? "hoitoketju (kaavio, ei potilasdataa)" : "referral chain (diagram, not patient data)");
    expect(html).toContain("CC BY 4.0");
    expect(html).toContain('aria-label="Pirkanmaan"');
    expect(html).not.toContain('data-selected="true"');
  });
  it.each(["fi", "en"] as const)("labels the separate Tyks unit view as synthetic hospital data (%s)", (locale) => {
    vi.mocked(useLoad).mockReturnValue({ state: "loading", fetching: true });
    const html = renderToStaticMarkup(<UnitGraph {...props(locale)} />);
    expect(html).toContain(
      locale === "fi" ? "Tyks · sairaalan oma aineisto (demossa synteettinen)" : "Tyks · hospital&#x27;s own data (synthetic in the demo)",
    );
  });
});
