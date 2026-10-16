# Usability metrics (METRICS.md section U), design night 2026-10-17

One line per metric, from benchmarks/METRICS.md section U:

- **U1** Clicks and seconds from opening the app to the doctor's list for a named context (target: at most 3 clicks, 10 s laptop, 15 s phone).
- **U2** Clicks from the signal feed to the isolates behind an alert (target: 1).
- **U3** Every number on screen carries its count and as-of date in the same element or its direct label, checked over the DOM (target: yes per view).
- **U4** Lighthouse accessibility score at least 95, WCAG AA contrast pass, and S/R and alert state never by colour alone (target: 95; pass; pass).
- **U5** Finnish and English i18n tables both complete (target: 0 missing keys).
- **U6** Time to first meaningful content, measured as LCP on a production build with Lighthouse mobile and simulated 4G (target: at most 2.5 s).
- **U7** Replay timeline: scrub, play, pause, jump to a date, and every panel shows its as-of date (target: all present).

Measured by `measure.sh` in this folder (`sh measure.sh <label>`). Lighthouse JSON is in `lighthouse/`.

| clock | commit | label | U1 clicks/s | U2 clicks | U3 | U4 a11y home/doctor/research + contrast | U5 missing keys | U6 LCP home/doctor/research (4G) | U7 | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 01:30 | ec23f01 (clean detached checkout) | before | Named context not reachable: the doctor page opens in 1 click from home, a unit change adds 2 (select, option), but sex, age and day-3 onset cannot be entered, and the list shows example figures, not the API's coverage | Not reachable: the feed lists isolates (resistant finds), the 1 infection-control alert sits in a collapsed disclosure with Explain only, no link to its isolates | No: as-of appears only in the top bar; doctor rows show n but the figures are labelled examples; research tables have no per-panel date | a11y 100 / 96 / 100; contrast home pass, doctor FAIL (1 item: `span.muted.num`, 4.22:1, #5f7381 on #e3effa), research pass | 0 (en 213, fi 213); JSX literal hint 4 lines | 3.62 s / 3.61 s / 3.61 s (all above 2.5 s); FCP 2.30 s each | 2 of 5: play and pause (plus step one day); no scrub, no jump to a date, no speed, no per-panel as-of | U4 to U6 by measure.sh on a clean detached worktree of ec23f01 (same numbers as the first, contaminated run at 01:12, which this row replaces). U1, U2, U3, U7 by the orchestrator in the browser. Doctor LCP element: `p.field-hint` in the context form |

The first run at 01:12 (ec23f01 plus other agents' uncommitted edits) gave identical U4 to U6 numbers; it is replaced by the clean row above.
