# @aei/methods

The live method registry (D-066 part 4). One definition for each of the
11 public Python `aei.methods` methods, plus the three research-export
counts. Definitions follow ENGINE.md A1–A3 and the decisions/experiments
listed on each entry. They describe what runs now, not the experimental
alternatives. No detector or coverage calculation lives here.

- `registry`: typed entries with English/Finnish names and sentences,
  parameters, inputs/output, provenance and implementing gear/export.
- `methods[id]`, `defaultsFor(id)`: lookup and parameter values. Defaults
  import the executing gears' constants; they never redefine thresholds.
- `fillSentence(entry, values, locale)`: substitutes named placeholders;
  absent parameter values use the registered defaults. Unknown placeholders
  stay visible rather than silently inventing an observation.
- `registryJson()`: serializable language-neutral definitions.

`@aei/export` uses ids on numbers and `bundle.methodIds` for additional
methods (including detectors with zero events). It expands the live-set
and coverage-ranking dependencies when generating a Methods paragraph.
The paragraph uses supplied parameter overrides, not just shipped defaults.
An unregistered external method is labelled as such. Text is based on
ENGINE.md; D-064's review of the generated wording by Artem is still needed.

Regenerate the committed JSON and both package-data copies from the root:

```sh
node --experimental-strip-types scripts/sync-methods-registry.ts
```

The script formats JSON with the repository's Biome. Registry tests check
that the snapshot describes the current definitions and the Python/R files
are byte-identical copies. Python's `aei.methods_registry()` reads its
package resource (included by uv_build with the `aei` module); R's
`aei::methods_registry()` reads `inst/registry.json` through `system.file`.
Python signature/threshold parity tests compare their effective defaults
with this snapshot. Optional absent filters, date windows and ward
registries are inputs, not method parameters. R does not port the detectors
(D-063).

Export row counts deliberately do not deduplicate to first isolates. The
coverage figure uses first isolates per patient × species × specimen in
its query window, while detectors count distinct patients or cultures
under their own definitions. A count of alerts is not a count of incidents.
