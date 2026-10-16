# @aei/coverage

The doctor's empirical coverage list (D-023, provisional).

    coverage(records, { asOf, ward, specimen, sex?, windowDays = 365, minTested = 30 })

For each antibiotic that suits the specimen: the share of first isolates
it covered over the window, at the unit if it has at least `minTested`
known results, else the unit's ward type (inpatient or outpatient), else
the hospital; a 95 % Wilson interval; the counts at every level; the
unit's last 28 days as context; and which organisms in the unit's pool it
does not cover by nature or was not tested on. Intrinsic and
no-breakpoint pairs count as not covered (`@aei/eucast`); untested pairs
are left out of the share and listed instead, so a figure such as
ceftazidime (tested only on *Pseudomonas*) can be labelled.

Why a year and not four weeks: experiments/0004. Why sex is a filter:
experiments/0005 (urinary *E. coli* ciprofloxacin, men OR 1.9). Informs;
does not prescribe.

Relies on: D-004, D-023. Tests: `src/coverage.test.ts`.
