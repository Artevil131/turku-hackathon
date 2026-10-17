import type { AeiClient } from "@aei/contract";
import type { IsolateRecord, Phenotype } from "@aei/domain";
import { pageMarkdown } from "@aei/export";
import { TOOL_METHODS } from "@aei/method";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { computeCompare, computeRate, MIN_TREND_PERIODS, type Slice, TREND_PERIOD_DAYS, Z_TAIL } from "../tools/model.ts";
import { parseNote } from "./markdown.tsx";
import {
  appendResult,
  codeFor,
  emptyPage,
  insertAt,
  lettersOf,
  moveCell,
  type NbCell,
  type Page,
  pageBlocks,
  parsePage,
  serialisePage,
  sliceAbove,
} from "./model.ts";
import { Notebook } from "./Notebook.tsx";

let seq = 0;
function rec(date: string, esbl: boolean, ward = "ICU"): IsolateRecord {
  seq++;
  return {
    isolateId: `i${seq}`,
    cultureId: `c${seq}`,
    patientId: `p${seq}`,
    sampleDate: date,
    admissionDate: null,
    ward,
    specimen: "urine",
    organism: "Escherichia coli",
    sex: "F",
    ageYears: 60,
    homeArea: "x",
    phenotypes: esbl ? (["esbl"] as Phenotype[]) : [],
    results: {},
  };
}
const sep = (i: number) => `2026-09-${String(1 + (i % 28)).padStart(2, "0")}`;
const aug = (i: number) => `2026-08-${String(4 + (i % 28)).padStart(2, "0")}`;

const A: Slice = { from: "2026-09-01", to: "2026-09-28", unit: "ICU", organism: "", specimen: "", phenotype: "esbl", firstOnly: true };
const B: Slice = { ...A, from: "2026-08-04", to: "2026-08-31" };
const rateA = computeRate(
  Array.from({ length: 20 }, (_, i) => rec(sep(i), i < 5)),
  A,
);
const rateB = computeRate(
  Array.from({ length: 10 }, (_, i) => rec(aug(i), i < 1)),
  B,
);

const slice = (id: string, s: Slice): NbCell => ({ id, kind: "slice", slice: s });
const analysis = (id: string, result = rateA): NbCell => ({
  id,
  kind: "analysis",
  tool: "rate",
  params: {
    event: "phenotype:esbl",
    bMode: "previous",
    bUnit: "",
    bFrom: "",
    bTo: "",
    period: 7,
    discounted: false,
    delta: 0.95,
    m: 30,
    detector: "phenotype",
  },
  result,
});
const note = (id: string, text: string): NbCell => ({ id, kind: "note", text });

describe("slice resolution", () => {
  const cells = [note("n0", "intro"), slice("s1", A), analysis("a1"), note("n1", "between"), slice("s2", B), analysis("a2", rateB)];
  it("reads the nearest slice cell above", () => {
    expect(sliceAbove(cells, 2)?.id).toBe("s1");
    expect(sliceAbove(cells, 3)?.id).toBe("s1");
    expect(sliceAbove(cells, 5)?.id).toBe("s2");
  });
  it("finds none above the first slice", () => {
    expect(sliceAbove(cells, 0)).toBeNull();
    expect(sliceAbove(cells, 1)).toBeNull();
  });
  it("follows a move: an analysis moved under slice 2 reads slice 2", () => {
    const moved = moveCell({ v: 1, cells }, "a1", 5);
    expect(moved.cells.map((c) => c.id)).toEqual(["n0", "s1", "n1", "s2", "a2", "a1"]);
    expect(sliceAbove(moved.cells, 5)?.id).toBe("s2");
  });
});

describe("the rail's To notebook", () => {
  it("opens a slice cell when the page has none equal to the result's slice", () => {
    const p = appendResult(emptyPage(), rateA);
    expect(p.cells.map((c) => c.kind)).toEqual(["slice", "analysis"]);
  });
  it("lands under the equal slice, before the next slice cell", () => {
    const page: Page = { v: 1, cells: [slice("s1", A), note("n", "x"), slice("s2", B), analysis("a2", rateB)] };
    const p = appendResult(page, rateA);
    expect(p.cells.map((c) => c.id).slice(0, 2)).toEqual(["s1", "n"]);
    expect(p.cells[2]?.kind).toBe("analysis");
    expect(sliceAbove(p.cells, 2)?.id).toBe("s1");
    expect(p.cells[3]?.id).toBe("s2");
  });
});

