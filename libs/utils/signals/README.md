# @aei/signals

Deviation detection over the feed's released results: what the Alerts,
Treat and Timeline screens show. Strictly causal: a call for `asOf` only
looks at results sampled on or before it.

    detectSignals(results, asOf, catalog, options?)   // Signal[]: one per episode, stable ids
    visibleSignals(signals, asOf)                     // cut a list to what was known on asOf
    groupEpisodes(signals), episodeOf(...)            // one story per outbreak, for the reader only
    resetSignalCache()
    cochranArmitageUp, fisherMidPGreater, poissonUpper, poissonLower, normalUpper, logFactorial
    ALWAYS_ALERT_FLAGS                                // ["cpe", "vre"]: alarming on a single find
    DEFAULT_SIGNALS and every threshold constant (SURGE_*, CLUSTER_*, GAP_*, SHIFT_*, TREND_*)

Kinds: `sentinel` (an always-alert flag, or a flag back on a unit after 90
quiet days), `surge`, `cluster`, `data-gap`, `shift` (an antibiotic working
less often on a unit) and `trend` (resistance slowly rising hospital-wide).
Each day is tested on its own data; hits of the same kind and key within 28
days are one episode. Daily hits are cached per results array, so a
once-a-day call computes only the new day. Every key comes from the results;
nothing names a unit, organism, antibiotic or specimen. The thresholds are
provisional and listed for the team in `apps/web/README.md`. How this set
scores against the planted events:
`node benchmarks/planted-events/check-signals.ts <isolates.json> <meta.json>`.

**Relation to `@aei/detect` and `@aei/alerts`.** `@aei/detect` holds the
candidate detectors of experiments/0002 and the set the server runs live
(D-016, D-020, D-022); `@aei/alerts` turns them and the CPE and MRSA/VRE
rules (D-014, D-021) into the server's alerts, over the dataset's records.
This gear is the set the web app runs from the feed alone, day by day, so
the app works against any feed: its own six kinds, thresholds and episode
rule, plus the reader-facing grouping the Alerts screen needs. The two sets
are not the same method. Which one is the product's is for the team to
decide from the benchmark; the app's analysis door (`apps/web/src/analytics`)
can then ask a server running either.

Relies on: D-004, D-005, D-016 (alphas from experiments/0002's notes).
Tests: `src/signals.test.ts`, `src/episodes.test.ts`.
