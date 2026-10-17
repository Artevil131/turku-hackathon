import type { CoverageResponse, Severity } from "@aei/contract";
import type { IsolateRecord } from "@aei/domain";
import { guide } from "@aei/guideline";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coverage, suggest, suggestCombinations } from "../../../../../libs/utils/coverage/src/index.ts";
import { CoverageList, itemsOf } from "./CoverageList.tsx";
import { Details } from "./Details.tsx";
import { barOf, chooseSyndrome, coverageQuery, DEFAULTS, filtersFromUrl, filtersToParams, patchFilters, syndromeOf } from "./filters.ts";
import { RecordStrip } from "./RecordStrip.tsx";
import { SyndromePicker } from "./SyndromePicker.tsx";
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
function list(data: CoverageResponse, locale: "fi" | "en" = "fi", extra: Partial<ComponentProps<typeof CoverageList>> = {}) {
  return renderToStaticMarkup(
    <CoverageList
      {...extra}
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

describe("syndrome chooser (D-047)", () => {
  it("sets specimen, severity, onset and sex from the guide and travels as syn=", () => {
    const healthcare = syndromeOf("sepsis-healthcare");
    const cystitis = syndromeOf("cystitis-woman");
    if (!healthcare || !cystitis) throw new Error("guide must carry both syndromes");
    const chosen = chooseSyndrome({ ...filters, sex: "M" }, healthcare);
    expect(chosen).toMatchObject({ syn: "sepsis-healthcare", site: "blood", sev: "severe", onset: true, sex: "M" });
    expect(chooseSyndrome(chosen, cystitis)).toMatchObject({ syn: "cystitis-woman", site: "urine", sev: "mild", onset: false, sex: "F" });
    expect(filtersToParams(chosen).syn).toBe("sepsis-healthcare");
    expect(filtersFromUrl(new URLSearchParams("syn=sepsis-healthcare")).syn).toBe("sepsis-healthcare");
    expect(filtersFromUrl(new URLSearchParams("syn=nonsense")).syn).toBeNull();
    // Tapping the chosen chip again clears it; the filters stay.
    expect(chooseSyndrome(chosen, healthcare)).toEqual({ ...chosen, syn: null });
  });
  it("clears when the specimen changes and survives other changes", () => {
    const chosen = chooseSyndrome(filters, syndromeOf("pyelonephritis") ?? null);
    expect(patchFilters(chosen, { sev: "mild", sex: "F", period: 28 }).syn).toBe("pyelonephritis");
    expect(patchFilters(chosen, { site: "urine" }).syn).toBe("pyelonephritis");
    expect(patchFilters(chosen, { site: "blood" }).syn).toBeNull();
  });
  it("renders one chip per syndrome grouped by specimen, the chosen one pressed", () => {
    const html = renderToStaticMarkup(<SyndromePicker locale="en" value="pyelonephritis" onPick={() => {}} />);
    expect(html.match(/class="sp-chip"/g)).toHaveLength(guide().syndromes.length);
    expect(html.indexOf('aria-label="urine"')).toBeLessThan(html.indexOf('aria-label="blood"'));
    expect(html).toMatch(/aria-pressed="true"[^>]*>Pyelonephritis</);
  });
});

/** Urine isolates with results for the cystitis drugs and ciprofloxacin. */
const urine = () =>
  response(
    Array.from({ length: 60 }, (_, i) => record(i, { results: { MEC: "S", NIT: i < 55 ? "S" : "R", TMP: i < 40 ? "S" : "R", CIP: "S" } })),
  );
const rowOf = (html: string, id: string) => {
  const at = html.indexOf(`data-row="${id}"`);
  return at < 0 ? "" : html.slice(at, html.indexOf("</button>", at));
};

describe("guide beside the data (D-047)", () => {
  it("marks the guide's first choices, gives each its line, and keeps the order", () => {
    const data = urine();
    const html = list(data, "en", { syndrome: syndromeOf("cystitis-woman") });
    for (const code of ["MEC", "NIT", "TMP"]) expect(rowOf(html, code)).toContain('class="cl-guide"');
    expect(rowOf(html, "CIP")).not.toContain('class="cl-guide"');
    expect(html).toContain(
      "Mikrobilääkesuositus (Varsinais-Suomen hyvinvointialue), 13.4.2026, p. 37: first choice nitrofurantoin covers 92 % here (bar 80 %)",
    );
    expect(html).toContain('href="https://hoito-ohjeet.fi/');
    expect(html).toContain('target="_blank"');
    const order = [...html.matchAll(/data-row="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(itemsOf(data, "en").singles.map((i) => i.id));
  });
  it("names the guide's drugs the laboratory does not test", () => {
    const html = list(urine(), "en", { syndrome: syndromeOf("cystitis-man") });
    expect(html).toContain("also named: sulfamethoxazole-trimethoprim, fosfomycin (not in this laboratory&#x27;s panel)");
  });
  it("shows nothing guide-related without a syndrome", () => {
    const html = list(urine(), "en");
    expect(html).not.toContain("cl-guide");
    expect(html).not.toContain("hoito-ohjeet.fi");
  });
  it("adds the guide's dose, route and duration to a marked row's details", () => {
    const data = urine();
    const item = itemsOf(data, "en").singles.find((i) => i.id === "NIT");
    if (!item) throw new Error("fixture must carry nitrofurantoin");
    const html = renderToStaticMarkup(
      <Details
        client={{} as never}
        locale="en"
        filters={filters}
        data={data}
        item={item}
        signals={[]}
        syndrome={syndromeOf("cystitis-woman")}
      />,
    );
    expect(html).toContain("The guide (7.4.1 A, p. 37) names: nitrofurantoin 75 mg × 2 po");
    expect(html).toContain("route: oral");
    expect(html).toContain("Duration: 3 days.");
  });
});
