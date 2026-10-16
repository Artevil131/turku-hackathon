# @aei/eucast

Microbiology facts for the dataset's 9 organisms and 13 antibiotics, from
EUCAST Expected Resistant Phenotypes v1.2 (the dataset's stated basis),
EUCAST Expert Rules v3.2 and the clinical breakpoint tables.

    isIntrinsic(organism, antibiotic)      // resistant by nature
    hasNoBreakpoint(organism, antibiotic)  // not a treatment option, never reported
    suitsSpecimen(antibiotic, specimen)    // urine-only agents, screens excluded
    inferredResult(record, antibiotic)     // S. aureus beta-lactams from cefoxitin; E. faecalis TZP from AMP
    effectiveResult(record, antibiotic)    // { result, basis }: intrinsic, tested, inferred, no-breakpoint, untested

The dataset leaves out intrinsic pairs it does not report and leaves some
pairs untested that are not intrinsic (ceftazidime is tested only on
*Pseudomonas*; *S. saprophyticus* only on trimethoprim and nitrofurantoin).
`effectiveResult` keeps those apart, so a coverage estimate never counts a
missing result as susceptible or as resistant by accident. How each basis
counts in a coverage estimate is a statistical choice for DECISIONS.md.

Entries marked `check` rest on our reading of EUCAST and await review:
*P. aeruginosa* and cefuroxime, *P. aeruginosa* and nitrofurantoin,
*E. faecalis* and trimethoprim. Over the full dataset no intrinsic pair is
reported S.

Relies on: D-004. Tests: `src/eucast.test.ts`.
