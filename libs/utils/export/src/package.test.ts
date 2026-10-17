import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { alertTable, type ExportBundle, exportFormats, isolateTable, packageFiles, toResearchPackage } from "./index.ts";

const bundle: ExportBundle = {
  title: "Study ä spring",
  generatedAt: "2026-10-17T12:00:00Z",
  asOf: "2025-05-12",
  mode: "frozen",
  scope: { site: "tyks", units: ["ICU"] },
  fingerprint: { rows: 2, sha256: "abc123" },
  appVersion: "1.2.3",
  tables: [
    {
      name: "isolates",
      title: "Isolates",
      columns: [
        { key: "isolateId", label: "Isolate ID", description: "Original identifier" },
        { key: "sampleDate", label: "Date", type: "date" },
        { key: "ageYears", label: "Age", type: "integer", unit: "years" },
        { key: "share", label: "Share", type: "number" },
        { key: "confirmed", label: "Confirmed", type: "boolean" },
        { key: "created", label: "Created", type: "datetime" },
        { key: "ward", label: "Unit" },
      ],
      rows: [
        {
          isolateId: "001",
          sampleDate: "2025-05-12",
          ageYears: 42,
          share: 0.5,
          confirmed: false,
          created: "2025-05-12T12:00:00Z",
          ward: "=ICU",
        },
        { isolateId: "NA", sampleDate: "2025-05-11", ageYears: null, share: null, confirmed: null, created: null, ward: "+URO" },
      ],
    },
  ],
  figures: [{ name: "weekly", title: "Weekly", svg: "<svg />", png: { bytes: new Uint8Array([1, 2]), width: 1, height: 1 } }],
  numbers: [{ label: "Isolates", value: 2, method: "row-count", parameters: { table: "isolates" } }],
};

function filesOf(input = bundle, docx?: Uint8Array): Record<string, string | Uint8Array> {
  return Object.fromEntries(packageFiles(input, { docx }).map((file) => [file.path, file.data]));
}

const expectedPaths = [
  "datapackage.json",
  "isolates.csv",
  "methods.json",
  "README.md",
  "analysis.py",
  "analysis.R",
  "reproduce.ipynb",
  "reproduce-r.ipynb",
  "figures/weekly.svg",
  "figures/weekly.png",
  "report.docx",
];

