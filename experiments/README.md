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
| [0012](0012-discounted-beta-binomial/) | Does the discounted Beta-binomial react to outbreaks without losing accuracy? | accepted | No replacement: C1 +0.0002 against the hospital year, C8 worse than shipped, E1 reached in 48 days (shipped 47) | Python |
| [0013](0013-dirichlet-organism-mix/) | Does splitting coverage into organism mix and per-organism Beta, and WISCA by episode, change the doctor's number? | accepted | No: C1 +0.0001 (−0.0000 to +0.0002); ENGINE.md 2.4's variance confirmed; WISCA lowers the top severe pick by 0.5 points | Python |
| [0014](0014-pooling-levels/) | Which pooling level, with or without onset, predicts a unit's coverage best? | accepted | The year-1 pick is the hospital pool; no level meets the replacement rule | Python |
| [0015](0015-gamma-poisson-guard-band/) | Does a Gamma-Poisson test with guard band and FDR beat the live set's D5? | accepted | Refuted: D5 rare 0.205 against 0.92; on phenotype series alone it matches the live phenotype test | Python |
| [0016](0016-cusum/) | Do Poisson and Bernoulli CUSUMs beat the live set's D5? | accepted | No: D5 rare 0.665 and common ESBL 0.485 against 0.92 and 0.75; held-out seeds agree | Python |
| [0017](0017-farrington-noufaily/) | Does the improved Farrington algorithm beat the live set's D5? | accepted | Refuted: D5 rare 0.31, common ESBL 0.24; down-weighting never acts | Python |
| [0018](0018-bocpd/) | Does Bayesian online change-point detection beat the live set's D5? | accepted | Refuted: D5 rare 0.14, common ESBL 0.135 | Python |
| [0019](0019-exposure-ranking/) | Does patient-flow exposure rank the units where ESBL and MRSA rise next? | accepted | Not above the permutation null: pooled AUC 0.63 (p 0.22) over 24 real episodes; E1 and E2 undefined | Python |
| [0020](0020-county-forecasts/) | Does a rolling Poisson GLM beat persistence on THL county counts one month ahead? | accepted | Yes, as a 24-month rolling mean: log skill +0.40 (0.31 to 0.48); VRE's skill mostly persistence's floor (review) | Python |
| [0021](0021-naming-step/) | Can every alert be named into ENGINE.md's five kinds by rule? | accepted | Yes: all 50,521 signals named; D7 0.974 (0.966 to 0.980) for the live set; D-034 grouping reproduces | Python |
| [0022](0022-ensemble/) | Does combining the live set and the CUSUM raise D5? | accepted | Not at 5 episodes a year (held out 0.966 / 0.772 against 0.960 / 0.817); a post-hoc stack is above at 3 a year | Python |
| [0023](0023-beta-binomial-tail/) | Does the Beta-binomial predictive tail beat the Poisson tail for profile and phenotype excess? | accepted | No, do not ship: D5 rare 0.925 and common ESBL 0.760 at best against 0.920 and 0.750 at 3.01 episodes a year (intervals ±0.06); m has no effect, the discount lowers both | Python |

Experiments run with `uv run python experiments/NNNN-slug/<script>.py`
from the repository root (D-024; 0001 to 0007 were ported from TypeScript
with parity tests, D-030). Each record names its command and output; a
"Port to Python" section at the end of a record gives the current one.

    git log --oneline -- experiments/              # the timeline
    grep -H '^status:' experiments/*/README.md     # status of every record
