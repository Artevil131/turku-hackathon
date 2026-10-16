// Minimal RFC 4180 CSV parser: comma separator, optional double quotes,
// "" as an escaped quote, LF or CRLF line ends. Enough for the organiser's
// files; not a general-purpose parser.

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, ""));
  const header = rows.shift();
  if (!header) return [];
  return rows.filter((r) => !(r.length === 1 && r[0] === "")).map((r) => Object.fromEntries(header.map((name, i) => [name, r[i] ?? ""])));
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
