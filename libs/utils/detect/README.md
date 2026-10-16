# @aei/detect

Candidate deviation detectors (D-016) and the set the server runs live
(D-020). Each scans a whole history and returns the days it would have
signalled; the signal on day t uses only samples up to t.

    profileRule, profileExcess, phenotypeExcess, samplingDrop,
    resistanceShift, risingTrend        // detectors, thresholds as options
    episodes(signals)                   // signals with the same key within 28 days
    liveSignals(records, cultures)      // the live set, LIVE_SETTINGS
    poissonUpper, poissonLower, fisherMidPGreater, cochranArmitageRising

How each was scored, and why the live set is what it is:
experiments/0002-detectors-on-planted-events.

Relies on: D-004, D-016, D-020. Tests: `src/detect.test.ts`.
