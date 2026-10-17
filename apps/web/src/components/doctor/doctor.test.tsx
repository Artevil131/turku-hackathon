import type { CoverageResponse, Severity } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coverage, suggest, suggestCombinations } from "../../../../../libs/utils/coverage/src/index.ts";
import { CoverageList, itemsOf } from "./CoverageList.tsx";
import { barOf, coverageQuery, DEFAULTS, filtersFromUrl, filtersToParams } from "./filters.ts";
import { RecordStrip } from "./RecordStrip.tsx";
import { UnitContext } from "./UnitContext.tsx";

const filters = { ...DEFAULTS, unit: "URO" as const };
const record = (i: number, patch: Partial<IsolateRecord> = {}): IsolateRecord => ({
  isolateId: `C${i}-1`,
  cultureId: `C${i}`,
  patientId: `P${i}`,
  sampleDate: "2026-06-01",
  admissionDate: null,
  ward: "URO",
  specimen: "urine",
  organism: "Escherichia coli",
  sex: "F",
  ageYears: 60,
  homeArea: "North",
  phenotypes: [],
  results: { MEC: "S" },
  ...patch,
});
function response(records: IsolateRecord[], severity: Severity = "mild"): CoverageResponse {
  const result = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: severity === "mild" ? "urine" : "blood" });
  return {
    asOf: "2026-06-30",
    severity,
    coverage: result,
    suggestions: suggest(result, severity),
    combinationSuggestions: suggestCombinations(result, severity),
  };
}
function list(data: CoverageResponse, locale: "fi" | "en" = "fi") {
  return renderToStaticMarkup(
    <CoverageList
      locale={locale}
      filters={{ ...filters, sev: data.severity }}
      asOf={data.asOf}
      status="ready"
      data={data}
      signals={[]}
      selected={null}
      onSelect={() => {}}
      onRetry={() => {}}
    />,
  );
}

afterEach(() => vi.unstubAllGlobals());
describe("doctor list disclosure", () => {
  it("puts both denominators on the unopened mild row, preserving API ranking", () => {
    const data = response(
      Array.from({ length: 190 }, (_, i) =>
        record(i, i < 150 ? { results: { MEC: i < 143 ? "S" : "R" } } : { organism: "Enterococcus faecalis", results: {} }),
      ),
    );
    const html = list(data);
    const row = html.slice(html.indexOf('data-row="MEC"'), html.indexOf("</button>", html.indexOf('data-row="MEC"')));
    expect(row).toMatch(/kattavuusalueella.*95 %/);
    expect(row).toMatch(/kaikki bakteerit.*75 %/);
    expect(row).toContain("Tiedot");
    expect(html).not.toContain('class="info-btn cl-info"');
    expect(itemsOf(data, "fi").singles.map((item) => item.id)).toEqual(data.suggestions.map((item) => item.antibiotic));
    expect(list(data, "en")).toContain("within spectrum");
    expect(list(data, "en")).toContain("all organisms");
    expect(list(data, "en")).toContain("365 days");
    expect(list(data, "en")).toContain("not the chance treatment works");
  });
  it("explains a borderline row and its interval without a popover", () => {
    const data = response(
      Array.from({ length: 65 }, (_, i) => record(i, { specimen: "blood", results: { CIP: i < 60 ? "S" : "R" } })),
      "severe",
    );
    expect(list(data)).toContain("92 %</b> (83–97 %)");
    expect(list(data)).toContain("rajaa arvioidaan 95 %:n välin alapään mukaan, ja se on 83 %.");
  });
  it("leads with the first API-ranked pair when no severe single clears", () => {
    const data = response(
      Array.from({ length: 65 }, (_, i) =>
        record(i, {
          specimen: "blood",
          ...(i < 45 ? { results: { MEM: "S" } } : { organism: "Staphylococcus aureus", results: { FOX: "R", VAN: "S" } }),
        }),
      ),
      "severe",
    );
    expect(data.combinationSuggestions[0]?.coverage.share).toBe(1);
    const html = list(data);
    expect(html.indexOf("Yksikään antibiootti ei yksin")).toBeLessThan(html.indexOf('class="cl-scroll"'));
    expect(html).toContain("100 %, n 65 — tiedot");
    expect(html).toContain("Synteettinen demoaineisto · ei potilashoitoon");
    expect(html).toContain("Tukee päätöstä; lääkäri päättää.");
    const first = data.combinationSuggestions[0];
    if (!first) throw new Error("fixture must include a pair");
    const borderline = {
      ...data,
      combinationSuggestions: [
        {
          ...first,
          standing: "borderline" as const,
          coverage: { ...first.coverage, share: 0.92, interval: [0.83, 0.97] as [number, number] },
        },
      ],
    };
    const summary = list(borderline).split('class="cl-pair-summary"')[1]?.split('class="cl-scroll"')[0];
    expect(summary).toContain("arvio ylittää, väli ei");
    expect(summary).toContain("83–97 %");
  });
});

describe("onset (D-049)", () => {
  it("travels in the URL as onset=hospital and in the query only when on", () => {
    expect(filtersFromUrl(new URLSearchParams("onset=hospital")).onset).toBe(true);
    expect(filtersFromUrl(new URLSearchParams("onset=1")).onset).toBe(false);
    expect(filtersToParams({ ...filters, onset: true }).onset).toBe("hospital");
    expect(filtersToParams(filters)).toMatchObject({ onset: null, age: null });
    expect(coverageQuery({ ...filters, onset: true })).toMatchObject({ onset: "hospital" });
    expect("onset" in coverageQuery(filters)).toBe(false);
  });
  it("labels the list with the bar the response used", () => {
    const data = response(Array.from({ length: 40 }, (_, i) => record(i)));
    expect(barOf(data, filters)).toBe(80);
    const hospital = { ...data, bar: 0.9 };
    expect(barOf(hospital, { ...filters, onset: true })).toBe(90);
    expect(list(hospital)).toContain("raja 90 %");
    expect(barOf(null, { sev: "mild", onset: true })).toBe(90);
  });
  it("chips the ladder when the onset filter was dropped", () => {
    const data = response(Array.from({ length: 40 }, (_, i) => record(i)));
    const dropped = { ...data, bar: 0.9, coverage: { ...data.coverage, onsetApplied: false } };
    const html = renderToStaticMarkup(
      <UnitContext
        client={{} as never}
        locale="en"
        filters={{ ...filters, onset: true }}
        asOf={data.asOf}
        data={dropped}
        signals={[]}
        status="ready"
        onRetry={() => {}}
        onOpenSignals={() => {}}
      />,
    );
    expect(html).toContain("onset filter dropped to keep the unit&#x27;s data; bar still 90 %");
  });
});

describe("available filters", () => {
  it("keeps the severe blood shortcut visible outside collapsed phone filters", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const html = renderToStaticMarkup(<RecordStrip locale="fi" filters={filters} onChange={() => {}} />);
    expect(html).toContain("Vaikea veri-infektio");
  });
  it("offers onset live and no control that is not applied", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const html = renderToStaticMarkup(<RecordStrip locale="en" filters={{ ...filters, onset: true }} onChange={() => {}} />);
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("not applied");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Day 3\+/);
    expect(html).toContain("mild 90");
  });
});
