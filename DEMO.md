# Demo

    pnpm demo

Starts the server with results up to 1 June 2025 and the app at
http://localhost:5173. Press Enter and a stand-in laboratory system sends
2 to 14 June as HL7 v2 messages, one day every 3 seconds
(`scripts/demo.sh`; `scripts/demo.sh 5` slows it down). Every number below
was read from the running server on 2026-10-17 and traces to the
experiment or decision named beside it.

## 1. The lab feed arrives

The terminal shows each day's batch: about 40 cultures a day, sent as
HL7 v2.5.1 ORU^R01 with THL's national codes (`7640-22` *E. coli*, `12`
ceftriaxone), the format Tyks's lab system sends inside the hospital
(D-035, D-036, deploy/integration.md). Every batch passes the fifteen data
checks; so do the 10,000 patients already loaded (`/api/quality`, D-038).

## 2. The outbreak alert, 4 June

On the 4 June batch the app raises: "On 2025-06-04, 4 patients in Urology
shared one resistance profile of *Escherichia coli* within 28 days, where
about 0.2 were expected." This is the ESBL *E. coli* cluster planted in
the dataset (experiments/0001), caught by the profile-excess detector
(0002, D-020). On 8 June an ESBL excess in Urology joins the same
incident instead of raising a second one (D-034).

## 3. What works on that ward

Open the doctor's view for Urology, urine (as of 8 June, the unit's own
563 isolates since 9 June 2024, D-023):

- Mild: mecillinam and nitrofurantoin first, both WHO Access. Mecillinam
  covers 95 % of the bacteria it is meant for, but only 74 % of
  everything that grows here; nitrofurantoin 86 % and 82 %. Say the
  second number: our backtest found the first one holds (0010) and the
  second is what the patient gets.
- Severe: piperacillin-tazobactam, 95 % (93–97 %).

## 4. The region

Seek the clock to 3 October 2025 and open the regional view (or
`/api/regional?region=Varsinais-Suomen%20hyvinvointialue`): in September
2025 Varsinais-Suomi had 8 CPE *E. coli* carriage cases against 0.6
expected, one of 3 county signals in 33 months that survive a
correction for testing 8,250 county-months (0008, D-037). This is real THL
data, not the synthetic hospital.

## What we tested, and the limits

| Claim | Evidence |
|---|---|
| Clusters of 4 or more patients with a rare resistant strain are caught in 95 % of trials, median 5 days | 0007 |
| Clusters of a common strain are not caught: 1 in 180 for the commonest resistant *E. coli*; fully susceptible strains never | 0011 |
| A 3-day gap in a unit's sampling is caught in 93 % of trials | 0009, D-031 |
| The coverage list's claims hold the next month (mild 96.6 % within spectrum, severe 95.4 %), but mild picks cover 75 % of all organisms | 0010 |
| Patient factors add nothing to coverage except men and urinary ciprofloxacin | 0005 |

The hospital data are synthetic; the integration path at Tyks rests on
public sources, with open points marked in deploy/integration.md. All
experiments rerun with `uv run python scripts/verify_experiments.py`.
