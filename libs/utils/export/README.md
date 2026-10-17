# @aei/export

Research exports from one bundle (D-059). Pure browser-safe TypeScript:
no network, filesystem, DOM or rasterisation. The app supplies the data
it is showing and, for Word or PNG downloads, rasterised PNG bytes.

    packageFiles(bundle, opts) // -> root-relative package files; opts.docx optional
    toResearchPackage(bundle) // -> Promise<ExportFile>; research zip with Word report
    pythonNotebook(bundle)   // -> nbformat 4.5 Python reproducibility notebook JSON
    rNotebook(bundle)        // -> nbformat 4.5 R (xeus-r) notebook JSON
    pythonAnalysis(bundle)   // -> reproducibility script using aei and pandas
    rAnalysis(bundle)        // -> reproducibility script using aei in R
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
mode, row fingerprint, app version and source note, plus tables (column keys, labels,
units, descriptions and optional types: string by default, integer, number,
date, datetime or boolean), figures and numbers with methods and parameters.
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

## Research package (D-060, D-062, D-063)

The recommended download is `<title-slug>.zip`, built with JSZip (DEFLATE)
under a `<title-slug>/` folder. `packageFiles` returns the same contents
without that folder prefix and without building Word; pass `{ docx }` to
include supplied report bytes. `toResearchPackage` builds the report itself.
Supply PNG figures to include them both in the zip and the report.

The package contains Frictionless `datapackage.json` (`aei-package/1`
metadata), typed CSVs, `methods.json`, a README, figures, `analysis.py`,
`analysis.R`, `reproduce.ipynb` (Python) and `reproduce-r.ipynb` (xeus-r).
Unpack and run `import aei; pkg = aei.read_package(".")` in Python or
`library(aei); pkg <- read_package(".")` in R from the package folder.
Notebooks and scripts check the same data fingerprint, reproduce numbers,
then demonstrate weekly isolates by ward. Verification and reproduction
are provided by the separately installed Python/R packages, not this gear.
Package CSVs have **no BOM or formula guard**, preserving exact analysis
values; the guarded single-CSV downloads are unchanged. Column types are
metadata, not inferred from values. The organisers' dataset is not
redistributable; the package README limits use to local analysis.

## Checks

    pnpm --filter @aei/export typecheck
    pnpm vitest run libs/utils/export
    pnpm exec biome check libs/utils/export

Tests parse generated Python with `python3` when available; pandas is not
needed for that check. The cross-language package test runs the actual `aei`
reader with `uv` when available (offline, using the existing environment).
Production source uses only `docx` and `jszip`; Node imports are confined to tests.
