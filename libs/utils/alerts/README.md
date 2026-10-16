# @aei/alerts

Infection-control alerts: rules that fire on a single result (D-014,
D-021) and the live statistical detectors (D-020).

    cpeAlerts(records, window)          // any CPE isolate
    newInUnitAlerts(records)            // first MRSA or VRE in a unit after 180 days without one
    detectorAlerts(signals)             // one alert per @aei/detect signal episode
    carrierAlerts(arrivals, window)     // from @aei/relations carrierArrivals; not pushed (D-022)
    buildAlerts(records, cultures)      // CPE, new in unit and detector alerts over a history, newest first
    sortAlerts([...a, ...b])            // newest first; CPE, new in unit, detectors, carriers on a day

- **CPE:** every isolate flagged CPE is an alert on its sample date.
- **New in unit** (D-021): an MRSA or VRE isolate in a unit that had none
  in the previous `NEW_IN_UNIT_DAYS` (180). Silent for the first 180 days
  of the data, where the look-back would reach before it begins.
- **Detector:** the first day of each episode of the live detectors in
  `@aei/detect` (`liveSignals`): clusters by profile, ESBL/MRSA/VRE/CPE
  surges, sampling drops, rising trends. `ward` is null for hospital-wide
  trends.
- **Carrier:** a patient with ESBL, MRSA, VRE or CPE found in one unit and
  sampled in another within 90 days (D-012). Kept per patient, but left
  out of `buildAlerts` (D-022): almost none is confirmed in the new unit.

Every alert depends only on samples up to its date, so a server builds
them once and releases them as its replay clock moves.

Not here yet: ward against hospital.

Relies on: D-004, D-012, D-014, D-020, D-021, D-022. Tests: `src/alerts.test.ts`.
