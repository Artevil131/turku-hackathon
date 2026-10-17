---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem (overnight run)
data: [synthetic_microbiology_dataset, seed 2026, as received 2026-10-09]
parent: 0015
---

# 0021 Can a rule name every alert of the live set and of the Gamma-Poisson test right, and how many alerts per incident do other incident rules give?

## Goal

ENGINE.md 3.6 says naming a signal is a lookup, not a model, and
OBJECTIVES.md asks that an alert be "named right": the kind and the
sentence match the event. The harness's D7 reads the kind from a table
keyed on the detector's name, which cannot name a detector it does not
know and says nothing about the sentence. METRICS.md lists D7 as "not
measured yet" and I1 only for D-034's rule, chosen by hand on 21 alerts.
This experiment writes the naming rule over the alert's own fields,
scores D7 and D6 on the planted and injected events, and measures I1
under other incident rules, so Artem can decide what the signal store
must carry and whether D-034's 28 days and its tags stand.

## Hypothesis

Exploratory in PROTOCOL.md's sense: it describes how a rule names alerts
and how incident rules change alerts per incident, and supports no claim
beyond its tables. Stated before the run so the tables can contradict it:

1. The rule and the harness's table agree on every signal of both feeds
   (100 %, none unnamed), so D7 equals the committed rows: 97.4 % for
   the live set as shipped (1,930 of 1,982) and 99.8 % for 0015's chosen
   test (616 of 617) (computed, baselines/, 0015).
2. D7 read on the first matching alert is lower for the live set, by 3
   to 12 points (assumed): 52 of 1,205 detected injected clusters had no
   cluster signal, only a sentinel (derived: 1,205 minus 1,153), and a
   sentinel fires before the cluster signal. For 0015's test it equals
   D7, every signal being a cluster.
3. The feeds have 18 and 13 alerts at the operating level (computed), so
   incident rules move the count little: windows of 14, 28 and 56 days
   give within 3 incidents of D-034's 15 (assumed); organism or
   phenotype across units merges at least one incident across units on
   the stress feeds; shared patients add links on at most 2 alert pairs
   at the operating level (assumed).
4. At least two kinds have a sentence slot no `Signal` field fills
   (trend: the starting share and the span; sentinel: time since the
   previous isolate) (derived from the dataclass); slot coverage is
   below 100 %.

## Experiment

**Feeds.** (a) The live set as shipped, `aei.score_detection.LiveSet`
at level 1 (`tuned_on_test`); (b) 0015's test at its year-1 choice, S 26
weeks, no guard band, L 1 week, no budget, q < 0.005, as the new module
`aei.gamma_poisson` (phase B moves 0015's detector there, with a test
that reproduces its 10 noise episodes, 5.02 a year; experiments/0015 is
untouched); (c) for I1 only, (a) and (b) together. Stress feeds for I1
only, so grouping has alerts to group: live at level 10, the test at
q < 0.05 (proposed (overnight), pending Artem; not a selection). Alerts
as `aei.score_detection.build_alerts` makes them.

**Naming rule** (proposed (overnight), pending Artem; first match wins;
reads only these fields, never `key` and never `profile`, which 0015
overloads with its budget mask). Sentences English / Finnish, slots in
braces, unit names from `wards.csv` (`ward_en`, `ward_fi`).

| # | tested on the alert's first signal | kind | sentence |
|---|---|---|---|
| 1 | the alert is a CPE find (D-014) | sentinel | "CPE {organism} in {unit}" / "CPE ({organism}) yksikössä {unit}" |
| 2 | `p` absent (a rule, no test) | sentinel | "First {phenotype} in {unit} in {lookback} days" / "Ensimmäinen {phenotype} yksikössä {unit} {lookback} päivään" |
| 3 | `antibiotic` set, `ward` absent | trend | "{organism} {antibiotic} resistance rising: {start}% → {observed}% over {span}" / "… resistenssi nousussa" |
| 4 | `antibiotic` set, `ward` set | divergence | "{unit} {antibiotic} resistance in {organism} above hospital: {observed}% against {expected}%" / "… yli sairaalan tason" |
| 5 | `organism`, `phenotype`, `antibiotic` all absent | data | "{unit}: {observed} cultures in 7 days, usual {expected}" or "{unit}: no samples for {observed} days" |
| 6 | `organism` or `phenotype` set, `expected` set | cluster | "{label} in {unit}: {observed} isolates in {weeks} weeks, usual {expected}" / "{label} yksikössä {unit}: {observed} eristettä {weeks} viikossa, tavallisesti {expected}" |
| 7 | none of these | unnamed | none; counted as an error |

