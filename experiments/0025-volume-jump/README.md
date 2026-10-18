---
status: accepted    # proposed, then accepted, rejected or superseded
by: Claude Code, operated by Artem
data: [synthetic_microbiology_dataset, seed 2026, 2023-10-02 to 2026-09-27, as received 2026-10-09]
parent: 0002
---

# 0025 Does the volume-jump detector (D-081) stay within about 1 other episode a year?

## Goal

D-081 adds `volumeJump`, the upper-tail twin of `samplingDrop`, and keeps it live only if it raises no
more than about 1 other episode a year. This measures that on the full dataset and, because the planted
events of 0001 contain no volume surge, on injected surges of known size. The answer decides whether
D-081 stays in `LIVE_SETTINGS`.

## Hypothesis

Stated before the run. With the D-081 settings (7-day window against a 56-day baseline, Poisson upper
tail, alpha 0.0001), scanned causally over the whole dataset:

1. it raises at most 1 other episode a year (all its episodes are "other": none of E1 to E4 is a
   volume surge);
2. a unit's week at three times its usual volume is signalled in at least 80 % of injected trials
   within 14 days, and a week at normal volume or at a gap (0007's gaps) is not.

Refuted if either fails.

## Experiment

- Data: `data/synthetic_microbiology_dataset/`, all cultures, 2.99 years.
- Detector: `volume_jump` in `libs/utils/py/aei/detect.py` (mirror of `volumeJump`, parity-tested)
  at `LIVE_SETTINGS["volume_jump"]`. A unit with no cultures in its baseline has expected 0 and is
  not tested (a choice not in D-081; without it a first culture after a silent baseline would
  signal with p = 0). No threshold is varied.
- Planted events (0001): for E1 to E4 it is reported whether the detector signals within 28 days of
  the event (E3's gap could produce a catch-up surge after it), none counted as a match.
- Episodes per year: episodes (same unit, within 28 days) divided by 1092 / 365.25 years; by
  calendar year.
- Injected events, seed 2026 (mulberry32), 40 trials per setting: (a) 0007's sampling gaps (d in {0
  control, 2, 3, 5, 7}, and half for 7 days), 0007's procedure on a fresh seed-2026 stream (so not 0007's units), detection = any volume-jump signal
  for the unit within 14 days of the start (a false alarm here); (b) surges: a random unit and start
  (as 0007's gaps), every culture of the unit in the 7 days from the start copied m - 1 times as new
  cultures on the same day, m in {1 (control), 2, 3}; detection = a volume-jump signal for the unit
  within 14 days of the start. Detectors run on the unit's cultures from 400 days before to 60 days
  after. The surge factors m are the experimenter's, not a statistical threshold.
- Metric: detection rate with a 95 % Wilson interval, median delay in days from the start.
- Code: `score.py` here: `uv run python experiments/0025-volume-jump/score.py`. Budget: seconds on a
  laptop.

## Result

`uv run python experiments/0025-volume-jump/score.py` (under 1 s on a laptop, one deterministic scan,
seed 2026 for the injections) writes `out/results.md`. All computed.

- **Whole dataset, 2.99 years, D-081 settings, nothing varied: 0 volume-jump signals, 0 episodes
  (0.00 a year).** The line was about 1 a year. For comparison the live sampling drop raises 4
  episodes (1.3 a year) on the same cultures. No planted event of 0001 is a surge and none is
  signalled (E3's gap is not followed by a catch-up surge that reaches alpha 0.0001).
- Injected surges (every culture of a unit in 7 days copied m - 1 times), 40 trials per setting:

| setting | detected within 14 days | median delay |
|---|---|---|
| control, nothing added | 0/40 (0–9 %) | – |
| week at 2 times the volume | 28/40 (55–82 %) | 4 d |
| week at 3 times the volume | 40/40 (91–100 %) | 2 d |

- 0007's gaps (no cultures for 2, 3, 5 or 7 days, half the cultures for 7 days, and the control): the
  jump detector signals in 0 of 240 trials, so it does not fire on a fall.

Deviations from plan: none. The 0007 gaps use a fresh seed-2026 stream, as the plan says.

## Interpretation

Both hypotheses hold: no other episodes in the three years (the line was about 1 a year) and a week at
three times the usual volume is found in 40 of 40 trials, median 2 days. It is quiet on the real data
and on gaps. A doubled week is found in 70 % (55–82 %), below the 80 % bar set only for tripled
volume. Caveats: the dataset has no real surge to find, so zero other episodes says only that its
volume is steady Poisson-like noise (the same property that made sampling-drop gaps hard to see in
small units); the injected surge copies existing cultures on the same days, which keeps the weekly
pattern; and zero signals means the false-alarm rate is bounded, not known (one run, 2.99 years). Per D-081 it
stays live. Next: real feeds with screening rounds or weekday patterns, where the 56-day baseline
may need a weekday adjustment (as noted for sampling drop in 0002).
