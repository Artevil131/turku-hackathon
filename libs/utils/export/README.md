# @aei/export

Research exports from one bundle (D-059). Pure browser-safe TypeScript:
no network, filesystem, DOM or rasterisation. The app supplies the data
it is showing and, for Word or PNG downloads, rasterised PNG bytes.

    toCsv(table)             // -> ExportFile; BOM, RFC 4180, CRLF, column keys
    toCsvFiles(bundle)       // -> ExportFile[]; tables and column dictionary
    toJson(bundle)           // -> ExportFile; aei-export/1, SVG kept, PNG omitted
    toMarkdown(bundle)       // -> ExportFile; GFM tables, figure references
    toLatex(bundle)          // -> ExportFile; standalone article, longtable/booktabs
    toDocx(bundle)           // -> Promise<ExportFile>; real Word document
    toPython(bundle)         // -> ExportFile; standalone pandas script
    figureSvgFile(figure)    // -> ExportFile
    figurePngFile(figure)    // -> ExportFile; throws when no PNG is supplied
    exportFormats           // UI choices: id and label

`ExportBundle` holds a title, generation time, scope, optional as-of date,
mode, row fingerprint and source note, plus tables (column keys, labels,
units and descriptions), figures and numbers with methods and parameters.
`locale` is preserved in structured exports; document headings currently
use English. The gear formats supplied numbers, never computes statistics.
All types are re-exported from the package entry.

`ExportFile` contains `filename`, `mime` and `data` (text or `Uint8Array`).
The caller handles saving. Document filenames use an ASCII slug of the
bundle title; individual tables and figures use their `name` slug. Supply
unique file-safe names; reserve `<bundle-slug>-dictionary` for the CSV
dictionary. CSV headers use column keys, not labels. String cells starting
with `=`, `+`, `-` or `@` get an apostrophe to prevent spreadsheet formulas;
numeric cells do not. Null or absent cells are empty.

Markdown references separately downloaded SVG files. LaTeX references PNG
when supplied, otherwise PDF: convert the SVG to PDF and keep it beside the
`.tex` file. Word embeds PNGs at their original aspect ratio with a maximum
width of 16 cm; without PNG bytes it inserts a note instead. PNG dimensions
must be finite and positive. `Packer.toArrayBuffer` works in Node and the
browser, and the returned document is a `Uint8Array`.

The Python script embeds CSV strings using JSON-escaped literals (including
quotes and newlines), includes metadata and a column dictionary, and prints
each DataFrame's shape. It requires pandas at runtime, not the original CSV
files. It uses original cell values without the spreadsheet-only formula
guard. Names become Python identifiers, with prefixes to avoid keywords,
reserved names and collisions; `tables` also maps original names to frames.
Pandas applies its normal CSV type and missing-value inference.

## Checks

    pnpm --filter @aei/export typecheck
    pnpm vitest run libs/utils/export
    pnpm exec biome check libs/utils/export

Tests parse generated Python with `python3` when available; pandas is not
needed for that check. Production source uses only `docx`; Node imports
are confined to tests.
