# experiments

The lab notebook (PROTOCOL.md). One directory per experiment,
`NNNN-slug/README.md`, started from `TEMPLATE.md`. The README in each
directory is the record; this table is only a way in, so when it and a
record disagree, the record wins. Add a row when an experiment closes.

| No. | Question | Status | Result in one line | Language |
|---|---|---|---|---|
| [0001](0001-planted-events/) | Does the synthetic dataset contain planted events? | accepted | Four: Urology ESBL *E. coli* cluster (Jun 2025), ICU MRSA cluster (Mar 2026), a week without samples at PHC-S (Dec 2025), trimethoprim resistance in urinary *E. coli* rising 15 to 20 % | Python |
| [0002](0002-detectors-on-planted-events/) | Which simple detectors find the planted events, how early, at what cost? | accepted | Four detectors catch every planted event at about 5 other episodes a year, thresholds tuned on those events (see its review corrections); became the live set (D-020) | Python |
| 0003 | Which small model should power the plain-language layer? | proposed | On branch `ui/web-app`, not here | – |
| [0004](0004-coverage-estimators/) | Which estimate of a ward's coverage predicts the next four weeks best? | accepted | Refuted: the hospital's last year predicts best; the unit's last 28 days is worst (+0.006 Brier); basis of D-023 | Python |
| [0005](0005-patient-factors/) | Do patient factors predict coverage better than the hospital's last year? | accepted | Refuted: they add nothing (Brier +0.0001), except men and urinary ciprofloxacin (OR 1.9) | Python |
| [0006](0006-trends-by-ward-type/) | Does testing trends by ward type find the drifts the hospital-wide test misses? | accepted | No: *Pseudomonas* piperacillin-tazobactam reaches p 3.3e-3 among inpatients, not 0.001; live set unchanged | Python |
| [0007](0007-injected-events/) | How often and how fast do the live detectors catch injected events? | accepted | Half refuted: clusters of 4+ of rare strains caught in 95 % of trials (median 5 days; common strains: see 0011); 3-day sampling gaps in only 25 % (5-day 83 %) | Python |
| [0008](0008-regional-signals/) | What odd regional signals does THL county data show, and how does the synthetic hospital compare? | accepted | 10 county signals in 33 months (2 in Varsinais-Suomi); the synthetic hospital does not follow its county (r −0.03) | Python |
| [0009](0009-empty-day-runs/) | Does a rule on runs of empty days catch short sampling gaps? | accepted | Yes: 3-day gaps caught in 93 % of trials against 25 %, about 1 more episode a year; became D-031 | Python |
| [0010](0010-coverage-as-shipped/) | Does the coverage list as shipped deliver the coverage it claims in the following month? | accepted | Claims hold (mild clears 96.6 % in spectrum, severe 95.4 % realised; calibrated), but mild picks cover only 75.4 % of all organisms; mild 2.7 points below the antibiogram's ciprofloxacin unless untested isolates count against it | TypeScript + Python |
| [0011](0011-common-profile-injections/) | Do the live detectors catch a cluster of a common profile? | accepted | Common strains not detected (1/180 clusters of 4–8 of the commonest resistant profile, 0/90 in large units; wild type invisible by design); common ESBL *E. coli* 56/60 at 6 patients but 33/60 at 4 | Python |

Experiments run with `uv run python experiments/NNNN-slug/<script>.py`
from the repository root (D-024; 0001 to 0007 were ported from TypeScript
with parity tests, D-030). Each record names its command and output; a
"Port to Python" section at the end of a record gives the current one.

    git log --oneline -- experiments/              # the timeline
    grep -H '^status:' experiments/*/README.md     # status of every record
