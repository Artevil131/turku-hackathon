# @aei/detect

Candidate deviation detectors (D-016) and the set the server runs live
(D-020). Each scans a whole history and returns the days it would have
signalled; the signal on day t uses only samples up to t.

    profileRule, profileExcess, phenotypeExcess, samplingDrop,
    resistanceShift, risingTrend        // detectors, thresholds as options
    episodes(signals)                   // signals with the same key within 28 days
    liveSignals(records, cultures)      // the live set, LIVE_SETTINGS over SURVEILLANCE_PAIRS
    clusterSignals(records)             // the profile and phenotype excess part of the live set
    inDetectedCluster(clusters)         // (record, asOf) => inside a cluster already detected
    poissonUpper, poissonLower, fisherMidPGreater, normalUpper, cochranArmitageRising

The shift and trend detectors take pairs of organism, antibiotic and,
optionally, specimen and setting: inpatient units (`setting: "in"`) or
the emergency department and health centres (`"out"`), as tested in
experiments/0006. Isolates of a cluster already detected are left out of the live trend
test from the day it is detected (D-022). The tests in `src/stats.ts` are
cross-checked against scipy by `scripts/crosscheck-stats`.

How each was scored, and why the live set is what it is:
experiments/0002-detectors-on-planted-events; sensitivity on injected
events: experiments/0007.

Relies on: D-004, D-016, D-020, D-022. Tests: `src/detect.test.ts`.
