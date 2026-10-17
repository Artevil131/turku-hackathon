import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ExportBundle,
  type ExportFigure,
  type ExportTable,
  exportFormats,
  figurePngFile,
  figureSvgFile,
  toCsv,
  toCsvFiles,
  toDocx,
  toJson,
  toLatex,
  toMarkdown,
  toPython,
} from "./index.ts";

const table: ExportTable = {
  name: "results",
  title: "Resistance | results",
  columns: [
    { key: "organism", label: "Organism", description: "Reported | name" },
    { key: "share", label: "Share", unit: "%" },
  ],
  rows: [
    { organism: 'ä, ö "quoted"\r\nline', share: 42 },
    { organism: "=SUM(A1)", share: -2 },
  ],
};
const figure: ExportFigure = { name: "plot", title: "Figure | title", caption: "Caption & explanation", svg: "<svg />" };
const bundle: ExportBundle = {
  title: "Tyks ä & study",
  generatedAt: "2026-10-17T12:00:00Z",
  asOf: "2025-05-12",
  mode: "frozen",
  scope: { units: ["ICU", "URO"], site: "tyks" },
  fingerprint: { rows: 2, sha256: "abc123" },
  sourceNote: "Synthetic data",
  tables: [table],
  figures: [figure],
  numbers: [{ label: "Coverage", value: 42, method: "Wilson", parameters: { confidence: 0.95, pool: "first isolates" } }],
  locale: "fi",
};

describe("CSV", () => {
  it("uses a BOM, column keys, RFC 4180 quoting and CRLF", () => {
    expect(toCsv(table)).toEqual({
      filename: "results.csv",
      mime: "text/csv;charset=utf-8",
      data: '﻿organism,share\r\n"ä, ö ""quoted""\r\nline",42\r\n\'=SUM(A1),-2\r\n',
    });
  });
  it("guards string formulas but not numbers, and handles missing and null cells", () => {
    const cells = ["=1", "+1", "-1", "@foo", 1, -1, true, null];
    const input: ExportTable = { name: "cells", title: "", columns: [{ key: "x", label: "x" }], rows: [...cells.map((x) => ({ x })), {}] };
    expect(toCsv(input).data).toBe("﻿x\r\n'=1\r\n'+1\r\n'-1\r\n'@foo\r\n1\r\n-1\r\ntrue\r\n\r\n\r\n");
  });
  it("produces one file per table and a complete dictionary", () => {
    const files = toCsvFiles(bundle);
    expect(files.map((f) => f.filename)).toEqual(["results.csv", "tyks-a-study-dictionary.csv"]);
    expect(files[1]?.data).toBe(
      "﻿table,column,label,unit,description\r\nresults,organism,Organism,,Reported | name\r\nresults,share,Share,%,\r\n",
    );
  });
});

it("round-trips JSON while keeping SVG and omitting PNG bytes", () => {
  const withPng = { ...bundle, figures: [{ ...figure, png: { bytes: new Uint8Array([1, 2]), width: 10, height: 20 } }] };
  const result = toJson(withPng);
  expect(result.filename).toBe("tyks-a-study.json");
  expect(JSON.parse(String(result.data))).toEqual({ format: "aei-export/1", ...bundle });
  expect(withPng.figures[0]?.png?.bytes).toEqual(new Uint8Array([1, 2]));
});

it("escapes Markdown pipes and includes metadata, methods, figures and dictionary", () => {
  const md = String(toMarkdown(bundle).data);
  expect(md).toContain("## Resistance \\| results");
  expect(md).toContain("Reported \\| name");
  expect(md).toContain("![Figure \\| title](plot.svg)");
  for (const value of ["Generated", "As of", "frozen", "ICU, URO", "abc123", "Wilson", "confidence=0.95", "Column dictionary"])
    expect(md).toContain(value);
});

it("escapes each LaTeX special character once and generates a standalone document", () => {
  const tex = String(toLatex({ ...bundle, title: "& % $ # _ { } ~ ^ \\" }).data);
  expect(tex).toContain("\\title{\\& \\% \\$ \\# \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}}");
  for (const value of [
    "\\documentclass{article}",
    "booktabs,longtable,graphicx",
    "\\begin{longtable}",
    "\\includegraphics[width=\\linewidth]{plot.pdf}",
    "\\end{document}",
  ])
    expect(tex).toContain(value);
  expect(toLatex({ ...bundle, figures: [{ ...figure, png: { bytes: new Uint8Array(), width: 1, height: 1 } }] }).data).toContain(
    "{plot.png}",
  );
});

it("writes DOCX zip bytes, tables and a missing-PNG note", async () => {
  const result = await toDocx(bundle);
  expect(result.filename).toBe("tyks-a-study.docx");
  expect(result.data).toBeInstanceOf(Uint8Array);
  const bytes = result.data as Uint8Array;
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  expect(bytes.length).toBeGreaterThan(100);
  expect(Buffer.from(bytes).includes(Buffer.from("word/document.xml"))).toBe(true);
});

it("embeds supplied PNG bytes in DOCX", async () => {
  const bytes = new Uint8Array(
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
  );
  const pngFigure = { ...figure, png: { bytes, width: 1000, height: 500 } };
  const pngBundle: ExportBundle = { ...bundle, figures: [pngFigure] };
  const docx = await toDocx(pngBundle);
  expect(Buffer.from(docx.data as Uint8Array).includes(Buffer.from("word/media/"))).toBe(true);
  expect(figurePngFile(pngFigure)).toEqual({ filename: "plot.png", mime: "image/png", data: bytes });
  expect(figureSvgFile(figure)).toEqual({ filename: "plot.svg", mime: "image/svg+xml", data: "<svg />" });
  expect(() => figurePngFile(figure)).toThrow("No PNG supplied");
  await expect(toDocx({ ...bundle, figures: [{ ...pngFigure, png: { bytes, width: 0, height: 1 } }] })).rejects.toThrow(
    "Invalid PNG dimensions",
  );
});

const pythonAvailable = spawnSync("python3", ["--version"]).status === 0;
it.skipIf(!pythonAvailable)("generates valid standalone Python even with hostile quotes and table names", () => {
  const names = ["normal", "class", "1-table", "pd", "print", "same-name", "same_name"];
  const script = toPython({
    ...bundle,
    tables: names.map((name) => ({ ...table, name, rows: [{ organism: `triple ''' and """ \\ \n ä`, share: 2 }] })),
  });
  const dir = mkdtempSync(join(tmpdir(), "aei-export-"));
  try {
    const path = join(dir, "export.py");
    writeFileSync(path, script.data);
    const result = spawnSync("python3", ["-I", "-c", 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', path], {
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  expect(script.data).toContain("normal = pd.read_csv(io.StringIO(");
  expect(script.data).toContain("table_class =");
  expect(script.data).toContain("table_print =");
  expect(script.data).toContain("print(name, frame.shape)");
});

it("handles bundles without tables, figures or numbers", async () => {
  const empty = { ...bundle, tables: [], figures: [], numbers: [], title: "???" };
  expect(toJson(empty).filename).toBe("export.json");
  expect(toCsvFiles(empty)).toHaveLength(1);
  expect(toMarkdown(empty).data).toContain("Column dictionary");
  expect(toLatex(empty).data).toContain("\\end{document}");
  expect((await toDocx(empty)).data.length).toBeGreaterThan(0);
  expect(exportFormats.map((f) => f.id)).toEqual(["csv", "json", "md", "tex", "docx", "py"]);
});
