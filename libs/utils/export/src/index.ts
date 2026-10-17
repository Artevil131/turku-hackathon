export type { ExportBundle, ExportColumn, ExportFigure, ExportFile, ExportNumber, ExportTable } from "./bundle.ts";
export { toCsv, toCsvFiles, toJson, toLatex, toMarkdown, toPython } from "./text.ts";
export { figurePngFile, figureSvgFile, toDocx } from "./word.ts";

export const exportFormats: { id: "csv" | "json" | "md" | "tex" | "docx" | "py"; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
  { id: "md", label: "Markdown" },
  { id: "tex", label: "LaTeX" },
  { id: "docx", label: "Word (.docx)" },
  { id: "py", label: "Python" },
];
