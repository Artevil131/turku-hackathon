export interface ExportColumn {
  key: string;
  label: string;
  description?: string;
  unit?: string;
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
  label: string;
  value: string | number;
  method?: string;
  parameters?: Record<string, string | number>;
}

export interface ExportBundle {
  title: string;
  generatedAt: string;
  asOf?: string;
  mode?: "continuous" | "frozen";
  scope: Record<string, string | string[]>;
  fingerprint?: { rows: number; sha256: string };
  sourceNote?: string;
  tables: ExportTable[];
  figures: ExportFigure[];
  numbers: ExportNumber[];
  locale?: "en" | "fi";
}

export interface ExportFile {
  filename: string;
  mime: string;
  data: string | Uint8Array;
}
