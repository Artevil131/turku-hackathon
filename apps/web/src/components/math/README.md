# Math components

Self-contained SVG React components that draw the arithmetic behind a signal or a share. Each has its own `.css` (tokens from `styles.css` via `var()` with fallbacks), bilingual copy in `libs/utils/i18n/src/surfaces/math.ts` (keys `math…`), `role="img"` with an aria-label stating the numbers, no colour-only encoding (outline, shaded band, triangle and dashed line carry meaning too), and works from 320 to 700 px (the SVG scales, max width 480 px; captions are HTML and wrap). Pure helpers live in `mathHelpers.ts` (tested in `math.test.tsx`).

Import from `./components/math` (`index.ts`). All take `locale: Locale`.

| Component | Props | Shows | Source |
| --- | --- | --- | --- |
| `PoissonTail` | `{ observed, expected, p, detector, locale }` | Bars of Poisson(expected); the tail that gave `p` as a band (k ≥ observed for profile/phenotype excess, k ≤ observed for sampling drop; for an empty run, X = 0 under Poisson(λ·L) with L = `observed` days, `expected` = λ per day); observed bar outlined and marked; dashed "usual" line; caption `P(X ≥ k \| Poisson(μ)) = p`, labelled as the live detector's test. Rising trend has no count: renders a one-line note. | ENGINE.md section 2, D-020, D-031 |
| `CoverageShape` | `{ covered, known, interval: [lo, hi] \| null, bar, locale }` (shares 0..1) | Density of Beta(covered+1, known−covered+1) over 0–100 % (flat prior), the 95 % Wilson interval band (the list's interval, D-023), the bar (0.8/0.9) as a dashed line, the share as a dot. States that the team's prior (D-038) is open. | ENGINE.md section 3, D-023, D-038 |
| `SurpriseScale` | `{ p, detector, locale }` | Inline gauge of −log10 p (0 to 6+) with the detector's alert threshold (D-020: profile 1e-4, phenotype 1e-3, sampling drop 1e-4, empty run 1e-4, trend 1e-3) as a tick and label; ▲ past the level, ▽ below it. | D-020 |
| `WeeklyWindow` | `{ weeks: {start, count}[], windowStart, observed, expected, p, alertDate, locale }` | Weekly distinct patients: baseline weeks grey, window weeks dark, dashed usual line (expected ÷ window weeks) over the window, triangle at the first signal; style of experiments/0015's figure. | ENGINE.md section 2 |

`weeklyPatients(records, ward, phenotype, from, to)` (exported by `index.ts`) builds `weeks` from `IsolateRecord`s: distinct patients per 7-day week starting at `from`, ending at or before `to` (a partial last week is dropped). For weeks that end on the as-of date pass `from = addDaysIso(asOf, -7 * n + 1)`, `to = asOf`.

Mount:

```tsx
<PoissonTail observed={a.observed} expected={a.expected} p={a.p} detector={a.detector} locale={locale} />
<SurpriseScale p={a.p} detector={a.detector} locale={locale} />
<CoverageShape covered={c.covered} known={c.known} interval={row.interval} bar={0.8} locale={locale} />
```

Guard `a.p !== undefined && a.expected !== undefined` before mounting the Poisson pair. The test hard-codes real alerts computed with `buildAlerts` over the synthetic dataset (same code as `GET /api/alerts?from=2024-06-01`) and asserts the shaded tail equals `poissonUpper`/`poissonLower` from `@aei/detect` and the reported `p` to 1e-9.
