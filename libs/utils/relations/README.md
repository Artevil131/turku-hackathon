# @aei/relations

Relation layers between units (D-009), computed from loaded data.

    const flows = patientFlows(data.cultures, { from, to });   // Flow[]
    nextUnits(flows, "ICU"); previousUnits(flows, "ICU"); undirectedFlows(flows);

    const trails = phenotypeTrails(data.cultures, records, { window, phenotype: "esbl" });
    const links = trailLinks(trails, window);                  // TrailLink[]
    carrierArrivals(trails, window);                           // one row per carrier move

Moves and trail steps depend only on earlier samples, so a server computes
`patientMoves(cultures)` and `phenotypeTrails(cultures, records)` once and
cuts them to any window with `countFlows`, `trailLinks` and
`carrierArrivals`.

- **Patient flow** (D-011): a patient's sample in unit B whose previous
  sample was in unit A is a move A → B, counted once per patient. A move is
  dated by B's sample. Pass every culture, negative ones too.
- **Phenotype trail** (D-012): a patient with ESBL, MRSA, VRE or CPE found
  in unit A and later sampled in unit B (any result) within 90 days of the
  latest find (`maxDays`) is a carrier moving A → B. `confirmed` counts the
  carriers whose sample in B showed the phenotype again.
- **Window** (D-013): both follow the view's window (four weeks, a year) as
  the replay clock moves; finds up to `maxDays` before the window still
  count as origins, so pass that much data before the window.

These show where patients are sampled next, not proven transmission.
Inputs are structural (`Sample`, `Find`): `Culture` and `IsolateRecord`
from @aei/domain fit. Pure functions, browser and Node.

Relies on: D-004, D-009, D-011, D-012, D-013. Tests: `src/relations.test.ts`.
