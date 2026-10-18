# 0024 results

Resistance shift at the D-080 settings ({'window_days': 28, 'baseline_days': 365, 'alpha': 0.01, 'min_baseline': 30, 'min_window': 3}), all isolates, 2.99 years, causal. Episodes: same detector and key (unit, specimen, organism, antibiotic) within 28 days. E1 and E2 are 0001's events, delay in days from the first case to the first matching signal. All computed; deterministic scan, seed 2026 for the injections. Run time 10.3 s.

## Whole dataset

| setting | E1 delay (first signal) | E2 delay (first signal) | episodes | other episodes | other per year | of them E4-related |
|---|---|---|---|---|---|---|
| with cluster exclusion (live) | – | – | 140 | 140 | 46.8 | 18 |
| without exclusion | 3 d (urine|Escherichia coli|CRO) | 6 d (wound|Staphylococcus aureus|FOX) | 140 | 133 | 44.5 | 19 |

Distinct unit-specimen-organism-antibiotic keys with an episode (live): 108. Other episodes (live) by calendar year (2023 holds 3 months, 2026 nine):

| year | other episodes |
|---|---|
| 2023 | 6 |
| 2024 | 48 |
| 2025 | 49 |
| 2026 | 37 |

By antibiotic: {'TMP': 26, 'CIP': 22, 'TZP': 15, 'CRO': 15, 'CXM': 15, 'AMP': 14, 'MEC': 12, 'NIT': 11, 'CLI': 4, 'FOX': 3, 'MEM': 2, 'CAZ': 1}

By unit: {'PHC-S': 29, 'PHC-N': 24, 'ED': 24, 'MED-A': 17, 'GER': 14, 'URO': 11, 'SURG': 10, 'MED-B': 9, 'ICU': 2}

## Injected clusters (0007's draws)

Detected: a shift signal for the unit and the source's organism from the start to 28 days after it, any antibiotic. 40 trials per setting; delay from the first injected case.

| setting | detected, with exclusion | median delay | detected, without exclusion | median delay |
|---|---|---|---|---|
| control, nothing injected | 3/40 (3–20 %) | 20 | 2/40 (1–17 %) | 8 |
| cluster of 2 | 17/40 (29–58 %) | 5 | 18/40 (31–60 %) | 5 |
| cluster of 3 | 17/40 (29–58 %) | 2 | 27/40 (52–80 %) | 6 |
| cluster of 4 | 16/40 (26–55 %) | 3 | 31/40 (62–88 %) | 4 |
| cluster of 6 | 15/40 (24–53 %) | 1 | 30/40 (60–86 %) | 3 |

## Injected drift without a clone

Detected: a shift signal for the unit, organism and antibiotic from the start to 28 days after it; delay from the start. 'Thin' trials had fewer than 3 known results in the window and cannot signal.

| setting | detected | median delay | thin trials |
|---|---|---|---|
| control, nothing changed | 0/40 (0–9 %) | – | 5 |
| drift f = 0.3 | 10/40 (14–40 %) | 14 | 9 |
| drift f = 0.6 | 27/40 (52–80 %) | 14 | 5 |
