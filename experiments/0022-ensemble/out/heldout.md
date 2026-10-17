# 0022 held-out re-score

Reproduce: `uv run python experiments/0022-ensemble/heldout.py` (seeds 2027 to 2030, 50 trials per seed, 200 per cell, `aei.score_detection.confirm`; every number computed by that run, or read from the committed screening and baseline files).

Run time 60.3 s (wall).

Run time 60.1 s (CPU).

D5 at k = 4, Wilson 95 %. Level: each ensemble's D5 headline level from the screening run (a p of the rule), the live set's its headline multiple of the alphas. Noise is the scoring-period episodes a year at that level (same for screening and held-out, it does not depend on the injection seed). 'At 5 a year' is the rate interpolated linearly in noise at 5.0 episodes a year from the same seeds' curve (computed).

| row | level | noise a year (episodes) | screening rare / common ESBL (seed 2026) | held-out rare | held-out common ESBL | screening at 5/yr rare / common | held-out at 5/yr rare / common |
| --- | --- | --- | --- | --- | --- | --- | --- |
| live set re-tuned year 1 | 0.3 | 3.01 (6) | 0.920 / 0.750 | 0.940 [0.898, 0.965] | 0.695 [0.628, 0.755] | 0.960 / 0.836 | 0.960 / 0.817 |
| rank product (primary) | 0.001 | 4.52 (9) | 0.940 / 0.830 | 0.965 [0.930, 0.983] | 0.765 [0.702, 0.818] | 0.942 / 0.834 | 0.966 / 0.772 |
| intersection (max p) | 0.003 | 4.52 (9) | 0.970 / 0.850 | 0.970 [0.936, 0.986] | 0.805 [0.745, 0.854] | 0.971 / 0.857 | 0.971 / 0.816 |
| stack | 0.003 | 3.01 (6) | 0.990 / 0.850 | 0.965 [0.930, 0.983] | 0.800 [0.739, 0.850] | 0.991 / 0.865 | 0.969 / 0.822 |

