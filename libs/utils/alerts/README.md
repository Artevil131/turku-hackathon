# @aei/alerts

Infection-control alerts: rules that fire on a single result (D-014) and
the live statistical detectors (D-020).

    cpeAlerts(records, window)          // any CPE isolate
    carrierAlerts(arrivals, window)     // from @aei/relations carrierArrivals
    detectorAlerts(signals)             // one alert per @aei/detect signal episode
    buildAlerts(records, cultures)      // all of the above over a history, newest first
    sortAlerts([...a, ...b])            // newest first; CPE, detectors, carriers on a day

- **CPE:** every isolate flagged CPE is an alert on its sample date.
- **Carrier:** a patient with ESBL, MRSA, VRE or CPE found in one unit and
  sampled in another within 90 days (D-012).

- **Detector:** the first day of each episode of the live detectors in
  `@aei/detect` (`liveSignals`): clusters by profile, ESBL/MRSA/VRE/CPE
  surges, sampling drops, rising trends. `ward` is null for hospital-wide
  trends.

Every alert depends only on samples up to its date, so a server builds
them once and releases them as its replay clock moves.

Not here yet: VRE or MRSA "new in a ward" (needs a look-back period) and
ward against hospital.

Relies on: D-004, D-012, D-014, D-020. Tests: `src/alerts.test.ts`.
