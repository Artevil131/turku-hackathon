import type { ExportBundle } from "./bundle.ts";

export type NotebookTarget = "lite" | "desktop";

const pythonLoad = 'import aei\npkg = aei.read_package(".")';
const rLoad = 'library(aei)\npkg <- read_package(".")';
const pythonExample = 'pkg.isolates.groupby([pd.Grouper(key="sampleDate", freq="W"), "ward"]).size().unstack(fill_value=0).tail()';
const rExample = 'isolates <- pkg$isolates\nweek <- cut(as.Date(isolates$sampleDate), breaks = "week")\ntail(table(week, isolates$ward))';

function introduction(bundle: ExportBundle): string {
  return `# Reproduce: ${bundle.title}\n\nThis notebook reproduces the numbers the tool showed for this project as of ${bundle.asOf ?? bundle.generatedAt}, from the same rows (checked by fingerprint) and the same methods.`;
}

function notebook(bundle: ExportBundle, language: "python" | "R", target: NotebookTarget): string {
  const python = language === "python";
  const cells = [
    ["markdown", introduction(bundle)],
    [
      "code",
      python
        ? `import sys\nif sys.platform == "emscripten":\n    import piplite\n    await piplite.install("aei")\n${pythonLoad}\npkg`
        : rLoad,
    ],
    ["markdown", "## 1. Same data"],
    ["code", python ? "pkg.verify()" : "verify(pkg)"],
    ["markdown", "## 2. Same numbers\n\nCompare each number shown by the tool with its recomputed value and whether they match."],
    ["code", python ? "aei.reproduce(pkg)" : "reproduce(pkg)"],
    ["markdown", "## 3. Your analysis\n\nStart with weekly isolates by ward below, then adapt the grouping to your research question."],
    ["code", python ? `import pandas as pd\n${pythonExample}` : rExample],
  ].map(([cell_type, source], index) => ({
    id: `reproduce-${index + 1}`,
    cell_type,
    metadata: {},
    source,
    ...(cell_type === "code" ? { execution_count: null, outputs: [] } : {}),
  }));
  return `${JSON.stringify(
    {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: python
          ? target === "lite"
            ? { name: "python", display_name: "Python (Pyodide)", language: "python" }
            : { name: "python3", display_name: "Python 3", language: "python" }
          : target === "lite"
            ? { name: "xr", display_name: "R 4.5.1 (xr)", language: "R" }
            : { name: "ir", display_name: "R", language: "R" },
        language_info: { name: language },
      },
      cells,
    },
    null,
    2,
  )}\n`;
}

export function pythonNotebook(bundle: ExportBundle, opts?: { target?: NotebookTarget }): string {
  return notebook(bundle, "python", opts?.target ?? "desktop");
}

export function rNotebook(bundle: ExportBundle, opts?: { target?: NotebookTarget }): string {
  return notebook(bundle, "R", opts?.target ?? "desktop");
}

export function pythonAnalysis(bundle: ExportBundle): string {
  return [
    `# Reproduce: ${bundle.title.replace(/[\r\n]/g, " ")}`,
    "# Run from the unpacked package folder. Requires aei and pandas.",
    "import pandas as pd",
    pythonLoad,
    "",
    "# 1. Same data",
    "print(pkg.verify())",
    "",
    "# 2. Same numbers: shown by the tool, recomputed, match",
    "print(aei.reproduce(pkg))",
    "",
    "# 3. Your analysis: weekly isolates by ward",
    `print(${pythonExample})`,
    "",
  ].join("\n");
}

export function rAnalysis(bundle: ExportBundle): string {
  return [
    `# Reproduce: ${bundle.title.replace(/[\r\n]/g, " ")}`,
    "# Run from the unpacked package folder. Requires aei.",
    rLoad,
    "",
    "# 1. Same data",
    "print(verify(pkg))",
    "",
    "# 2. Same numbers: shown by the tool, recomputed, match",
    "print(reproduce(pkg))",
    "",
    "# 3. Your analysis: weekly isolates by ward",
    rExample.replace("tail(table(week, isolates$ward))", "print(tail(table(week, isolates$ward)))"),
    "",
  ].join("\n");
}
