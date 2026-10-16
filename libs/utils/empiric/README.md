# @aei/empiric

"What has worked lately for patients like this one?": the coverage list the
Treat screen shows, its monthly series, and the Report screen's tables built
from the same figures, over the feed's released results.

    coverage(results, asOf, query, catalog, options?)          // CoverageResult: per antibiotic, last 28 and 365 days, ranked
    monthly(results, asOf, query, antibiotic, months, catalog) // one antibiotic's share per calendar month
    reportTable(results, asOf, query, catalog)                 // antibiotics: 4 weeks next to 12 months, with the change
    reportMatrix(results, asOf, query, catalog, days)          // every unit side by side
    treatmentsFor(catalog, specimen), isScreen, shareValue, cellOf, cellValue, changeOf
    awareOf(antibiotic)                                        // WHO AWaRe 2023 group, or none
    isIntrinsicallyResistant(organism, antibiotic)             // EUCAST expected resistant phenotypes v1.2
    DEFAULT_COVERAGE, EVERY_UNIT, WIDENING_ORDER, MIN_KNOWN_SHARE, REPORT_*
    type Rank = "access-first" | "coverage", PatientQuery, CoverageResult, ReportTable, ...

`query` is `{ ward, specimen, sex?, age?, onset?, organism? }`; `ward` is
`EVERY_UNIT` ("") for all units. When even 12 months are too few, filters
are dropped in `WIDENING_ORDER` (age, sex, onset, unit; never organism or
specimen) and the result says which. A missing result counts as "doesn't
work" only when EUCAST lists the pair as expected resistant; otherwise the
isolate is left out of that antibiotic. `rank: "access-first"` puts a WHO
Access antibiotic within `accessMargin` points of the best first. These
thresholds are provisional and listed for the team in `apps/web/README.md`.
The two public tables (AWaRe, EUCAST) match organisms by Latin name and
antibiotics by English name or class, so any feed gets them; anything not
listed gets no badge and no rule.

**Relation to `@aei/coverage` and `@aei/eucast`.** `@aei/coverage` (D-023,
D-026 to D-028) is the server's estimator: 365 days, unit then ward type then
hospital, a Wilson interval, mild and severe suggestion orders and
combinations, over the dataset's records and the dataset's 9 organisms and
13 antibiotics (`@aei/eucast`, which also infers results and knows
breakpoints). This gear is what the screens show today: the organiser's
4-week and 12-month windows side by side, filter widening instead of the
ward-type fallback, no intervals, computed from the feed alone, with tables
not tied to one dataset's code list. The two are not the same method; which
one the doctor sees is a team decision (D-023 is provisional), and the app's
analysis door (`apps/web/src/analytics`) can switch to a server answering
with either.

Relies on: D-004, D-005, D-010. Tests: `src/coverage.test.ts`,
`src/report.test.ts`, `src/aware.test.ts`, `src/eucast.test.ts`.
