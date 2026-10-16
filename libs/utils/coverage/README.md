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

    suggest(result, "mild" | "severe")     // ordered for an empirical choice (D-026)

`suggest` puts first the antibiotics whose whole 95 % interval clears 80 %
(mild) or 90 % (severe), WHO AWaRe Access before Watch, then those whose
estimate clears but interval does not, then the rest; "not assessable"
when no level has 30 results or over 20 % of the pool is untested. Known
problem, under review: all-organism coverage counts Enterococcus and
staphylococci against nitrofurantoin and mecillinam, so for cystitis the
rule can rank Watch drugs (piperacillin-tazobactam, ciprofloxacin) above
nitrofurantoin. Do not show the order to doctors until reviewed.

Why a year and not four weeks: experiments/0004. Why sex is a filter:
experiments/0005 (urinary *E. coli* ciprofloxacin, men OR 1.9). Informs;
does not prescribe.

Relies on: D-004, D-023, D-026. Tests: `src/coverage.test.ts`.
