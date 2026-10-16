# @aei/counting

Surveillance counting rules (CONTEXT.md, "Counting rules the organiser
points to").

    firstIsolates(records, { from, to })   // first isolate per patient, organism, specimen in the period

The period is the caller's: CONTEXT.md question 8 (display window or a
fixed period) is not decided, so nothing here fixes it. Later isolates are
dropped whatever their results; there is no deduplication by phenotype.

Relies on: D-004. Tests: `src/counting.test.ts`.