describe("storage", () => {
  it("round-trips a page, the non-finite numbers included", () => {
    const cmp = computeCompare(
      [rec("2026-09-02", true)],
      [],
      A,
      { from: B.from, to: B.to, unit: "ICU" },
      { type: "phenotype", code: "esbl" },
    );
    expect(Number.isFinite(cmp.ratio?.ratio ?? 0)).toBe(false);
    const page: Page = insertAt({ v: 1, cells: [slice("s1", A), note("n", "**bold**")] }, 2, analysis("a", cmp as never));
    const back = parsePage(serialisePage(page));
    expect(back).toEqual(page);
  });
  it("rejects another version and drops a malformed cell", () => {
    expect(parsePage(JSON.stringify({ v: 2, cells: [] }))).toBeNull();
    expect(parsePage("not json")).toBeNull();
    const p = parsePage(
      JSON.stringify({ v: 1, cells: [{ id: "x", kind: "note", text: "ok" }, { id: "y", kind: "note" }, { kind: "slice" }] }),
    );
    expect(p?.cells.map((c) => c.id)).toEqual(["x"]);
  });
});

describe("export", () => {
  const page: Page = {
    v: 1,
    cells: [
      note("n", "# Two frames\n\nSeptember against **August**."),
      slice("s1", A),
      analysis("a1"),
      slice("s2", B),
      analysis("a2", rateB),
    ],
  };
  const md = pageMarkdown(
    pageBlocks(page, "2026-10-17", {
      title: "AEI notebook",
      locale: "en",
      sliceHeading: (n) => `Slice ${n}`,
      sliceSentence: (s) => `${s.unit} ${s.from}–${s.to}`,
      toolTitle: () => "Rate",
      notRun: "Not run yet.",
    }),
  );
  it("keeps the note as written and the slice sentences", () => {
    expect(md).toContain("# Two frames\n\nSeptember against **August**.");
    expect(md).toContain("## Slice 2");
    expect(md).toContain("ICU 2026-08-04–2026-08-31");
  });
  it("has the formula as LaTeX and the result as a table with its CSV beside it", () => {
    expect(md).toContain(`$$\n${TOOL_METHODS["tool-rate"].latex}\n$$`);
    expect(md).toContain("| measure | value | lo | hi |");
    expect(md).toContain("| count | 5 |");
    expect(md).toContain("tools-rate-1-2026-10-17.csv");
    expect(md).toContain("tools-rate-2-2026-10-17.csv");
    expect(md).toContain("```python\n# Rate in a frame");
    expect(md).toContain("k = 5  # events counted in the slice");
  });
});

describe("method letters and code", () => {
  it("fills the R snippet with the result's own numbers", () => {
    expect(lettersOf(rateA).fill).toMatchObject({ k: 5, n: 20, T: 4 });
    expect(codeFor(rateA, "r")).toContain("k <- 5; T <- 4; n <- 20");
    expect(codeFor(rateA, "python")).toContain("n = 20  # isolates in the slice");
  });
  it("leaves the share out of a rate without a phenotype: None in Python, NA in R", () => {
    const all = computeRate([rec("2026-09-02", false)], { ...A, phenotype: "" });
    expect(codeFor(all, "python")).toContain("n = None");
    expect(codeFor(all, "r")).toContain("n <- NA");
  });
  it("states the constants the Tools model runs with", () => {
    const c = (id: keyof typeof TOOL_METHODS, name: string) => TOOL_METHODS[id].constants.find((k) => k.name === name)?.value;
    expect(c("tool-rate", "tail per side")).toBe(Z_TAIL);
    expect(c("tool-compare", "trend period days")).toBe(TREND_PERIOD_DAYS);
    expect(c("tool-compare", "min periods per frame")).toBe(MIN_TREND_PERIODS);
  });
});

describe("notes", () => {
  it("parses headings, lists and paragraphs", () => {
    expect(parseNote("# H\n- a\n- b\n\ntext\nmore\n1. one").map((b) => b.kind)).toEqual(["h", "ul", "p", "ol"]);
  });
});

describe("the page", () => {
  it("renders each cell as a landmark with its heading, and a + between cells", () => {
    const page: Page = { v: 1, cells: [slice("s1", A), analysis("a1"), note("n", "**hi**")] };
    const html = renderToStaticMarkup(
      <Notebook
        client={{} as AeiClient}
        locale="en"
        asOf="2026-10-17"
        page={page}
        update={() => {}}
        projectId={null}
        signal={null}
        railCells={[]}
        onReproduce={() => {}}
      />,
    );
    expect(html.match(/<section/g)?.length).toBe(3);
    expect(html.match(/aria-labelledby="s1-h"/g)?.length).toBe(1);
    expect(html).toContain('id="s1-h"');
    expect(html).toContain("Reads slice 1");
    expect(html.match(/class="nb-plus"/g)?.length).toBe(4);
    expect(html).toContain("<strong>hi</strong>");
    expect(html).toContain("<math");
  });
});
