# @aei/detect

The deviation detectors the server runs live (D-020 to D-022, D-031).
Each scans a whole history and returns the days it would have signalled;
the signal on day t uses only samples up to t. Detectors only the
experiments use (profile rule, 0002's Fisher resistance shift, trends by ward type)
live in Python alone (`aei.detect`, D-032).

    profileExcess, phenotypeExcess, samplingDrop, volumeJump, emptyRun,
    risingTrend, resistanceShift                         // detectors, thresholds as options
    episodes(signals)                   // signals with the same key within 28 days
    liveSignals(records, cultures)      // the live set, LIVE_SETTINGS over SURVEILLANCE_PAIRS
    clusterSignals(records)             // the profile and phenotype excess part of the live set
    inDetectedCluster(clusters)         // (record, asOf) => inside a cluster already detected
    poissonUpper, poissonLower, normalUpper, cochranArmitageRising

The trend detector takes pairs of organism, antibiotic and, optionally,
specimen. Isolates of a cluster already detected are left out of the live trend
test from the day it is detected (D-022). The tests in `src/stats.ts` are
cross-checked against scipy by `scripts/crosscheck-stats`.

How each was scored, and why the live set is what it is:
experiments/0002-detectors-on-planted-events; sensitivity on injected
events: experiments/0007.

Relies on: D-004, D-016, D-020, D-022, D-031, D-032. Tests: `src/detect.test.ts`.
