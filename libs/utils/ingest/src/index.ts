export * from "./codes.ts";
export * from "./csv.ts";
export * from "./fhir.ts";
export * from "./hl7v2.ts";
export * from "./record.ts";

import type { CodeMaps } from "./codes.ts";
import { parseIsolateCsv } from "./csv.ts";
import { parseFhirBundle } from "./fhir.ts";
import { parseHl7Batch } from "./hl7v2.ts";
import { emptyResult, type IngestResult, mergeResults } from "./record.ts";

export type IngestFormat = "hl7v2" | "fhir" | "csv";

/** An MLLP start byte (0x0B) or a byte-order mark before the payload. */
const LEADING_NOISE = new RegExp(`^[${String.fromCharCode(0x0b, 0xfeff)}]`);

/** The format of a payload from its content type, else from its first characters. */
export function detectFormat(body: string, contentType = ""): IngestFormat | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("fhir") || ct.includes("json")) return "fhir";
  if (ct.includes("hl7") || ct.includes("er7")) return "hl7v2";
  if (ct.includes("csv")) return "csv";
  const head = body.trimStart().replace(LEADING_NOISE, "");
  if (head.startsWith("MSH")) return "hl7v2";
  if (head.startsWith("{")) return "fhir";
  if (head.includes(",") || head.includes(";")) return "csv";
  return null;
}

/** Any supported payload to rows in the dataset's shape. */
export function ingest(body: string, format: IngestFormat, options: { maps?: CodeMaps; guideline?: string } = {}): IngestResult {
  if (format === "fhir") return parseFhirBundle(JSON.parse(body), options);
  if (format === "hl7v2") return parseHl7Batch(body, options).reduce(mergeResults, emptyResult());
  return parseIsolateCsv(body, options);
}