describe("research package", () => {
  it("provides root-relative files and the reader's typed Frictionless descriptor", () => {
    const docx = new Uint8Array([3, 4]);
    const files = filesOf(bundle, docx);
    expect(Object.keys(files)).toEqual(expectedPaths);
    expect(files["report.docx"]).toBe(docx);
    expect(files["figures/weekly.svg"]).toBe("<svg />");
    expect(files["figures/weekly.png"]).toEqual(new Uint8Array([1, 2]));
    expect(JSON.parse(String(files["methods.json"]))).toEqual(bundle.numbers);
    expect(JSON.parse(String(files["datapackage.json"]))).toEqual({
      profile: "tabular-data-package",
      name: "study-a-spring",
      title: bundle.title,
      created: bundle.generatedAt,
      aei: {
        format: "aei-package/1",
        asOf: bundle.asOf,
        mode: bundle.mode,
        scope: bundle.scope,
        fingerprint: bundle.fingerprint,
        appVersion: "1.2.3",
      },
      resources: bundle.tables.map((table) => ({
        name: table.name,
        title: table.title,
        path: "isolates.csv",
        schema: {
          fields: table.columns.map(({ key, label, type, ...rest }) => ({ name: key, title: label, type: type ?? "string", ...rest })),
        },
      })),
    });
    const readme = String(files["README.md"]);
    for (const text of [
      "ICU",
      "2025-05-12",
      "abc123",
      "aei.read_package",
      "read_package",
      "pd.read_csv",
      "readr::read_csv",
      "reproduce.ipynb",
      "reproduce-r.ipynb",
      "not redistributable",
      "local analysis only",
    ])
      expect(readme).toContain(text);
  });

  it("keeps package CSVs unguarded and without a BOM", () => {
    const csv = String(filesOf()["isolates.csv"]);
    expect(csv.startsWith("isolateId,")).toBe(true);
    expect(csv).toContain("001,2025-05-12,42,0.5,false,2025-05-12T12:00:00Z,=ICU\r\n");
    expect(csv).toContain("NA,2025-05-11,,,,,+URO\r\n");
    expect(csv).not.toContain("'=ICU");
    expect(csv).not.toContain("﻿");
  });

  it("omits optional files and metadata when not supplied, including for empty bundles", () => {
    const { appVersion: _appVersion, ...input } = bundle;
    const files = filesOf({ ...input, tables: [], figures: [], numbers: [] });
    expect(files["report.docx"]).toBeUndefined();
    expect(Object.keys(files).some((path) => path.startsWith("figures/"))).toBe(false);
    const descriptor = JSON.parse(String(files["datapackage.json"]));
    expect(descriptor.resources).toEqual([]);
    expect(descriptor.aei).not.toHaveProperty("appVersion");
    expect(files["methods.json"]).toBe("[]\n");
  });

  it("generates reproducibility notebooks with valid v4.5 cells and Python and xeus-r kernels", () => {
    const files = filesOf();
    for (const [path, name, language] of [
      ["reproduce.ipynb", "python3", "python"],
      ["reproduce-r.ipynb", "xr", "R"],
    ]) {
      const notebook = JSON.parse(String(files[path ?? ""]));
      expect(notebook.nbformat).toBe(4);
      expect(notebook.nbformat_minor).toBe(5);
      expect(notebook.metadata.kernelspec).toMatchObject({ name, language });
      expect(new Set(notebook.cells.map((cell: { id: string }) => cell.id)).size).toBe(notebook.cells.length);
      expect(notebook.cells[0].source).toContain("# Reproduce: Study ä spring");
      expect(notebook.cells[0].source).toContain("2025-05-12");
      for (const cell of notebook.cells) {
        expect(cell.id).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
        expect(["markdown", "code"]).toContain(cell.cell_type);
        expect(typeof cell.source).toBe("string");
        if (cell.cell_type === "code") expect(cell).toMatchObject({ outputs: [], execution_count: null });
      }
      expect(notebook.cells[2].source).toBe("## 1. Same data");
      expect(notebook.cells[4].source).toContain("## 2. Same numbers");
      expect(notebook.cells[6].source).toContain("## 3. Your analysis");
    }
    const python = JSON.parse(String(files["reproduce.ipynb"]));
    expect(python.cells[1].source).toBe(
      'import sys\nif sys.platform == "emscripten":\n    import piplite\n    await piplite.install("aei")\nimport aei\npkg = aei.read_package(".")\npkg',
    );
    expect(python.cells[3].source).toBe("pkg.verify()");
    expect(python.cells[5].source).toBe("aei.reproduce(pkg)");
    expect(python.cells[7].source).toContain(".size().unstack(fill_value=0).tail()");
    const r = JSON.parse(String(files["reproduce-r.ipynb"]));
    expect(r.metadata.kernelspec.display_name).toBe("R (xeus-r)");
    expect(r.cells[1].source).toBe('library(aei)\npkg <- read_package(".")');
    expect(r.cells[3].source).toBe("verify(pkg)");
    expect(r.cells[5].source).toBe("reproduce(pkg)");
    expect(r.cells[7].source).toContain("table(week, isolates$ward)");
    expect(files["analysis.py"]).toContain("print(pkg.verify())");
    expect(files["analysis.py"]).toContain("print(aei.reproduce(pkg))");
    expect(files["analysis.R"]).toContain("print(verify(pkg))");
    expect(files["analysis.R"]).toContain("print(reproduce(pkg))");
  });

  it("zips the package and a real Word report under the title slug", async () => {
    const file = await toResearchPackage(bundle);
    expect(file.filename).toBe("study-a-spring.zip");
    expect(file.mime).toBe("application/zip");
    expect(file.data).toBeInstanceOf(Uint8Array);
    const zip = await JSZip.loadAsync(file.data);
    expect(
      Object.values(zip.files)
        .filter((entry) => !entry.dir)
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(expectedPaths.map((path) => `study-a-spring/${path}`).sort());
    expect(await zip.file("study-a-spring/isolates.csv")?.async("string")).toBe(filesOf()["isolates.csv"]);
    const report = await zip.file("study-a-spring/report.docx")?.async("uint8array");
    expect(report).toBeDefined();
    const docx = await JSZip.loadAsync(report as Uint8Array);
    expect(docx.file("word/document.xml")).not.toBeNull();
    expect(exportFormats[0]?.id).toBe("zip");
  });

  const uvAvailable = spawnSync("uv", ["--version"]).status === 0;
  it.skipIf(!uvAvailable)("loads the files with the actual Python reader and preserves typed values", () => {
    const dir = mkdtempSync(join(tmpdir(), "aei-package-"));
    try {
      for (const file of packageFiles(bundle)) {
        const path = join(dir, file.path);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.data);
      }
      const root = fileURLToPath(new URL("../../../../", import.meta.url));
      const result = spawnSync(
        "uv",
        [
          "run",
          "--project",
          root,
          "python",
          "-c",
          'import aei,sys; p=aei.read_package(sys.argv[1]); print(p.isolates.dtypes.to_dict()); print(len(p.isolates)); assert p.isolates["isolateId"].tolist() == ["001", "NA"]; assert p.isolates["ward"].tolist() == ["=ICU", "+URO"]; assert str(p.isolates["ageYears"].dtype) == "Int64"; assert str(p.isolates["confirmed"].dtype) == "boolean"',
          dir,
        ],
        { encoding: "utf8", timeout: 45000, env: { ...process.env, UV_OFFLINE: "1", UV_NO_SYNC: "1" } },
      );
      expect(result.error, result.stderr).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim().split("\n").at(-1)).toBe("2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks domain dates, counts, measurements and boolean fields with reader-compatible types", () => {
    const fields = (table: ReturnType<typeof isolateTable>) =>
      Object.fromEntries(table.columns.map((column) => [column.key, column.type ?? "string"]));
    expect(fields(isolateTable([], ["AMP"]))).toMatchObject({
      sampleDate: "date",
      admissionDate: "date",
      ageYears: "integer",
      AMP: "string",
      isolateId: "string",
    });
    expect(fields(alertTable([]))).toMatchObject({
      date: "date",
      foundOn: "date",
      previous: "date",
      confirmed: "boolean",
      observed: "number",
      expected: "number",
      p: "number",
    });
  });
});