Slot sources: `Signal` fields; detector settings (lookback 180 days,
window 28 days or 7 L, the 7-day sampling window); or missing. Slot
coverage is the share of alerts whose slots are all fields or settings;
the record lists each missing slot.

**D7 events** (screening seed 2026 only; seeds 2027 to 2030 never used):
the planted E1 to E4 (expected kinds: cluster; sentinel and cluster;
data; trend) and the harness's injections, 200 trials per cell: families
`rare`, `common_resistant`, `wild_type`, `common_esbl`, `two_unit`, k in
{2, 3, 4, 6} (cluster), gaps of 2, 3, 5, 7 days and a halved week (data);
controls excluded. Per feed, `score_detector` with a detector whose
`kind_fn` is the rule gives D1, D3, D4, D6, D7 and I1 from
`aei.score_detection`: D7 as the harness defines it (of the events
detected, the share with some matching signal of an expected kind; E2
needs both), Wilson 95 % intervals, beside the committed rows. Added,
from the same trials through `run_trials`: D7 first (the earliest
matching signal has an expected kind), D7 over all events (a miss is
not named), D7 per family and gap, and the confusion of rule against
table over every signal of the full run.

**D6.** The harness's D6 (share of injected gaps with any non-data
signal for the unit within the gap or the 7 days after), re-read with
rule names; and D6 annotated: the share with a non-data alert not
preceded by a data alert for the unit within 14 days, which the feed
would annotate "no samples, check the feed" (METRICS.md D6: suppressed or
annotated; 14 days proposed (overnight), pending Artem).

