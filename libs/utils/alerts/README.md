# @aei/alerts

Infection-control alerts that fire on a single result, without statistics
(D-014).

    cpeAlerts(records, window)          // any CPE isolate
    carrierAlerts(arrivals, window)     // from @aei/relations carrierArrivals
    sortAlerts([...a, ...b])            // newest first, CPE first on a day

- **CPE:** every isolate flagged CPE is an alert on its sample date.
- **Carrier:** a patient with ESBL, MRSA, VRE or CPE found in one unit and
  sampled in another within 90 days (D-012).

Not here yet: VRE or MRSA "new in a ward" (needs a look-back period),
clusters, ward against hospital and trends. Those wait for their
decisions (CONTEXT.md question 11).

Relies on: D-004, D-012, D-014. Tests: `src/alerts.test.ts`.
