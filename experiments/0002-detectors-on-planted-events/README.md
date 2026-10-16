---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Aapo
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0001
---

# 0002 Which simple detectors find the planted events, how early, at what cost?

## Goal

Give the team a measured starting point for deviation detection (the
fourth judging criterion, CONTEXT.md question 11) before the methods are
settled. Candidate detectors from Artem's notes (section C) are run day by
day over the three years, using only data up to each day, and scored on
the four events found in 0001. The team then picks detectors and
thresholds from this table instead of from first principles (D-016).

## Hypothesis

Exploratory comparison; no single prediction is tested. Described for
each detector and threshold:

- whether it signals each planted event, and the delay in days from the
  event's first case (or first missing day) to the first signal;
- how many other signal episodes it raises in the three years (a signal
  episode: signals for the same detector key within 28 days of each
  other). Other episodes may be noise or events 0001 did not find; they
  are listed so they can be checked by hand.

Planted events (from 0001): E1 Urology ESBL *E. coli* cluster, first case
2025-06-04 (or the first case in Urology in June 2025); E2 ICU MRSA
cluster, first case 2026-03-03; E3 no cultures at Health centre South,
2025-12-08 to 2025-12-14; E4 urinary *E. coli* trimethoprim resistance
rising over the whole period (no start date; the first signal date is
reported).

## Experiment

Detectors (D-016), all causal: the signal on day t uses only samples
dated on or before t, and every baseline excludes the window being tested.

