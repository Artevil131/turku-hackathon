import type { Paragraph, Table } from "docx";
import type { ExportBundle, ExportFigure, ExportFile, ExportTable } from "./bundle.ts";
import { toMethodsParagraph } from "./methods.ts";
import { dictionary, metadata, numberText, slug, text } from "./text.ts";

export function figureSvgFile(figure: ExportFigure): ExportFile {
  return { filename: `${slug(figure.name)}.svg`, mime: "image/svg+xml", data: figure.svg };
}

export function figurePngFile(figure: ExportFigure): ExportFile {
  if (!figure.png) throw new Error(`No PNG supplied for figure: ${figure.name}`);
  return { filename: `${slug(figure.name)}.png`, mime: "image/png", data: figure.png.bytes };
}

// docx is about 1 MB of source and only an export needs it, so it loads on the first export.
type Docx = typeof import("docx");

function wordTable({ Paragraph, Table, TableCell, TableRow, TextRun }: Docx, table: ExportTable): Table | Paragraph {
  if (!table.columns.length) return new Paragraph("No columns.");
  const row = (values: string[], header = false) =>
    new TableRow({
      tableHeader: header,
      children: values.map(
        (value) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold: header })] })] }),
      ),
    });
  return new Table({
    rows: [
      row(
        table.columns.map((c) => c.key),
        true,
      ),
      ...table.rows.map((r) => row(table.columns.map((c) => text(r[c.key])))),
    ],
  });
}

export async function toDocx(bundle: ExportBundle): Promise<ExportFile> {
  const docx = await import("docx");
  const { Document, HeadingLevel, ImageRun, Packer, Paragraph } = docx;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: bundle.title, heading: HeadingLevel.TITLE }),
    ...metadata(bundle).map(([key, value]) => new Paragraph(`${key}: ${value}`)),
  ];
  if (bundle.numbers.length)
    children.push(
      new Paragraph({ text: "Numbers", heading: HeadingLevel.HEADING_1 }),
      ...bundle.numbers.map((number) => new Paragraph({ text: numberText(number), bullet: { level: 0 } })),
    );
  children.push(new Paragraph({ text: "Methods", heading: HeadingLevel.HEADING_1 }), new Paragraph(toMethodsParagraph(bundle)));
  for (const table of bundle.tables)
    children.push(new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_1 }), wordTable(docx, table));
  for (const figure of bundle.figures) {
    children.push(new Paragraph({ text: figure.title, heading: HeadingLevel.HEADING_1 }));
    if (figure.png) {
      const { width, height, bytes } = figure.png;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        throw new Error(`Invalid PNG dimensions for figure: ${figure.name}`);
      // docx transformation dimensions are pixels at 96 dpi; 16 cm is 604.72 px.
      const scale = Math.min(1, ((16 / 2.54) * 96) / width);
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: "png",
              data: bytes,
              transformation: { width: width * scale, height: height * scale },
              altText: { name: figure.title, title: figure.title, description: figure.caption ?? figure.title },
            }),
          ],
        }),
      );
    } else children.push(new Paragraph("Figure omitted: no PNG supplied. Export the SVG separately."));
    if (figure.caption) children.push(new Paragraph(figure.caption));
  }
  children.push(new Paragraph({ text: "Column dictionary", heading: HeadingLevel.HEADING_1 }), wordTable(docx, dictionary(bundle)));
  const document = new Document({ title: bundle.title, sections: [{ children }] });
  // Packer's arraybuffer target uses JSZip in both Node and browsers, no Buffer/DOM required.
  return {
    filename: `${slug(bundle.title)}.docx`,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    data: new Uint8Array(await Packer.toArrayBuffer(document)),
  };
}
