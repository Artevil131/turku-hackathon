import type { CoverageResponse, Severity } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coverage, suggest, suggestCombinations } from "../../../../../libs/utils/coverage/src/index.ts";
import { CoverageList, itemsOf } from "./CoverageList.tsx";
import { DEFAULTS, filtersFromUrl, filtersToParams } from "./filters.ts";
import { RecordStrip } from "./RecordStrip.tsx";

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

describe("age group and onset filters (D-047)", () => {
  it("reads and writes them in the URL, dropping unknown values", () => {
    const parsed = filtersFromUrl(new URLSearchParams("age=older&onset=hospital"));
    expect(parsed.age).toBe("older");
    expect(parsed.onset).toBe(true);
    expect(filtersFromUrl(new URLSearchParams("age=old&onset=1"))).toMatchObject({ age: "any", onset: false });
    expect(filtersToParams({ ...filters, age: "veryOld", onset: true })).toMatchObject({ age: "veryOld", onset: "hospital" });
    expect(filtersToParams(filters)).toMatchObject({ age: null, onset: null });
  });
  it("keeps the severe blood shortcut visible outside collapsed phone filters", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const html = renderToStaticMarkup(<RecordStrip locale="fi" filters={{ ...filters, age: "older", onset: true }} onChange={() => {}} />);
    expect(html).toContain("Vaikea veri-infektio");
    expect(html).toContain("ikäryhmä 65+");
    expect(html).not.toContain("Hoitopäivä 3 tai myöhemmin");
  });
  it("enables every control on desktop and marks the chosen ones", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const html = renderToStaticMarkup(<RecordStrip locale="en" filters={{ ...filters, age: "older", onset: true }} onChange={() => {}} />);
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("not applied");
    expect(html).toMatch(/aria-pressed="true"[^>]*>65\+/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Day 3\+/);
  });
  it("says when the server dropped a filter to keep the unit's own data", () => {
    // 40 isolates on the unit, 10 of them 65+: the age group is dropped, the unit kept.
    const records = Array.from({ length: 40 }, (_, i) => record(i, { ageYears: i < 10 ? 70 : 40 }));
    const result = coverage(records, { asOf: "2026-06-30", ward: "URO", specimen: "urine", ageGroup: "older" });
    expect(result.ageGroupApplied).toBe(false);
    const data = { ...response(records), coverage: result };
    const sheet = renderToStaticMarkup(
      <CoverageList
        locale="en"
        filters={{ ...filters, age: "older" }}
        asOf={data.asOf}
        status="ready"
        data={data}
        signals={[]}
        selected={null}
        onSelect={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(sheet).toContain("Age group filter dropped to keep the unit&#x27;s own data.");
  });
});
