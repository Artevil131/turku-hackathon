export type { ExportBundle, ExportColumn, ExportFigure, ExportFile, ExportNumber, ExportTable } from "./bundle.ts";
export { type NotebookTarget, pythonAnalysis, pythonNotebook, rAnalysis, rNotebook } from "./notebooks.ts";
export { packageFiles, toResearchPackage } from "./package.ts";
export { alertInScope, type ProjectBundleLabels, projectBundle } from "./project.ts";
export { alertTable, isolateTable } from "./tables.ts";
export { toCsv, toCsvFiles, toJson, toLatex, toMarkdown, toPython } from "./text.ts";
export { figurePngFile, figureSvgFile, toDocx } from "./word.ts";

export const exportFormats: { id: "zip" | "csv" | "json" | "md" | "tex" | "docx" | "py"; label: string }[] = [
  { id: "zip", label: "Research package (.zip)" },
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
  { id: "md", label: "Markdown" },
  { id: "tex", label: "LaTeX" },
  { id: "docx", label: "Word (.docx)" },
  { id: "py", label: "Python" },
];

export { methodNumber, methodsNumbers, toMethodsParagraph } from "./methods.ts";
