import type { ExportBundle, ExportFile, ExportNumber, ExportTable } from "./bundle.ts";

export function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "export"
  );
}

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function csvCell(value: unknown, guard: boolean): string {
  let cell = text(value);
  if (guard && typeof value === "string" && /^[=+\-@]/.test(value)) cell = `'${cell}`;
  return /[,"\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function csv(table: ExportTable, guard = true): string {
  return `${[table.columns.map((c) => csvCell(c.key, guard)).join(","), ...table.rows.map((row) => table.columns.map((c) => csvCell(row[c.key], guard)).join(","))].join("\r\n")}\r\n`;
}

export function toCsv(table: ExportTable): ExportFile {
  return { filename: `${slug(table.name)}.csv`, mime: "text/csv;charset=utf-8", data: `\uFEFF${csv(table)}` };
}

export function dictionary(bundle: ExportBundle): ExportTable {
  return {
    name: `${slug(bundle.title)}-dictionary`,
    title: "Column dictionary",
    columns: ["table", "column", "label", "unit", "description"].map((key) => ({ key, label: key })),
    rows: bundle.tables.flatMap((table) =>
      table.columns.map((column) => ({
        table: table.name,
        column: column.key,
        label: column.label,
        unit: column.unit ?? "",
        description: column.description ?? "",
      })),
    ),
  };
}

export function toCsvFiles(bundle: ExportBundle): ExportFile[] {
  return [...bundle.tables.map(toCsv), toCsv(dictionary(bundle))];
}

export function metadata(bundle: ExportBundle): [string, string][] {
  const entries: [string, string][] = [["Generated", bundle.generatedAt]];
  if (bundle.asOf !== undefined) entries.push(["As of", bundle.asOf]);
  if (bundle.mode !== undefined) entries.push(["Mode", bundle.mode]);
  for (const [key, value] of Object.entries(bundle.scope)) entries.push([`Scope: ${key}`, Array.isArray(value) ? value.join(", ") : value]);
  if (bundle.fingerprint) entries.push(["Fingerprint", `${bundle.fingerprint.rows} rows; SHA-256 ${bundle.fingerprint.sha256}`]);
  if (bundle.sourceNote !== undefined) entries.push(["Source", bundle.sourceNote]);
  return entries;
}

export function numberText(number: ExportNumber): string {
  const parameters = Object.entries(number.parameters ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  return `${number.label}: ${number.value}${number.method ? `; method: ${number.method}` : ""}${parameters ? `; parameters: ${parameters}` : ""}`;
}

export function toJson(bundle: ExportBundle): ExportFile {
  const figures = bundle.figures.map(({ png: _png, ...figure }) => figure);
  return {
    filename: `${slug(bundle.title)}.json`,
    mime: "application/json",
    data: `${JSON.stringify({ format: "aei-export/1", ...bundle, figures }, null, 2)}\n`,
  };
}

function markdown(value: unknown): string {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]#|!])/g, "\\$1")
    .replace(/\r\n|\r|\n/g, "<br>");
}

function markdownTable(table: ExportTable): string {
  if (!table.columns.length) return "_No columns._";
  const row = (values: unknown[]) => `| ${values.map(markdown).join(" | ")} |`;
  return [
    row(table.columns.map((c) => c.key)),
    row(table.columns.map(() => "---")),
    ...table.rows.map((r) => row(table.columns.map((c) => r[c.key]))),
  ].join("\n");
}

export function toMarkdown(bundle: ExportBundle): ExportFile {
  const parts = [
    `# ${markdown(bundle.title)}`,
    metadata(bundle)
      .map(([key, value]) => `- ${markdown(key)}: ${markdown(value)}`)
      .join("\n"),
  ];
  if (bundle.numbers.length) parts.push("## Numbers", bundle.numbers.map((n) => `- ${markdown(numberText(n))}`).join("\n"));
  for (const table of bundle.tables) parts.push(`## ${markdown(table.title)}`, markdownTable(table));
  for (const figure of bundle.figures)
    parts.push(`![${markdown(figure.title)}](${slug(figure.name)}.svg)${figure.caption ? `\n\n${markdown(figure.caption)}` : ""}`);
  parts.push("## Column dictionary", markdownTable(dictionary(bundle)));
  return { filename: `${slug(bundle.title)}.md`, mime: "text/markdown;charset=utf-8", data: `${parts.join("\n\n")}\n` };
}

export function latex(value: unknown): string {
  const replacements: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "%": "\\%",
    $: "\\$",
    "#": "\\#",
    _: "\\_",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };
  return text(value)
    .replace(/[\\&%$#_{}~^]/g, (c) => replacements[c] ?? c)
    .replace(/\r\n|\r|\n/g, " ");
}

function latexTable(table: ExportTable): string {
  if (!table.columns.length) return "\\emph{No columns.}";
  const row = (values: unknown[]) => `${values.map(latex).join(" & ")} \\\\`;
  return [
    `\\begin{longtable}{${"l".repeat(table.columns.length)}}`,
    "\\toprule",
    row(table.columns.map((c) => c.key)),
    "\\midrule",
    "\\endhead",
    ...table.rows.map((r) => row(table.columns.map((c) => r[c.key]))),
    "\\bottomrule",
    "\\end{longtable}",
  ].join("\n");
}

export function toLatex(bundle: ExportBundle): ExportFile {
  const parts = [
    "\\documentclass{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{booktabs,longtable,graphicx}",
    `\\title{${latex(bundle.title)}}`,
    "\\date{}",
    "\\begin{document}",
    "\\maketitle",
    ...metadata(bundle).map(([k, v]) => `\\noindent ${latex(k)}: ${latex(v)}\\par`),
  ];
  if (bundle.numbers.length)
    parts.push("\\section*{Numbers}", "\\begin{itemize}", ...bundle.numbers.map((n) => `\\item ${latex(numberText(n))}`), "\\end{itemize}");
  for (const table of bundle.tables) parts.push(`\\section*{${latex(table.title)}}`, latexTable(table));
  parts.push("% Export figure files beside this .tex file: PNG, or convert SVG to PDF.");
  for (const figure of bundle.figures)
    parts.push(
      "\\begin{figure}[htbp]",
      "\\centering",
      `\\includegraphics[width=\\linewidth]{${slug(figure.name)}.${figure.png ? "png" : "pdf"}}`,
      `\\caption{${latex(figure.title)}${figure.caption ? `: ${latex(figure.caption)}` : ""}}`,
      "\\end{figure}",
    );
  parts.push("\\section*{Column dictionary}", latexTable(dictionary(bundle)), "\\end{document}");
  return { filename: `${slug(bundle.title)}.tex`, mime: "application/x-latex;charset=utf-8", data: `${parts.join("\n")}\n` };
}

// JSON string syntax is also valid Python string syntax; decoding twice keeps
// JSON booleans/null and arbitrary quotes/backslashes out of Python source.
function pythonJson(value: unknown): string {
  return `json.loads(${JSON.stringify(JSON.stringify(value))})`;
}

export function toPython(bundle: ExportBundle): ExportFile {
  const { tables: _tables, figures: _figures, ...meta } = bundle;
  const parts = [
    "# Generated by AEI. Requires pandas.",
    "import pandas as pd",
    "import io",
    "import json",
    "",
    `metadata = ${pythonJson(meta)}`,
    `column_dictionary = ${pythonJson(Object.fromEntries(bundle.tables.map((t) => [t.name, t.columns])))}`,
    "",
    "tables = {}",
  ];
  const used = new Set<string>();
  for (const table of bundle.tables) {
    const base = slug(table.name).replace(/-/g, "_");
    let variable = /^\d/.test(base) || pythonKeywords.has(base) ? `table_${base}` : base;
    while (
      used.has(variable) ||
      ["pd", "io", "json", "metadata", "column_dictionary", "tables", "name", "frame", "print", "range"].includes(variable)
    )
      variable = `table_${variable}`;
    used.add(variable);
    parts.push(
      "",
      `${variable} = ${table.columns.length ? `pd.read_csv(io.StringIO(${pythonJson(csv(table, false))}), skip_blank_lines=False)` : `pd.DataFrame(index=range(${table.rows.length}))`}`,
      `tables[${JSON.stringify(table.name)}] = ${variable}`,
    );
  }
  parts.push("", "for name, frame in tables.items():", "    print(name, frame.shape)", "");
  return { filename: `${slug(bundle.title)}.py`, mime: "text/x-python;charset=utf-8", data: parts.join("\n") };
}

const pythonKeywords = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(
    " ",
  ),
);
