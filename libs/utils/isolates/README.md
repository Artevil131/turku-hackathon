# @aei/isolates

What the web app's engines (`@aei/empiric`, `@aei/signals`) share, over the
feed's `Result` (`@aei/feed`): calendar arithmetic on ISO dates, the
organiser's first-isolate rule with a cached index, patient attributes and
the shared rules.

    firstIsolates(results, from, to, keep?)      // first per patient, organism, specimen in (from, to]
    indexResults(results) + firstPositions(...)  // the same rule over a sorted index, cached per results array
    isolateKey, compareResults, windowRange
    addDays, addMonths, daysBetween, monthStart, monthEnd, weekStart, ...   // UTC, YYYY-MM-DD
    ageBandOf(age)   // "under65" | "65plus"
    onsetOf(result)  // "hospital" from day 3 of the stay, else "community"
    MIN_ISOLATES     // 30: no percentage from fewer first isolates
    type Catalog, Share, AgeBand, Onset

`keep` is applied before de-duplication, so a count answers "patients like
this one" (open question 1 in `apps/web/README.md`). The age boundary and
the hospital-onset rule are provisional, not yet in DECISIONS.md.

**Relation to `@aei/counting`.** Same organiser's rule. `@aei/counting`
works on the dataset's records (`@aei/domain`) with a closed period
[from, to]; this gear works on the feed's `Result` with a half-open window
(from, to] ending on the day shown, and adds the sorted index the screens
need to count the same released results many times per render. One of the
two should become the only implementation once the team settles which record
type the counting gears take.

Relies on: D-004, D-005. Tests: `src/counting.test.ts`, `src/dates.test.ts`,
`src/patients.test.ts`.
