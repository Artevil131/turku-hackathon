# @aei/coverage

The doctor's empirical coverage list (D-023, provisional).

    coverage(records, { asOf, ward, specimen, sex?, windowDays = 365, minTested = 30 })
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

Relies on: D-004, D-023, D-026, D-027. Tests: `src/coverage.test.ts`.

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
