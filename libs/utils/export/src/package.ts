import JSZip from "jszip";
import type { ExportBundle, ExportFile } from "./bundle.ts";
import { pythonAnalysis, pythonNotebook, rAnalysis, rNotebook } from "./notebooks.ts";
import { csv, metadata, slug } from "./text.ts";
import { figurePngFile, figureSvgFile, toDocx } from "./word.ts";

function readme(bundle: ExportBundle): string {
  const table = bundle.tables.find((table) => table.name === "isolates") ?? bundle.tables[0];
  const path = `${slug(table?.name ?? "isolates")}.csv`;
  return [
    `# ${bundle.title}`,
    "This AEI research package contains the project's exported rows, column meanings, numbers and methods, and captured figures. It is intended for reproducibility and local analysis.",
    "## Data cut",
    ...metadata(bundle).map(([key, value]) => `- ${key}: ${value}`),
    "The fingerprint records the saved data cut when supplied. Check it before interpreting reproduced numbers; missing fingerprints cannot prove the same rows. Figures may have their own displayed filters and date ranges.",
    "## Load in Python",
    '```python\nimport aei\npkg = aei.read_package(".")\n```',
    "Requires the aei Python package. Without it, load a CSV directly with pandas (consult datapackage.json for types, descriptions and units):",
    `\`\`\`python\nimport pandas as pd\nrows = pd.read_csv(${JSON.stringify(path)}, dtype="string", keep_default_na=False, na_values=[""])\n\`\`\``,
    "## Load in R",
    '```r\nlibrary(aei)\npkg <- read_package(".")\n```',
    "Without aei, read the same CSV with readr, then apply the types in datapackage.json:",
    `\`\`\`r\nrows <- readr::read_csv(${JSON.stringify(path)}, col_types = readr::cols(.default = readr::col_character()), na = "")\n\`\`\``,
    "## Reproduce the results",
    "Open reproduce.ipynb (Python) or reproduce-r.ipynb (R) in Jupyter, with this unpacked folder as the working directory. The steps check the same data, recompute the tool's numbers, then leave room for your analysis. analysis.py and analysis.R provide the same steps as plain scripts. Install aei for the language you use; Python reproduces our methods, while R reports the checks its implementation supports.",
    "datapackage.json describes the typed tables; methods.json records the numbers as shown, their methods and parameters. Package CSVs preserve original values without a BOM or spreadsheet formula guard: use them in analysis tools, not as trusted spreadsheet formulas. report.docx, when included, is the accompanying Word report; figures/ contains the supplied SVG and PNG images.",
    "## Data restrictions",
    "The organisers' dataset is not redistributable. This package is for local analysis only; do not publish or redistribute its rows.",
    "",
  ].join("\n\n");
}

export function packageFiles(bundle: ExportBundle, opts?: { docx?: Uint8Array }): { path: string; data: string | Uint8Array }[] {
  const descriptor = {
    profile: "tabular-data-package",
    name: slug(bundle.title),
    title: bundle.title,
    created: bundle.generatedAt,
    aei: {
      format: "aei-package/1",
      asOf: bundle.asOf,
      mode: bundle.mode,
      scope: bundle.scope,
      fingerprint: bundle.fingerprint,
      ...(bundle.appVersion !== undefined ? { appVersion: bundle.appVersion } : {}),
    },
    resources: bundle.tables.map((table) => ({
      name: table.name,
      title: table.title,
      path: `${slug(table.name)}.csv`,
      schema: {
        fields: table.columns.map((column) => ({
          name: column.key,
          type: column.type ?? "string",
          title: column.label,
          ...(column.description !== undefined ? { description: column.description } : {}),
          ...(column.unit !== undefined ? { unit: column.unit } : {}),
        })),
      },
    })),
  };
  const files: { path: string; data: string | Uint8Array }[] = [
    { path: "datapackage.json", data: `${JSON.stringify(descriptor, null, 2)}\n` },
    ...bundle.tables.map((table) => ({ path: `${slug(table.name)}.csv`, data: csv(table, false) })),
    { path: "methods.json", data: `${JSON.stringify(bundle.numbers, null, 2)}\n` },
    { path: "README.md", data: readme(bundle) },
    { path: "analysis.py", data: pythonAnalysis(bundle) },
    { path: "analysis.R", data: rAnalysis(bundle) },
    { path: "reproduce.ipynb", data: pythonNotebook(bundle) },
    { path: "reproduce-r.ipynb", data: rNotebook(bundle) },
  ];
  for (const figure of bundle.figures) {
    for (const file of [figureSvgFile(figure), ...(figure.png ? [figurePngFile(figure)] : [])])
      files.push({ path: `figures/${file.filename}`, data: file.data });
  }
  if (opts?.docx) files.push({ path: "report.docx", data: opts.docx });
  return files;
}

export async function toResearchPackage(bundle: ExportBundle): Promise<ExportFile> {
  const report = await toDocx(bundle);
  const name = slug(bundle.title);
  const zip = new JSZip();
  for (const file of packageFiles(bundle, { docx: report.data as Uint8Array })) zip.file(`${name}/${file.path}`, file.data);
  return {
    filename: `${name}.zip`,
    mime: "application/zip",
    data: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  };
}
