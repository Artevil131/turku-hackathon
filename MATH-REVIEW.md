# Math review: what the screen says against what runs

Started 2026-10-17 evening. One row per thing the researcher reads about a
signal: what the card said, what the code computes (`libs/utils/detect`,
`libs/utils/alerts`, `LIVE_SETTINGS`), what ENGINE.md A3 states, the
verdict, and the fix. Fixes marked *done* are in `libs/utils/i18n/src/
surfaces/card.ts` and `apps/web/src/components/research/math/AlertMath.tsx`.
The wording itself is a proposal (DECISIONS D-067), pending Artem.

| Element | Card said | Code and ENGINE A3 | Verdict | Fix |
|---|---|---|---|---|
| Profile excess sentence | "compare with what the unit's own last year predicts" | μ = unit's patients (organism+specimen, 28 d) × (profile isolates hospital-wide + ½)/(all isolates of the organism+specimen + 1) over the 365 days before the window; needs ≥ 50 baseline isolates | **wrong**: the baseline is hospital-wide, not the unit's | done: "how often the profile appeared across the whole hospital in the year before, scaled to this unit's patients" |
| Phenotype excess sentence | "the unit's own last year" | μ from the unit's own share over its 365 days | right | minimums (y ≥ 2, 50 isolates) in the ⓘ: done |
| "chance of n or more by luck" | upper tail | P(Y ≥ y \| Poisson μ) | right | test named in the ⓘ: done |
| Minimums (y ≥ 3 / y ≥ 2; 50 baseline isolates) | absent | `minObserved`, `baseAll < 50 → skip` | gap | in the ⓘ: done |
| Alpha | absent | 10⁻⁴ profile, 10⁻³ phenotype | gap | in the ⓘ with the D-number: done |
| Sampling drop | "cultures this week vs usual week" | 7-day count vs 7 × mean daily over 56 d, P(Y ≤ y) < 10⁻⁴ | right | lower tail named in the ⓘ: done |
| Empty run | "no cultures for n days, usually about x a day" | e^(−λL) < 10⁻³ | right | formula in the ⓘ: done |
| Trend sentence | "share in each 28-day period, now X %, rise steeper than chance" | one-sided Cochran–Armitage over all 28-day bins since the data start, ≥ 13 bins, hospital-wide, 22 pairs, p < 10⁻³, cluster isolates excluded | **incomplete**: whole-history slope, hospital-wide; "now X %" is only the last bin | done: "hospital-wide … since the data began … rises along the periods"; ⓘ says 22 pairs and that no multiplicity correction is applied |
| Sentinel sentence | "the first MRSA here in 180 days" | inpatient units only; silent in the first 180 days of data | incomplete | done: "on this inpatient unit"; the ⓘ states the silence |
| CPE | "every CPE is an alert" | every isolate, on its sample date | right | ⓘ: sample date, D-014 |
| Surprise | −log10 p, "1 in N by chance", N = 1/p, capped at 1 in 1 000 000 | the one-sided tail p | right, but p is "this many or more by chance if nothing changed", not "probability of an outbreak" | the ⓘ (`cardSurpriseInfo`) must say so: open |
| "Usual 0.0" | one decimal | expected can be 0.02 | misleading | done: "less than 0.1 usual" below 0.05 |
| Observed bar label | "n patients" | distinct patients in the window (not isolates) | right | — |
| Reach chips | counts | flows in the incident's window, trails 90 d (A4) | right, descriptive | the chips say "patients", not probability: keep; a spread expectation is proposed in the plan |

## Open after this pass

- Multiplicity on the 22 trend pairs (none applied): a decision, not a wording.
- The Beta-binomial predictive (D-041) as the tail of the excess detectors: an
  experiment before it replaces Poisson (harness D1–D7, planted events).
- Weekday-adjusted λ for sampling.
- The surprise ⓘ wording (above).
