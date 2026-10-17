import JSZip from "jszip";
import type { ExportFile, ExportTable } from "./bundle.ts";
import { csv, markdown, markdownTable, slug } from "./text.ts";

// A notebook page as a Markdown file with the CSV of each table beside it, zipped (the research package's
// jszip path). Notes are written by the researcher in Markdown and go out as written; everything else is
// escaped or fenced.

export type PageBlock =
  | { kind: "heading"; text: string }
  /** The researcher's own Markdown, kept as written. */
  | { kind: "note"; text: string }
  /** A plain line (escaped). */
  | { kind: "line"; text: string }
  | { kind: "math"; latex: string }
  | { kind: "table"; table: ExportTable }
  | { kind: "code"; lang: string; code: string };

export interface Page {
  title: string;
  /** The data clock the page was read at; it is in every file name. */
  asOf: string;
  blocks: PageBlock[];
}

const fence = (lang: string, code: string) => {
  const ticks = "`".repeat(Math.max(3, ...[...code.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${ticks}${lang}\n${code.replace(/\n+$/, "")}\n${ticks}`;
};

/** The CSV path of the page's n-th table (1-based): `<table>-<n>-<asOf>.csv`. */
export const pageTablePath = (page: Pick<Page, "asOf">, table: ExportTable, n: number) => `${slug(table.name)}-${n}-${page.asOf}.csv`;

export function pageMarkdown(page: Page): string {
  let n = 0;
  const parts = [`# ${markdown(page.title)}`];
  for (const b of page.blocks) {
    if (b.kind === "heading") parts.push(`## ${markdown(b.text)}`);
    else if (b.kind === "note") parts.push(b.text.trim());
    else if (b.kind === "line") parts.push(markdown(b.text));
    else if (b.kind === "math") parts.push(`$$\n${b.latex}\n$$`);
    else if (b.kind === "code") parts.push(fence(b.lang, b.code));
    else parts.push(`${markdownTable(b.table)}\n\n[${pageTablePath(page, b.table, ++n)}](${pageTablePath(page, b.table, n)})`);
  }
  return `${parts.filter((p) => p.length > 0).join("\n\n")}\n`;
}

export async function toPageZip(page: Page): Promise<ExportFile> {
  const name = `${slug(page.title)}-${page.asOf}`;
  const zip = new JSZip();
  zip.file(`${name}/${name}.md`, pageMarkdown(page));
  let n = 0;
  for (const b of page.blocks) if (b.kind === "table") zip.file(`${name}/${pageTablePath(page, b.table, ++n)}`, csv(b.table, false));
  return {
    filename: `${name}.zip`,
    mime: "application/zip",
    data: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  };
}
