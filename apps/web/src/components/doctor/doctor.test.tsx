import type { CoverageResponse, NationalResponse, PatientFindingsResponse, Severity } from "@aei/contract";
import type { AntibioticCode, IsolateRecord } from "@aei/domain";
import { guide } from "@aei/guideline";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { coverage, suggest, suggestCombinations } from "../../../../../libs/utils/coverage/src/index.ts";
import { CoverageList, itemsOf } from "./CoverageList.tsx";
import { Details } from "./Details.tsx";
import { DoctorAnswer } from "./DoctorAnswer.tsx";
import {
  barOf,
  chooseSyndrome,
  coverageQuery,
  DEFAULTS,
  doctorParamsToWindow,
  filtersFromUrl,
  filtersToParams,
  patchFilters,
  syndromeOf,
} from "./filters.ts";
import { PatientPanel } from "./Patient.tsx";
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
    // One big figure, the own-spectrum share of the year; the all-organism share and both n are in the details.
    expect(row).toMatch(/<b>95\u00a0%<\/b>/);
    expect(row).not.toContain("75\u00a0%");
    expect(row).not.toContain("n 190");
    expect(row).toContain("kattavuusalueella · vuosi");
    expect(row).toContain("kaikki bakteerit");
    expect(row).toContain("Tiedot");
    expect(html).not.toContain('class="info-btn cl-info"');
    expect(itemsOf(data, "fi").singles.map((item) => item.id)).toEqual(data.suggestions.map((item) => item.antibiotic));
    expect(list(data, "en")).toContain("within spectrum · year");
    expect(list(data, "en")).toContain("not the chance treatment works");
  });
  it("switches the row's figure, plot and basis with the judge-on toggle", () => {
    const data = response(
      Array.from({ length: 190 }, (_, i) =>
        record(i, i < 150 ? { results: { MEC: i < 143 ? "S" : "R" } } : { organism: "Enterococcus faecalis", results: {} }),
      ),
    );
    const bold = (html: string) => rowOf(html, "MEC").match(/<b>(\d+)\u00a0%<\/b>/)?.[1];
    const point = (html: string) => rowOf(html, "MEC").match(/class="cl-point" style="left:([\d.]+)%/)?.[1];
    const pressed = (html: string) =>
      [...html.matchAll(/<button type="button" aria-pressed="(true|false)">([^<]+)<\/button>/g)].map((m) => `${m[2]}=${m[1]}`);
    const on = { onJudge: () => {} };
    // Mild defaults to the antibiotic's own spectrum.
    const own = list(data, "en", on);
    expect(pressed(own)).toEqual(["its own spectrum=true", "everything that grows here=false"]);
    expect(bold(own)).toBe("95");
    // Everything that grows here: the figure and the dot move to the all-organism share; the tick stays on the judged basis.
    const all = renderToStaticMarkup(
      <CoverageList
        locale="en"
        filters={{ ...filters, sev: "mild", judge: "all" }}
        asOf={data.asOf}
        status="ready"
        data={data}
        signals={[]}
        selected={null}
        onSelect={() => {}}
        onRetry={() => {}}
        onJudge={() => {}}
      />,
    );
    expect(pressed(all)).toEqual(["its own spectrum=false", "everything that grows here=true"]);
    expect(bold(all)).toBe("75");
    expect(point(all)).not.toBe(point(own));
    expect(all).toContain("The order stays judged on its own spectrum; the figure and its mark follow your choice.");
    expect(own).not.toContain("The order stays judged");
    // The mark follows the figure: 95 % within spectrum clears the 80 % bar, 75 % over everything does not.
    const mark = (html: string) => rowOf(html, "MEC").match(/class="cl-res" data-standing="([^"]+)"/)?.[1];
    expect(mark(own)).toBe("clears");
    expect(mark(all)).toBe("below");
    expect(rowOf(all, "MEC")).toContain('class="cl-row" data-standing="below"');
    // The below-the-bar divider belongs to the judged basis only.
    expect(all).not.toContain("data-divider");
    // Severe starts on everything, the basis the answer card judges on.
    const severe = response(
      Array.from({ length: 65 }, (_, i) => record(i, { specimen: "blood", results: { CIP: i < 60 ? "S" : "R" } })),
      "severe",
    );
    expect(pressed(list(severe, "en", on))).toEqual(["its own spectrum=false", "everything that grows here=true"]);
  });
  it("shows the last four weeks on the row as a count, k / n", () => {
    const data = response(
      Array.from({ length: 60 }, (_, i) =>
        record(i, { sampleDate: i < 20 ? "2026-06-20" : "2026-06-01", results: { MEC: i < 18 || i >= 20 ? "S" : "R" } }),
      ),
    );
    const row = rowOf(list(data, "en"), "MEC").replace(/<[^>]+>/g, "");
    expect(row).toMatch(/last 4 weeks \(all organisms\) 18 \/ 20/);
    expect(row.match(/%/g)).toHaveLength(1);
  });
  it("explains a borderline row and its interval without a popover", () => {
    const data = response(
      Array.from({ length: 65 }, (_, i) => record(i, { specimen: "blood", results: { CIP: i < 60 ? "S" : "R" } })),
      "severe",
    );
    expect(list(data)).toContain("<b>92\u00a0%</b>");
    expect(list(data)).toContain("kaikki bakteerit · vuosi");
    // The interval and the sentence about it live in the details, not in the row.
    const row = rowOf(list(data), "CIP");
    expect(row).not.toContain("83–97");
    expect(row).not.toContain("rajaa arvioidaan");
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
    expect(html).toContain("100\u00a0%, n 65 — tiedot");
    // The one disclaimer is in the answer card (DoctorAnswer); the list keeps its data checks one click away.
    expect(html).toContain("<summary>Datatarkistukset</summary>");
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
    expect(summary).toContain("aivan rajalla");
    expect(summary).toContain("83–97\u00a0%");
  });
});