1. **Profile rule** (Artem's cluster definition): at least k distinct
   patients in one unit with the same organism and the same S/R profile
   over the 13 antibiotics within W days, the profile holding at least one
   acquired R (not intrinsic, `@aei/eucast`). k in {3, 4}, W in {14, 28},
   all patients or only those sampled on day 3+ of their stay.
2. **Profile excess (Poisson):** the same count, compared with the count
   expected from the unit's isolates of that organism in the window times
   the profile's share hospital-wide in the 365 days before the window.
   Signal when P(X ≥ observed) < alpha and observed ≥ 3.
3. **Phenotype excess (Poisson):** ESBL, MRSA, VRE and CPE isolates in a
   unit within 28 days against the unit's share of that phenotype among
   its isolates in the 365 days before, times its isolates in the window.
   Signal when P(X ≥ observed) < alpha and observed ≥ 2.
4. **Sampling drop (Poisson):** cultures in a unit over the last 7 days
   against 7 times its daily mean over the 56 days before. Signal when
   P(X ≤ observed) < alpha.
5. **Resistance shift:** per unit and for the 22 organism and antibiotic
   pairs of 0001, % R in the last 28 days against the same unit's 336
   days before (non-overlapping), one-sided mid-p Fisher exact test,
   evaluated weekly. Signal when p < alpha and at least 3 R in the window.
6. **Rising trend:** hospital-wide per pair, Cochran-Armitage test for a
   trend over 28-day bins from the start of the data to t (at least 13
   bins), one-sided, evaluated every 28 days. Signal when p < alpha.

Alpha in {0.01, 0.001, 0.0001} for 2 to 6. All isolates are counted (the
first-isolate rule removes almost nothing within 28 days in one unit,
0001 follow-up); a patient counts once per detector window.

Code: reusable detectors in `libs/utils/detect` (TypeScript, tested),
the sweep in `sweep.ts` here: `node experiments/0002-detectors-on-planted-events/sweep.ts`.
Deterministic, no seeds. Output: Markdown tables in `out/`. Budget: a
few minutes on a laptop; if a sweep takes longer than a minute it moves
to chili.

## Result

`node experiments/0002-detectors-on-planted-events/sweep.ts` (about 12 s
on a laptop) writes `out/summary.md` (the full table) and
`out/other-episodes.md` (every signal episode that matches no planted
event, per variant). All numbers computed; deterministic, one run.

The best setting of each detector (delay in days from the event's start
to the first signal; other episodes over 2.99 years):

| detector | setting | E1 Urology ESBL | E2 ICU MRSA | E3 PHC-S gap | E4 TMP trend | other episodes / year |
|---|---|---|---|---|---|---|
| 2b profile excess (share within specimen) | alpha 0.0001 | 0 d | 4 d | – | – | 1.0 |
| 3 phenotype excess | alpha 0.001 | 4 d | 4 d | – | – | 2.0 |
| 4 sampling drop | alpha 0.0001 | – | – | 3 d | – | 1.0 |
| 5 resistance shift | alpha 0.001 | 11 d | 12 d | – | – | 0.3 |
| 6 rising trend | alpha 0.001 | – | – | – | first 2025-09-28 | 0.7 |

- The **profile rule** (Artem's literal cluster definition) finds both
  outbreaks within 0 to 15 days but raises 16 to 138 other episodes a
  year: common resistant profiles (for example *E. coli* resistant only to
  ampicillin) reach three patients in a unit all the time. Limiting it to
  patients on day 3+ of their stay cuts the noise by about two thirds and
  delays detection by 3 to 9 days.
- **Profile excess** compares the count with what the profile's usual
  share predicts, which removes most of that noise at no cost in delay.
- **Sampling drop** finds the empty week after 2 to 3 silent days; at
  alpha 0.001 it also flags 11 short dips elsewhere (for example Internal
  medicine A, 9 cultures in a week against 30 expected, 2025-05-18).
- **Rising trend** flags urinary *E. coli* trimethoprim from 2024-09-29 at
  alpha 0.01 and from 2025-09-28 at 0.001.

Other episodes that look like more than noise and should be checked by
hand: *E. coli* resistant only to piperacillin-tazobactam at Health
centre South, 5 patients against 0.2 expected (2023-11-10); ESBL at Health
centre South, 10 patients against 2.4 (2024-08-18); *E. coli* in Internal
medicine A, 9 patients with one ampicillin-trimethoprim profile against
1.6 (2025-09-25). The first two fall in the first year, where the 365-day
baseline is incomplete.

Deviations from plan: detector 2 as planned took the profile's share among
all isolates of the organism. Wound and blood isolates have no
urine-only results, so their profiles are rare in a share dominated by
urine and *E. coli* from Surgery kept signalling (7 of 11 other episodes
at alpha 0.0001). Variant 2b, added after the first run, takes the share
within the same specimen type; both are reported. The E4 column of
`out/summary.md` is headed "delay" but holds the first signal date.

## Interpretation

Four detectors together cover every planted event with about 5 other
episodes a year in total: profile excess within specimen (alpha 0.0001)
for clonal clusters, phenotype excess (alpha 0.001) for ESBL, MRSA, VRE
and CPE surges, sampling drop (alpha 0.0001) for missing data, and rising
trend (alpha 0.001) for slow drift. Resistance shift is slower and adds
little once those run. The simple profile rule is too noisy to show on its
own.

Caveats. The thresholds were tuned on the very events they are scored
on, so the delays are optimistic; no held-out events exist. "Other
episodes" mixes false alarms with events 0001 did not find. Thresholds
are per test and not corrected for the many units, profiles and days.

Next: the team picks detectors and thresholds from this table (and
records them in DECISIONS.md); the server runs them causally as the
replay clock moves and pushes their signals as alerts (D-014 extended).
A follow-up could plant synthetic events of known size into the data to
measure detection without tuning on the same events.

## Hand check of the leftover episodes (after close, 2026-10-16)

Not part of the planned experiment; counts measured by hand from the CSVs.

1. **Internal medicine A, week 2025-05-12 to 05-18:** 9 cultures against
   26 to 36 in each of the ten weeks around it, with four days of no
   samples at all (05-14, 05-15, 05-17, 05-18; the unit has 32 such days
   in three years). Other units that week are normal. Likely a second,
   smaller planted data gap.
2. **Internal medicine A, *E. coli* resistant to ampicillin and
   trimethoprim, September 2025:** 8 isolates in the month against 0 to 4
   in every other month, while the unit's urinary *E. coli* volume is
   normal (33); 6 of the 10 patients from 2025-08-30 to 09-28 were on day
   3+ of their stay. The profile is common (4.6 % of *E. coli*), so this
   is a possible small planted cluster, not a certain one.
3. **Health centre South, *E. coli* resistant only to
   piperacillin-tazobactam, November 2023:** 6 patients from 11-06 to
   11-12 (5 within three days), mostly aged 71 to 77; the profile itself is
   odd (piperacillin-tazobactam R with ampicillin S). It falls in the
   first two months of data, where the baseline is short. Unclear.
4. **Health centre South, ESBL, August 2024:** 12 ESBL isolates in five
   weeks against about 3 a month, but in 8 different profiles across
   *E. coli* and *K. pneumoniae*: not one clone. Most likely chance among
   the many tests run.

## Corrections after an independent review (2026-10-16, after close)

A review of 0001 to 0004 (a separate agent, read-only) found the
following; each was checked and acted on.

- **Timing of plans.** Plans were committed minutes before results
  (0002: under five minutes), with code drafted in the same sitting. This
  record is exploratory and its thresholds were chosen while looking at
  the events they are scored on; it is not a preregistered test.
- **Unrecorded deviation.** The plan says "a patient counts once per
  detector window"; profile and phenotype excess count patients, but
  resistance shift, rising trend and all baselines count isolates.
- **E1 starts earlier.** The first Urology isolate with the outbreak
  profile is dated 2025-05-30, not 2025-06-04, so the E1 delays above are
  at least 5 days longer. The E1 matcher credits any Urology *E. coli* or
  ESBL episode in the window, which is loose. Delays also assume a result
  arrives on its sample date (D-005); in practice culture and
  susceptibility take 2 to 3 days more.
- **Profile excess 2b mixed strata.** Its window counted the unit's
  patients with the organism across all specimens while the share came
  from one specimen. Fixed in `libs/utils/detect` (both now within
  specimen) and the sweep rerun: 2b at alpha 0.0001 now finds E2 after
  6 days (was 4) with 3 other episodes (unchanged); `out/` holds the rerun.
- **`poissonUpper` crashed** on a far tail of a tiny mean (for example
  k = 100, mean 0.001); fixed with a test. This dataset never reached it.
- **Sampling drop** was tuned on data with no weekday or holiday pattern
  (cultures per weekday 6,524 to 6,812); real data would need weekday and
  holiday adjustment.
- **The live set changed (D-022):** isolates of a cluster already
  detected are left out of the trend test from that day. The Urology
  outbreak had also raised hospital-wide *E. coli* cefuroxime and
  ceftriaxone trends; those are gone. The trimethoprim trend now first
  fires on 2026-05-10 instead of 2025-09-28: part of its earlier signal was
  the outbreak strain, which is trimethoprim-resistant.
