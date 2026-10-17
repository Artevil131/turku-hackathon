# @aei/coverage

The doctor's empirical coverage list (D-023, provisional).

    coverage(records, { asOf, ward, specimen, sex?, onset = "any", windowDays = 365, minTested = 30 })
    wilson(k, n)   // the 95 % Wilson interval it uses, cross-checked by scripts/crosscheck-stats

For each antibiotic that suits the specimen: the share of first isolates
it covered over the window, at the unit if it has at least `minTested`
known results, else the unit's ward type (inpatient or outpatient), else
the hospital; a 95 % Wilson interval; the counts at every level; the
unit's last 28 days as context; and which organisms in the unit's pool it
does not cover by nature or was not tested on. Intrinsic and
no-breakpoint pairs count as not covered (`@aei/eucast`); untested pairs
are left out of the share and listed instead, so a figure such as
ceftazidime (tested only on *Pseudomonas*) can be labelled.

    suggest(result, "mild" | "severe")     // ordered for an empirical choice (D-026)

`suggest` puts first the antibiotics whose whole 95 % interval clears 80 %
(mild) or 90 % (severe), WHO AWaRe Access before Watch, then those whose
estimate clears but interval does not, then the rest; "not assessable"
when no level has 30 results or over 20 % of the pool is untested.

Mild infections are judged within each antibiotic's intended spectrum
(`spectrum`: organisms with no EUCAST breakpoint left out and listed in
`outsideSpectrum` as "not for"; resistance by nature still counts
against), severe infections over all organisms (D-027). For cystitis in
women at PHC-N this puts mecillinam and nitrofurantoin first; for ICU
blood nothing clears 90 % on the year's 38 results, which the screen
should say rather than hide.

Why a year and not four weeks: experiments/0004. Why sex is a filter:
experiments/0005 (urinary *E. coli* ciprofloxacin, men OR 1.9). Informs;
does not prescribe.

## Onset (D-049)

    coverage(records, { ..., onset: "hospital" | "community" | "any" })
    onsetOf(record)                    // "hospital" from day 3 of the stay, else "community"
    barFor(result.query, severity)     // the bar the list is judged against

An isolate is hospital-acquired when its culture was sampled at least two
days after admission (`HOSPITAL_ONSET_DAYS`, day 3 of the stay);
community otherwise, including cultures without an admission date (about
60 % of isolates, QUESTIONS H5). The filter acts on the pool before the level
is chosen. Filters are dropped to keep the unit's own data, onset first:
onset and sex, then sex alone, then neither, the first that leaves the
unit `minTested` isolates; when none does, both stay on and the level
falls back to the ward type, then the hospital (D-033). `onsetApplied`
and `sexApplied` say what was kept; `query.onset` what was asked.

Hospital-acquired infections are judged against 90 % whatever the
severity (B5): `suggest` and `suggestCombinations` use
`barFor(result.query, severity)`, which follows the onset asked for, also
when the filter was dropped. Only the bar changes: a mild query is still
judged within the spectrum and without injection-only drugs. The API
returns the bar as `bar`.

Relies on: D-004, D-023, D-026, D-027, D-033, D-049. Tests: `src/coverage.test.ts`.

## Combinations (D-028)

    result.combinations                         // every pair, over all organisms, most covering first
    suggestCombinations(result, "severe")       // only when no single antibiotic clears

A pair covers an isolate if either antibiotic does, counted only on
isolates with a known result for both (keeping "covered by the tested
one" while dropping "missed by the tested one" would bias the share up).
Pairs with an antibiotic untested on over a fifth of the pool are not
assessable. For ICU blood, severe: meropenem + vancomycin clears (100 %,
91–100, 38 results), piperacillin-tazobactam + vancomycin is borderline
(97 %, 87–100). About 0.25 s per `coverage` call on the full data.
