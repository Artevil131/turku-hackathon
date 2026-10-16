# experiments

The lab notebook (PROTOCOL.md). One directory per experiment,
`NNNN-slug/README.md`, started from `TEMPLATE.md`. The README in each
directory is the record; this table is only a way in, so when it and a
record disagree, the record wins. Add a row when an experiment closes.

| No. | Question | Status | Result in one line | Language |
|---|---|---|---|---|
| [0001](0001-planted-events/) | Does the synthetic dataset contain planted events? | accepted | Four: Urology ESBL *E. coli* cluster (Jun 2025), ICU MRSA cluster (Mar 2026), a week without samples at PHC-S (Dec 2025), trimethoprim resistance in urinary *E. coli* rising 15 to 20 % | TS |
| [0002](0002-detectors-on-planted-events/) | Which simple detectors find the planted events, how early, at what cost? | accepted | Four detectors catch every planted event (clusters in 0 to 4 days, the gap in 3) at about 5 other episodes a year; became the live set (D-020) | TS |
| 0003 | Which small model should power the plain-language layer? | proposed | On branch `ui/web-app`, not here | – |
| [0004](0004-coverage-estimators/) | Which estimate of a ward's coverage predicts the next four weeks best? | accepted | Refuted: the hospital's last year predicts best; the unit's last 28 days is worst (+0.006 Brier); basis of D-023 | TS |
| [0005](0005-patient-factors/) | Do patient factors predict coverage better than the hospital's last year? | accepted | Refuted: they add nothing (Brier +0.0001), except men and urinary ciprofloxacin (OR 1.9) | TS |
| [0006](0006-trends-by-ward-type/) | Does testing trends by ward type find the drifts the hospital-wide test misses? | accepted | No: *Pseudomonas* piperacillin-tazobactam reaches p 3.3e-3 among inpatients, not 0.001; live set unchanged | TS |
| [0007](0007-injected-events/) | How often and how fast do the live detectors catch injected events? | accepted | Half refuted: clusters of 4+ caught in 95 % of trials (median 5 days); 3-day sampling gaps in only 25 % (5-day 83 %) | TS |
| [0008](0008-regional-signals/) | What odd regional signals does THL county data show, and how does the synthetic hospital compare? | accepted | 10 county signals in 33 months (2 in Varsinais-Suomi); the synthetic hospital does not follow its county (r −0.03) | Python |

TypeScript experiments run with `node experiments/NNNN-slug/<script>.ts`,
Python ones with `uv run python experiments/NNNN-slug/<script>.py` (D-024),
from the repository root. Each record names its command and output.

    git log --oneline -- experiments/              # the timeline
    grep -H '^status:' experiments/*/README.md     # status of every record
