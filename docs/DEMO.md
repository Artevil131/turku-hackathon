# Demo

    pnpm demo

Starts the server with results up to 1 June 2025 and the app at
http://localhost:5173. Press Enter and a stand-in laboratory system sends
2 to 14 June as HL7 v2 messages, one day every 3 seconds
(`scripts/demo.sh`; `scripts/demo.sh 5` slows it down). Open the Alerts
tab before pressing Enter. Every number below was read from the running
app on 2026-10-17 and traces to the experiment or decision named beside
it.

Backup: `node scripts/record_demo.mjs --lang en` (or `--lang fi`) records
the same four steps as a 70-second video, `demo-en.mp4`, in about two
minutes. To run from containers instead of a dev setup, see
deploy/README.md (Containers).

## 1. The lab feed arrives

The terminal shows each day's batch: about 40 cultures a day, sent as
HL7 v2.5.1 ORU^R01 with THL's national codes (`7640-22` *E. coli*, `12`
ceftriaxone), the format Tyks's lab system sends inside the hospital
(D-035, D-036, deploy/integration.md). The app notes each batch: "+23
results · 3 Jun · data checks passed". The fifteen data checks also pass
over everything loaded; Timeline shows them (`/api/quality`, D-038).

## 2. The outbreak alert, 4 June

On the 4 June batch a notice says "New alert: Possible cluster ·
Urology", and Alerts shows "Same resistant *E. coli* (urine) in 4 patients
on Urology in 4 weeks", resistant to ampicillin, cefuroxime, ceftriaxone,
ciprofloxacin and trimethoprim; about 0.2 were expected. This is the ESBL
*E. coli* cluster planted in the dataset (experiments/0001), caught by the
profile-excess detector (0002, D-020). On 8 June an ESBL excess in Urology
joins the same incident instead of raising a second one (D-034).

## 3. What works on that ward

Open Treat, unit Urology, infection site Urine (as of 8 June, the unit's
own 563 isolates since 9 June 2024, D-023). The alert stays on top of the
page: "Possible cluster of *E. coli* on this unit".

- Mild: mecillinam and nitrofurantoin first, both WHO Access. Mecillinam
  covers 95 % of the bacteria it is meant for, but only 74 % of
  everything that grows here; nitrofurantoin 86 % and 82 %. Both
  figures are retrospective susceptibility proportions among included
  isolates: the first within the drug's intended spectrum, the second across
  all organisms grown. Neither is a probability that treatment works. Our
  backtest found the first one holds the next month (0010).
- Switch How severe to Severe: piperacillin-tazobactam, 95 % (93–97 %),
  judged on everything that grows.

## 4. The region

Set the date to 3 October 2025 (the date field in the simulation bar, then
Go), open Timeline and scroll to "The region: county signals": in
September 2025 Varsinais-Suomi, Tyks's county, had 8 CPE *E. coli*
carriage cases against about 0.6 expected, marked "Strong signal". Of the
7 county signals known by then, 2 survive a correction for testing 8,250
county-months; the rest say "May be chance" (0008, D-037). This is real
THL data, not the synthetic hospital; `pnpm demo` fetches it if missing.

## What we tested, and the limits

| Claim | Evidence |
|---|---|
| For four-patient injections of a rare, identical resistance profile into this synthetic dataset, the shipped detector finds 89 % (95 % interval 84 to 93), median delay 6 days, about 4.5 signal episodes a year, about 1.0 of them cluster episodes | overnight-2026-10-17 benchmark (earlier, smaller experiment 0007: 95 %, 5 days) |
| Clusters of a common strain are not caught: 1 in 180 for the commonest resistant *E. coli*; fully susceptible strains never | 0011 |
| A 3-day gap in a unit's sampling is caught in 93 % of trials | 0009, D-031 |
| The coverage list's claims hold the next month (mild 96.6 % within spectrum, severe 95.4 %), but mild picks cover 75 % of all organisms | 0010 |
| Patient factors add nothing to coverage except men and urinary ciprofloxacin | 0005 |

The hospital data are synthetic; the integration path at Tyks rests on
public sources, with open points marked in deploy/integration.md. All
experiments rerun with `uv run python scripts/verify_experiments.py`.