**Incident rules.** An alert joins the first open incident that meets the
rule; the incident carries the union of its alerts' units, tags and
patients and its latest date (D-034's form).

| rule | place | agent | window from the incident's latest alert |
|---|---|---|---|
| R1 D-034 | same unit | shares organism or phenotype (a phenotype implies its organisms; sampling alerts share one tag) | 28 d |
| R2, R3 | as R1 | as R1 | 14 d, 56 d |
| R4 | same unit | none | 28 d |
| R5 | any unit | shares organism or phenotype | 28 d |
| R6 | any unit | shares a patient | 28 d |
| R7 | R1 or R6 | | 28 d |

Patients behind an alert: those with an isolate in its unit for its
organism or phenotype in the 28 days up to its first signal; the isolate
itself for a sentinel or CPE find; none for data alerts (proposed
(overnight), pending Artem). R1 must reproduce `group_incidents` and the
committed I1 (18 alerts, 15 incidents; 13 and 12 for 0015) or the run
stops. METRICS.md's "lower is better" for I1, read literally, rewards
never grouping (1.0), so the record gives incidents (what a person
reads) and alerts per incident with no direction, incident counts with
exact Poisson 95 % intervals (D4's). Beside them, to check merging does
not fuse: alerts in the planted zones E1, E2, E3 (`zone_of`) and the
incidents they fall into (one each is right), incidents mixing a zone
with outside alerts or two units, the longest incident in days, and
incidents per detected trial for the injections.

**Budget and command.** 10 minutes of CPU, measured with
`aei.harness.Clock` (the live set's baseline took 115 s and 0015's whole
run 320 s, computed). Cuts, in order, recorded under Result: `wild_type`
and `two_unit` to 100 trials; k 2 and 6 to 100 trials.

    uv run python experiments/0021-naming-step/run.py

writes `out/results.md`, `out/metrics.json` (family `interpretation`,
through `aei.harness.write_metrics`: D7, I1, D6 of the live set as
shipped, `tuned_on_test` true because that feed is; all else, 0015's feed
included, in separate fields), `out/alerts.csv` (every alert of the
scoring period with kind and both sentences) and `out/figure.png`.
The naming and incident rules live in this directory under the overnight
file limits; if accepted they move to `libs/utils/py/aei` (AGENTS.md).

## Mathematical foundation

**Naming.** A decision list (Rivest 1987): ordered tests on five fields,
the first that holds names the kind. No parameters, no fitting, no
training and test split; written from ENGINE.md 3.6 before any number
was seen. Its errors are specification errors, where the rule and an
injection's label disagree, not sampling errors.

**D7.** A proportion r / n, n the events detected, r those named right,
with Wilson's score interval (Wilson 1927; `aei.coverage.wilson`).
Injected trials are independent draws of one stream; the four planted
events are described, not tested. Pooling weights families by their
detections, so the record gives each family.

**Incidents.** Grouping alerts under a link rule is single-linkage
clustering (Sneath and Sokal 1973): two alerts share a cluster when a
chain of linked alerts joins them. D-034's streaming form links an alert
to the incident's latest alert and unions its tags, single-linkage in
time order. Incident counts are counts, with exact Poisson intervals; a
rule that links nothing gives 1.0.

**Where it breaks.** Single-linkage chains: a 56-day window or a patient
link across units can join an ICU MRSA episode to one months later; the
longest incident shows it. The naming rule breaks where a field cannot
carry the kind: a unit-level trend would be named divergence (rule 4); a
data alert with an organism would be named a cluster; `observed` is days
in one data rule and cultures in the other, so rule 5's sentence needs
the detector's name though its kind does not; ENGINE.md 3.2's rare-profile
rule is a sentinel there, the harness's table calls it a cluster (in
neither feed). The patient link misses a carrier outside every alert's
window.

## Why this method here

- 0002 and 0009 chose the live set by whether it found E1 to E4; D7 of
  97 % says nothing about what the doctor or researcher reads, the
  sentence, its numbers and the first step.
- 0015's alerts come from a detector the table has never seen, with
  `profile` holding a budget mask: a rule over fields is what survives a
  new detector, and this is the first test of that.
- D-034 grouped 21 alerts into 18 incidents on a demo window and was never
  scored on the scoring period, against 14 or 56 days, or against shared
  patients, which infection control would use. Merging too much hides a
  second outbreak; too little lengthens the feed. The zone and chain
  checks put numbers on both.
- For the researcher: each row gets kind, sentence, counts, baseline and
  first step by lookup (D-019: numbers never from a model), in fewer rows
  if the incident rule is right. The missing-slot list is what the
  signal store must add.

## Proposed visualisation

One picture, the researcher's signal feed (OBJECTIVES.md: signal feed
first), light mode, 1,000 by 700 px, drawn from real alerts: the ICU in
March 2026 (E2) as one incident, with E1, E3 and E4 as single rows.

- Incident header above its rows: "Tapaus / Incident · Teho / ICU · MRSA
  · 2 hälytystä / 2 alerts · 3.–9.3.2026"; rows indented beneath, newest
  first; a single alert has no header.
- A row, left to right: kind badge, shape plus text, never colour alone
  (◆ Vartija / Sentinel, ● Klusteri / Cluster, ▲ Trendi / Trend,
  ◐ Poikkeama / Divergence, ■ Data / Data); the sentence in bold; the date
  raised at the right edge.
