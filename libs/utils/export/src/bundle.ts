import type { MethodEntry, MethodId, ParameterValue } from "@aei/methods";

export interface ExportColumn {
  key: string;
  label: string;
  type?: "string" | "integer" | "number" | "date" | "datetime" | "boolean";
  description?: string;
  unit?: string;
  role?: "result";
}

export interface ExportTable {
  /** File-safe slug. */
  name: string;
  title: string;
  columns: ExportColumn[];
  rows: Record<string, string | number | boolean | null>[];
}

export interface ExportFigure {
  name: string;
  title: string;
  caption?: string;
  svg: string;
  png?: { bytes: Uint8Array; width: number; height: number };
}

export interface ExportNumber {
  id?: string;
  recipe?:
    | { op: "count"; table: string; where?: Record<string, string> }
    | { op: "distinct"; table: string; column: string; where?: Record<string, string> };
  label: string;
  value: string | number;
  method?: string;
  methodId?: MethodId;
  decisions?: readonly string[];
  definition?: MethodEntry;
  parameters?: Record<string, ParameterValue>;
}

export interface ExportBundle {
  title: string;
  generatedAt: string;
  appVersion?: string;
  asOf?: string;
  mode?: "continuous" | "frozen";
  scope: Record<string, string | string[]>;
  fingerprint?: { rows: number; sha256: string };
  sourceNote?: string;
  tables: ExportTable[];
  figures: ExportFigure[];
  numbers: ExportNumber[];
  /** Additional methods used to produce this cut (including detectors with no alerts). */
  methodIds?: MethodId[];
  locale?: "en" | "fi";
}

export interface ExportFile {
  filename: string;
  mime: string;
  data: string | Uint8Array;
}
