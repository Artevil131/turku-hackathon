---
status: proposed    # proposed, then accepted, rejected or superseded
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

## Interpretation