- Second line, grey: counts and baseline in words ("11 eristettä,
  tavallisesti 1,2 / 11 isolates, usual 1.2 · vertailu 365 pv / baseline
  365 d") and the test ("p 3e-7"). Third line: the first step ("Eristä ja
  seulo / Isolate and screen") and "Näytä 11 näytettä / Show 11 isolates".
- Beside the sentence, one small mark by kind: cluster, two bars
  (observed, usual) with an interval whisker; trend, a 3-point line of
  yearly shares with their n; data, a bar of cultures against usual;
  sentinel, a dot on a 180-day line. A slot no field fills prints "—"
  with the field name in light grey ("puuttuu / missing: starting share").
- AA contrast, text 12 pt or larger, every label Finnish first and
  English second.

## Result

Command, from the repository root:

    uv run python experiments/0021-naming-step/run.py

Outputs in `out/`: `results.md` (every table below and more: the incident
rules for each feed, level and with or without CPE finds, incidents per
injected trial, the confusion cells, the checks), `metrics.json` (family
`interpretation`; D7, D6, I1 of the live set as shipped; `tuned_on_test`
true because that feed is; both feeds, the added measures and the rule
tables in `by_feed`), `alerts.csv` (the 40 alerts of the scoring period
of the two feeds, the live feed's with CPE finds, with kind, rule number, R1 incident and both
sentences), `figure.png` (the picture of "Proposed visualisation", drawn
from the live set's alerts of E2, E1, E3 and E4). Also
`libs/utils/py/aei/gamma_poisson.py` (0015's detector moved unchanged;
experiments/0015 untouched) with `libs/utils/py/tests/test_gamma_poisson.py`,
four tests passing, one of them reproducing 0015's committed full-data
numbers at S 26, g 0, L 1, q < 0.005: 10 noise episodes, 5.02 a year, 13
alerts in 12 incidents (computed). `uv run python
scripts/verify_experiments.py --only 0021` says "reproduces". CPU time
63 s for the final run (measured, `aei.harness.Clock`; 63 s to 78 s over
four full runs, the spread being other jobs on the laptop); the budget
was 10 minutes and nothing was cut. Seed 2026 only, 200 trials per cell
from one `mulberry32(2026)` stream (seeds 2027 to 2030 untouched);
Wilson 95 % intervals for proportions, exact Poisson 95 % intervals for
incident counts. Everything below is computed by this run through
`aei.score_detection`'s blocks, except the baseline columns, which are
the committed rows (baselines/, 0015 out/metrics.json) computed by the
same harness. `tuned_on_test`: the rules were written from ENGINE.md 3.6
before any number and nothing was tuned; the live feed was tuned on the
scoring period (D-020, D-021, D-031); 0015's feed was chosen on year 1.

**Naming against the harness's table** (computed). Every signal of both
feeds is named the same by the rule and by the table, none unnamed: the
live set's 356 signals of the full run (319 cluster, 23 data, 8 sentinel,
6 trend) and the 18,083 signals of the injected trials; 0015's 2,148
signals and 29,934 trial signals, all cluster. Agreement 100 % (hypothesis
1 holds). Rule 1 (CPE find) named 9 alerts and rule 2 named 4, rule 3
one, rule 5 six, rule 6 seven in the live feed's 27 alerts of the scoring
period; rule 6 named all 13 of 0015's detector alerts, and its 9 CPE finds
are sentinels by rule 1.

**D7, D6 and I1 against the committed rows** (computed; I1 is R1 =
D-034's rule on the detector alerts without CPE finds, as the harness):

| | live set, rule | live set, committed | 0015 test, rule | 0015, committed |
|---|---|---|---|---|
| D7, of detected (n) | 97.38 % (96.6 to 98.0; 1,930 of 1,982) | same | 99.84 % (99.1 to 100; 616 of 617) | same |
| D7 first (earliest matching signal) | 94.30 % (93.2 to 95.2; 1,869 of 1,982) | not measured | 100.0 % (99.4 to 100; 617 of 617) | not measured |
| D7 over all 5,004 events | 38.57 % (1,930) | not measured | 12.31 % (616) | not measured |
| D6, gaps with any non-data signal (n 1,000) | 1.2 % (0.7 to 2.1) | 1.2 % | 1.9 % (1.2 to 2.9) | 1.9 % |
| D6 annotated (not preceded by a data signal within 14 d) | 0.4 % (0.2 to 1.0; 4 gaps) | not measured | 1.9 % (1.2 to 2.9; 19 gaps) | not measured |
| I1 alerts, incidents (alerts per incident; incidents 95 %) | 18, 15 (1.20; 8.4 to 24.7) | 18, 15 | 13, 12 (1.08; 6.2 to 21.0) | 13, 12 |

The live set re-tuned on year 1 has committed D7 98.68 %, D6 2.6 % and I1
29 alerts in 26 incidents; it was not rerun through the rule.
With CPE finds the live feed is 27 alerts in 24 incidents and 0015's 22
in 21 (R1; the first equals the committed `I1_full_tool`).

**D7 by event family** (computed; detected, right, first right):

| family | live set | 0015 test |
|---|---|---|
| rare clone | 534, 524, 490 | 265, 265, 265 |
| common resistant | 4, 4, 4 | 30, 30, 30 |
| wild type | 0 | 25, 25, 25 |
| common ESBL *E. coli* | 389, 389, 389 | 181, 181, 181 |
| two units | 278, 236, 209 | 114, 114, 114 |
| gaps (2, 3, 5, 7 days, halved week) | 773, 773, 773 | 0 detected |

The 52 live detections not named right are 10 rare clones and 42 two-unit
clusters with a sentinel but no cluster signal (derived: right minus
detected per family); the rule names each of those sentinels a sentinel,
which is right for the alert and not the label's "cluster". D7 on gaps is
100 % by construction, since a gap counts as detected only through a data
signal. Planted events: the live feed finds E1 (cluster, 2025-06-04), E2
(sentinel 2026-03-03, then cluster), E3 (data 2025-12-08) and E4 (trend
2026-05-10), all named right and first right. 0015's test finds E1
(cluster, 2025-06-10) and E2 as a cluster only (2026-03-05), so E2 is
found and not named right (no sentinel), and does not find E3 or E4.

**Incidents under the rules** (computed; incidents over the scoring
period, detector alerts without CPE finds, R1 to R7; 'stress' is live at
level 10 and 0015 at q < 0.05):

| feed, level (alerts) | R1 D-034 | R2 14 d | R3 56 d | R4 unit only | R5 tag, any unit | R6 patient | R7 R1 or R6 |
|---|---|---|---|---|---|---|---|
| live, operating (18) | 15 | 15 | 15 | 14 | 13 | 15 | 15 |
| 0015, operating (13) | 12 | 12 | 12 | 12 | 9 | 12 | 12 |
| both, operating (31) | 25 | 25 | 25 | 23 | 18 | 24 | 24 |
| live, stress (25) | 22 | 22 | 22 | 21 | 17 | 22 | 22 |
| 0015, stress (88) | 82 | 85 | 75 | 63 | 50 | 63 | 63 |
| both, stress (113) | 98 | 102 | 87 | 68 | 40 | 78 | 77 |

R1 reproduces `group_incidents` on every feed and the committed I1
(asserted). At the operating level the window of 14, 28 and 56 days
changes no incident count (15 and 12); the intervals of every cell
overlap, as 13 to 31 alerts allow. The checks that merging does not
fuse (computed): at the operating level every rule puts E1, E2, E3, E4
and the two quarantined zones each in one incident; R4 (unit only) makes
one incident mix a zone with outside alerts (longest incident 15 days)
in the live feed; R5 (tag in any unit) makes one live incident span two
units (longest 40 days), and in 0015's feed one mixed and two multi-unit
incidents; R6 and R7 (shared patients across units) fuse one incident
across units in the combined feed, and 7 in 0015's stress feed; in the
combined stress feed R5 has 16 multi-unit incidents and one 186 days
long. On the stress feeds the window matters: 0015's 82, 85 and 75
incidents for 28, 14 and 56 days, with E1 split in two incidents at 28
and 14 days and in one at 56 (the longest incident 93 days); R6 and R7
split E1 into three incidents in the combined stress feed. Alerts with
patients behind them: 11 of the live feed's 18 and all 13 of 0015's.
Shared patients (R6) add no link in either feed alone (15 and 12 as R1)
and one in the combined feed (24 against 25). Per detected injected
trial R1 gives 1.00 incidents in every family but the two-unit one and 1.41 (live; 165 of 278 with one) and 1.12 (0015; 100 of 114)
in the two-unit family, where R5 gives 1.00; R2 gives 8 rare and 10
common ESBL live trials more than one incident.

**Slot coverage** (computed). 26 of the live feed's 27 alerts and all 22
of 0015's have every slot of their sentence filled by a field or a
setting; the one incomplete is the trend alert (E4), whose starting share
and span no `Signal` field holds. Sentinel sentences are complete because
the template says "in 180 days", a setting; OBJECTIVES.md's "in 12
months" needs the date of the previous isolate, which no field holds
(derived from `Signal`, not measured).

**Hypotheses against the numbers.** (1) Held: 100 % agreement, D7 equal to
the committed rows. (2) Held at the edge for the live set: D7 first is 3.1
points below D7 (94.30 % against 97.38 %), the lower end of 3 to 12; for
0015's test D7 first (100 %) is not equal to D7 (99.84 %), the difference
being E2, where D7 asks for a sentinel and a cluster and D7 first for
either. (3) Held at the operating level for windows (0 incidents apart,
inside 3) and for R5 across units; shared patients added no pair in
either feed alone and one in the combined feed (inside 2). (4) Half held:
only the trend template has a slot no field fills; the sentinel's slot is
a setting under the template as written.

**Deviations from plan** (none cuts a trial or a cell).
- Rule 2 tests only `p` absent (no test on `ward`), as the table says; the
  rare-profile rule of ENGINE.md 3.2 (a sentinel there, a cluster in the
  harness's table) is in neither feed and was not exercised.
- Patients behind an alert for an organism series (profile excess, 0015's
  organism series) are all of the organism's patients in the unit in 28
  days, broader than the count the test used; every one of 0015's alerts
  therefore has patients. An alert joins the first open incident that
  meets the rule and incidents are never merged afterwards, so R6 and R7
  are not full single-linkage.
- D7 first takes ties on the earliest date as right when any signal of
  that date has an expected kind; for E2 the expected kinds are either.
- `metrics.json` carries the live set as shipped as its row; 0015's feed
  and the added measures are in `by_feed`. The first-step texts of the
  picture are proposals for method 28 and not scored. The picture's
  Finnish sentence is set in a smaller font where it is long.

## Interpretation

Against METRICS.md's "Decision rules" this changes no headline number and
decides nothing: D7, D6 and I1 are not headline metrics, the live set
and its D-034 are untouched, and what follows is for Artem to read.

What the numbers say, inside their intervals. A rule over five fields
names every alert of the live set and of 0015's test, including a
detector the harness's table has never seen, with a kind that matches the
table on all 50,521 signals (18,439 of the live set, 32,082 of 0015's),
so the naming step needs no model and no per-detector table once the
signal carries those fields. It breaks nothing in the two feeds, but it
rests on two fields' being unambiguous: `profile` (overloaded by 0015)
was kept out of it by design. D7 is 97.4 % and 99.8 % because the labels
and the rule share one taxonomy, not because anyone read the names; the
shortfall of the live set is not misnaming but 52 injected clusters
with no cluster signal (a sentinel only, derived), and read on the first alert D7 falls to
94.3 % (93.2 to 95.2), most in the two-unit family (75.2 %). The
annotation for D6 cuts the live set's gap alerts that look like a
resistance change from 12 of 1,000 gaps to 4 (derived: 1.2 % to 0.4 %);
0015's test, having no data signal, cannot annotate (1.9 %). The slot
check says what the signal store must add for the sentences ENGINE.md
promises: the trend's starting share and span, and the previous
isolate's date for "first MRSA in 12 months".

The incident rules are not separated at the operating level: 18 and 13
alerts give 15 and 12 incidents under D-034's 28 days, 14 and 56 days
alike, and every interval overlaps. What the data do say is where a rule
is dangerous: tag in any unit (R5) and unit alone (R4) fuse unrelated
alerts (incidents across two units, one 186 days long, a zone merged with
outside alerts), and a 56-day window chains (93 days longest in 0015's
stress feed) while 14 days splits E1 in two. D-034's rule, like
R2 and R3, fuses nothing and keeps E1 to E4 whole at the operating level,
so the data give no reason to change it, and no evidence that 28 days is
best: the stress feed shows it sitting between a window that splits and
one that chains. Shared patients add almost nothing over D-034 here and,
linking across units, fuse a few incidents (by the zone check's measure;
the link is the one infection control would draw).

Strongest alternative explanation: circularity. The injection labels,
the table and the rule are built from one five-kind taxonomy and read the
same fields, so 100 % agreement and a D7 near 100 % show that the rule
implements the table, not that a doctor reads the right name; the
sentence's wording and the first step are unscored, and I2 was not
measured. The incident counts rest on 13 to 31 alerts, E1 to E3 are the
only planted events to merge, and the stress levels were chosen to have
alerts to group, not by any criterion. Organism-level patient evidence
is broader than the alert's own count, which should favour R6 and did not.

Next: score the sentences, not only the kinds (I2 over `alerts.csv`'s
sentences with the D-019 digit check); add the trend's start share and
span and the sentinel's previous-isolate date to the signals and rescore
slot coverage; decide the kind of ENGINE.md 3.2's rare-profile rule;
rescore I1 on a noisier or longer feed and on held-out seeds 2027 to 2030
for the injected-trial grouping; and write the first-step text per kind as
method 28 proposes. Proposals for Artem, none decided.