describe("legacy doctor deep links", () => {
  it("namespaces every doctor filter without carrying workspace or private patient params", () => {
    const params = new URLSearchParams(
      "unit=URO&site=blood&sex=F&age=older&onset=hospital&sev=severe&period=28&syn=sepsis&hospital=sata&panel=grid&patient=P123",
    );
    const before = params.toString();
    expect(doctorParamsToWindow(params)).toEqual({
      "cov.unit": "URO",
      "cov.site": "blood",
      "cov.sex": "F",
      "cov.age": "older",
      "cov.onset": "hospital",
      "cov.sev": "severe",
      "cov.period": "28",
      "cov.syn": "sepsis",
    });
    expect(params.toString()).toBe(before);
    expect(doctorParamsToWindow(new URLSearchParams())).toEqual({});
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
  it("states the single hospital-onset bar once instead of two severity numbers", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const on = renderToStaticMarkup(<RecordStrip locale="en" filters={{ ...filters, onset: true }} onChange={() => {}} />);
    expect(on).toContain("Hospital onset: judged against 90\u00a0% whatever the severity.");
    expect(on).toMatch(/data-value="mild"[^>]*>mild</);
    expect(on).toMatch(/data-value="severe"[^>]*>severe</);
    const off = renderToStaticMarkup(<RecordStrip locale="en" filters={filters} onChange={() => {}} />);
    expect(off).not.toContain('role="note"');
    expect(off).toMatch(/data-value="mild"[^>]*>mild 80/);
  });
  it("shows age group and onset in the collapsed phone summary", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const html = renderToStaticMarkup(<RecordStrip locale="fi" filters={{ ...filters, age: "older", onset: true }} onChange={() => {}} />);
    expect(html).toContain("ikäryhmä 65+");
    expect(html).not.toContain("Hoitopäivä 3 tai myöhemmin");
  });
  it("enables every control on desktop and marks the chosen ones", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    const html = renderToStaticMarkup(<RecordStrip locale="en" filters={{ ...filters, age: "older", onset: true }} onChange={() => {}} />);
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("not applied");
    expect(html).toMatch(/aria-pressed="true"[^>]*>65\+/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Inpatient day 3\+/);
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
    expect(list(hospital)).toContain("raja 90\u00a0%");
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
    expect(html).toContain("onset filter dropped to keep the unit&#x27;s data; bar still 90\u00a0%");
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
  it("collapses the chips behind one control when compact", () => {
    const html = renderToStaticMarkup(<SyndromePicker locale="en" value={null} onPick={() => {}} compact />);
    expect(html).toContain("Syndrome: choose");
    expect(html).not.toContain("syn-chip");
    const chosen = renderToStaticMarkup(<SyndromePicker locale="en" value="pyelonephritis" onPick={() => {}} compact />);
    expect(chosen).toContain("Syndrome: Pyelonephritis");
  });
  it("renders one chip per syndrome grouped by specimen, the chosen one pressed", () => {
    const html = renderToStaticMarkup(<SyndromePicker locale="en" value="pyelonephritis" onPick={() => {}} />);
    expect(html.match(/class="syn-chip"/g)).toHaveLength(guide().syndromes.length);
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
      "Mikrobilääkesuositus (Varsinais-Suomen hyvinvointialue), 13.4.2026, p. 37: first choice nitrofurantoin covers 92\u00a0% here (bar 80\u00a0%)",
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

const NATIONAL: NationalResponse = {
  source: "THL Finres cube",
  licence: "CC BY 4.0, (c) THL and the FiRe laboratory network",
  fetched: "2026-10-17",
  year: 2025,
  cells: [
    { genus: "Escherichia", antibiotic: "NIT", specimen: "urine", tests: 81234, resistant: 1625, pctR: 2, interval: [1.9, 2.1] },
    { genus: "Escherichia", antibiotic: "TMP", specimen: "urine", tests: 80000, resistant: 16000, pctR: 20, interval: [19.7, 20.3] },
  ],
};
const details = (data: CoverageResponse, id: string, national: NationalResponse | null) => {
  const item = itemsOf(data, "en").singles.find((i) => i.id === id);
  if (!item) throw new Error(`fixture must carry ${id}`);
  return renderToStaticMarkup(
    <Details client={{} as never} locale="en" filters={filters} data={data} item={item} signals={[]} national={national} />,
  );
};

describe("details keep what the row dropped", () => {
  it("gives both bases with interval and n, the year and the last four weeks", () => {
    const data = response(
      Array.from({ length: 190 }, (_, i) =>
        record(i, {
          sampleDate: i < 20 ? "2026-06-20" : "2026-06-01",
          ...(i < 150 ? { results: { MEC: i < 143 ? "S" : "R" } } : { organism: "Enterococcus faecalis", results: {} }),
        }),
      ),
    );
    const item = itemsOf(data, "en").singles.find((i) => i.id === "MEC");
    if (!item) throw new Error("fixture must carry mecillinam");
    const text = renderToStaticMarkup(
      <Details client={{} as never} locale="en" filters={filters} data={data} item={item} signals={[]} />,
    ).replace(/<[^>]+>/g, "");
    expect(text).toMatch(/95\u00a0% of 150 first isolates were susceptible over the year, 95\u00a0% interval \d+ to \d+\u00a0%\./);
    expect(text).toMatch(/Within its spectrum, year95\u00a0% \(\d+–\d+\) · n 150/);
    expect(text).toMatch(/All organisms, year75\u00a0% \(\d+–\d+\) · n 190/);
    expect(text).toMatch(/All organisms, last 4 weeks\d+ \/ 20/);
    expect(text).not.toContain("±");
  });
});

describe("national line (D-048)", () => {
  it("gives Finres's genus figure with its source, and no difference sentence under 10 points", () => {
    const html = details(urine(), "NIT", NATIONAL);
    expect(html).toContain("Finland 2025, Escherichia (genus): 2\u00a0% resistant, 81,234 tests");
    expect(html).toContain("CC BY 4.0");
    expect(html).not.toContain("nationally");
  });
  it("says in words when the leading organism differs by 10 points or more", () => {
    // Trimethoprim covers 40 of 60 here: 33\u00a0% resistant against 20\u00a0% nationally.
    expect(details(urine(), "TMP", NATIONAL)).toContain("more resistance here than nationally (33\u00a0% here, 20\u00a0% in Finland)");
  });
  it("shows nothing without a national figure", () => {
    expect(details(urine(), "MEC", NATIONAL)).not.toContain("dt-national");
    expect(details(urine(), "NIT", null)).not.toContain("dt-national");
  });
});

const PATIENT: PatientFindingsResponse = {
  asOf: "2026-06-30",
  patientId: "P1",
  findings: [
    { phenotype: "esbl", date: "2025-03-12", ward: "URO", organism: "Escherichia coli", isolateId: "C1-1" },
    { phenotype: "esbl", date: "2026-02-01", ward: "MED-A", organism: "Klebsiella pneumoniae", isolateId: "C2-1" },
  ],
  affects: { esbl: ["MEC", "CIP"] },
};

describe("patient's prior finding (D-050)", () => {
  it("annotates affected rows and places them below the unaffected rows of the same standing, shares unchanged", () => {
    const data = urine();
    const before = itemsOf(data, "en").singles;
    const after = itemsOf(data, "en", PATIENT).singles;
    const standing = (items: typeof before) => items.map((i) => i.standing);
    expect(standing(after)).toEqual(standing(before));
    const clears = after.filter((i) => i.standing === "clears");
    const firstAffected = clears.findIndex((i) => i.prior);
    expect(firstAffected).toBeGreaterThan(0);
    expect(clears.slice(firstAffected).every((i) => i.prior)).toBe(true);
    expect(after.filter((i) => i.prior).map((i) => i.id)).toEqual(before.filter((i) => ["MEC", "CIP"].includes(i.id)).map((i) => i.id));
    for (const item of after) expect(item.share).toBe(before.find((b) => b.id === item.id)?.share);
    const html = list(data, "en", { patient: PATIENT });
    expect(rowOf(html, "MEC")).toContain("patient&#x27;s ESBL finding 1.2.2026: inferred resistant");
    expect(rowOf(html, "NIT")).not.toContain("cl-prior");
    expect(itemsOf(data, "en", { ...PATIENT, findings: [], affects: {} }).singles).toEqual(before);
  });
  it("lists the findings newest first with the guide's carrier rule, or says there are none", () => {
    const html = renderToStaticMarkup(
      <PatientPanel locale="en" state={{ status: "ready", response: PATIENT }} syndrome={syndromeOf("cystitis-woman") ?? null} />,
    );
    expect(html.indexOf("ESBL 1.2.2026")).toBeLessThan(html.indexOf("ESBL 12.3.2025"));
    expect(html).toContain("The guide, Acute cystitis in a woman, ESBL carrier: ESBL cystitis: by susceptibility");
    const none = renderToStaticMarkup(
      <PatientPanel locale="en" state={{ status: "ready", response: { ...PATIENT, findings: [], affects: {} } }} syndrome={null} />,
    );
    expect(none).toContain("No ESBL, MRSA, VRE or CPE finding in the past year");
    expect(renderToStaticMarkup(<PatientPanel locale="en" state={null} syndrome={null} />)).toBe("");
  });
  it("never puts the patient id in the URL", () => {
    expect(Object.keys(filtersToParams(filters))).not.toContain("patient");
  });
});

describe("answer card wording and combination headline", () => {
  const card = (
    data: CoverageResponse,
    bar = 90,
    extra: { patient?: PatientFindingsResponse; period?: 28 | 90 | 365; locale?: "en" | "fi" } = {},
  ) =>
    renderToStaticMarkup(
      <DoctorAnswer
        locale={extra.locale ?? "en"}
        filters={{ ...filters, site: data.severity === "severe" ? "blood" : "urine", sev: data.severity, period: extra.period ?? 365 }}
        items={[...itemsOf(data, extra.locale ?? "en", extra.patient).singles, ...itemsOf(data, extra.locale ?? "en", extra.patient).pairs]}
        bar={bar}
        asOf={data.asOf}
        loading={false}
        failed={false}
        editing={false}
        onEdit={() => {}}
      />,
    );
  it("heads the answer with the first combination when no single drug clears", () => {
    const data = response(
      Array.from({ length: 65 }, (_, i) =>
        record(i, {
          specimen: "blood",
          ...(i < 45 ? { results: { MEM: "S" } } : { organism: "Staphylococcus aureus", results: { FOX: "R", VAN: "S" } }),
        }),
      ),
      "severe",
    );
    const html = card(data);
    expect(html).toContain("No single antibiotic clears the 90 % bar for this case; a combination does.");
    expect(html).toMatch(/Highest coverage clearing the 90 % bar: <span class="dr-good">[^<]+ \+ [^<]+<\/span>/);
    expect(html).toMatch(
      /Together they cover 100 % \(95 % CI \d+–100\) of 65 first isolates of everything that grew, in the last 12 months\./,
    );
    expect(html).not.toContain("Look at the combinations below");
    expect(html).not.toContain("Start with");
  });
  it("says a borderline combination is near the bar, not that it clears, and does not colour it good", () => {
    const data = response(
      Array.from({ length: 65 }, (_, i) =>
        record(i, {
          specimen: "blood",
          ...(i < 45 ? { results: { MEM: "S" } } : { organism: "Staphylococcus aureus", results: { FOX: "R", VAN: "S" } }),
        }),
      ),
      "severe",
    );
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
    const html = card(borderline);
    expect(html).toContain("The best combination is near the bar but not clearly above it.");
    expect(html).not.toContain("a combination does");
    expect(html).toContain("Closest to the 90 % bar: <span>");
    expect(html).not.toContain("dr-good");
    expect(html).toContain("Together they cover 92 % (95 % CI 83–97) of 65 first isolates");
  });
  it("heads with the highest-coverage clearing drug, its interval and n, on the basis it was judged on", () => {
    const html = card(urine(), 80);
    // Mild: judged within the intended spectrum.
    expect(html).toMatch(/Highest coverage clearing the 80 % bar: <span class="dr-good">[^<]+<\/span>/);
    expect(html).toMatch(/Covers 100 % \(95 % CI \d+–100\) of 60 first isolates within its intended spectrum, in the last 12 months\./);
    expect(html).toContain("Across everything that grows here:");
    expect(html).toContain("in this unit&#x27;s last 4 weeks");
    expect(html).toContain("Also clears the bar</span>");
    // Pills carry n.
    expect(html).toMatch(/<b>92\u00a0%<\/b> · n\u00a060/);
    // Severe: judged over everything that grew.
    const severe = response(
      Array.from({ length: 65 }, (_, i) => record(i, { specimen: "blood", results: { MEM: "S", CIP: i < 64 ? "S" : "R" } })),
      "severe",
    );
    const sev = card(severe);
    expect(sev).toContain("first isolates of everything that grew");
    expect(sev).not.toContain("within its intended spectrum");
  });
  it("names the chosen period, never 'last year'", () => {
    expect(card(urine(), 80, { period: 90 })).toContain("in the last 90 days.");
    const four = card(urine(), 80, { period: 28 });
    expect(four).toContain("in the last 4 weeks.");
    expect(four).not.toContain("this unit&#x27;s last 4 weeks");
    const fi = card(urine(), 80, { locale: "fi" });
    expect(fi).toContain("viimeisten 12 kuukauden aikana");
    expect(fi).not.toContain("viime vuonna");
    expect(card(urine(), 80)).not.toContain("last year");
  });
  it("skips a drug the patient's earlier finding defeats, and says why", () => {
    const data = urine();
    const top = itemsOf(data, "en").singles[0];
    if (!top) throw new Error("fixture must have a first row");
    const patient = { ...PATIENT, affects: { esbl: [top.id as AntibioticCode] } };
    const html = card(data, 80, { patient });
    expect(html).toContain(`${top.name} skipped: the patient&#x27;s earlier ESBL finding`);
    expect(html).not.toContain(`<span class="dr-good">${top.name}</span>`);
    expect(html).not.toMatch(new RegExp(`<li>${top.name} <b>`));
    // Every clearing drug defeated: no headline drug, and no claim that none clears.
    const clearing = itemsOf(data, "en")
      .singles.filter((i) => i.standing === "clears")
      .map((i) => i.id as AntibioticCode);
    const all = card(data, 80, { patient: { ...PATIENT, affects: { esbl: clearing } } });
    expect(all).toContain("Every antibiotic that clears the 80 % bar is one the patient&#x27;s earlier finding makes resistant.");
    expect(all).not.toContain("dr-good");
    expect(all).not.toContain("No single antibiotic clears");
  });
  it("shows the empty state, not 'look at the combinations', when nothing has results", () => {
    const empty = response([], "severe");
    expect(empty.coverage.isolates).toBe(0);
    const html = card(empty);
    expect(html).toContain("No antibiotic assessable for blood here on 30.6.2026: fewer than 30 results at any level.");
    expect(html).not.toContain("combinations below");
    const listed = list(empty, "en");
    expect(listed).toContain("No antibiotic assessable for urine here");
    expect(listed).not.toContain('class="cl-rows"');
  });
});
