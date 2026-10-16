// Reads lab messages written by test_ingest_roundtrip.py and prints what @aei/ingest makes of them, as JSON.
//   node libs/utils/py/tests/ingest_dump.ts <hl7 file> <fhir file> <csv file>
import { readFileSync } from "node:fs";
import { ingest } from "../../ingest/src/index.ts";

const [hl7, fhir, csv] = process.argv.slice(2) as [string, string, string];
console.log(
  JSON.stringify({
    hl7: ingest(readFileSync(hl7, "utf8"), "hl7v2"),
    fhir: ingest(readFileSync(fhir, "utf8"), "fhir"),
    csv: ingest(readFileSync(csv, "utf8"), "csv"),
  }),
);
